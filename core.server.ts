import * as path from "node:path";

import { createRequestHandler, type RequestHandler } from "@remix-run/express";
import { broadcastDevReady, installGlobals } from "@remix-run/node";
import compression from "compression";
import express from "express";

import { rdtServerConfig } from "./rdt.config";
import { SocketHandler } from "./server/socket-handler";
import { commandServer } from "./server/command-server";

// patch in Remix runtime globals
installGlobals();
require("dotenv").config();

// Make sure devDependencies don't ship to production
const chokidar =
	process.env.NODE_ENV === "development" ? require("chokidar") : null;
const rdt =
	process.env.NODE_ENV === "development"
		? require("remix-development-tools/server")
		: null;

/**
 * @typedef {import('@remix-run/node').ServerBuild} ServerBuild
 */
const BUILD_PATH = path.resolve("./build/index.js");
const WATCH_PATH = path.resolve("./build/version.txt");

/**
 * Initial build
 * @type {ServerBuild}
 */
let build = require(BUILD_PATH);

const cors = require("cors");
export let socketHandler: SocketHandler;

//Start core site (remix + payload instance)
async function startCore() {
	const app = express();

	app.use(compression());

	// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
	app.disable("x-powered-by");

	const getHost = (req: { get: (key: string) => string | undefined }) =>
		req.get("X-Forwarded-Host") ?? req.get("host") ?? "";

	app.use((req, res, next) => {
		//enforce https connection to make sure the site uses http2 protocol
		const proto = req.get("X-Forwarded-Proto");
		const host = getHost(req);
		// console.log("proto", proto, "host", host);
		if (proto === "http") {
			res.set("X-Forwarded-Proto", "https");
			res.redirect(`https://${host}${req.originalUrl}`);
			return;
		}

		// if they connect once with HTTPS, then they'll connect with HTTPS for the next hundred years
		res.set(
			"Strict-Transport-Security",
			"max-age=63072000; includeSubDomains; preload",
		);

		// no ending slashes for SEO reasons
		if (req.path.endsWith("/") && req.path.length > 1) {
			const query = req.url.slice(req.path.length);
			const safepath = req.path.slice(0, -1).replace(/\/+/g, "/");
			res.redirect(301, safepath + query);
			return;
		}

		next();
	});

	// Remix fingerprints its assets so we can cache forever.
	app.use(
		"/build",
		express.static("public/build", { immutable: true, maxAge: "1y" }),
	);

	// Aggressively cache fonts for a year
	app.use(
		"/fonts",
		express.static("public/fonts", { immutable: true, maxAge: "1y" }),
	);

	// Everything else (like favicon.ico) is cached for an hour. You may want to be
	// more aggressive with this caching.
	app.use(express.static("public", { maxAge: "1h" }));

	// This makes sure the build is wrapped on reload by RDT
	if (rdt) build = rdt.withServerDevTools(build, rdtServerConfig);

	// Check if the server is running in development mode and reflect realtime changes in the codebase.
	// We'll also inject payload in the remix handler so we can use it in our routes.
	app.all(
		"*",
		process.env.NODE_ENV === "development"
			? createDevRequestHandler()
			: createProductionRequestHandler(),
	);
	const port = Number.parseInt(process.env.PORT ?? "8081", 10);

	socketHandler = new SocketHandler(app, port as number);

	/**
	 * COMMAND_SERVER listens only on 127.0.0.1 to restrict producer access.
	 */
	const COMMAND_SERVER_PORT = Number.parseInt(
		process.env.COMMAND_SERVER_PORT ?? "8082",
		10,
	);

	commandServer.listen(COMMAND_SERVER_PORT, "127.0.0.1", () => {
		console.log(`COMMAND_SERVER started on port :${COMMAND_SERVER_PORT}`);
	});
}

startCore();

// Create a request handler for production
function createProductionRequestHandler(): RequestHandler {
	function getLoadContext(req: any, res: any) {
		return {
			payload: req.payload,
			user: req?.user,
			res,
		};
	}

	return createRequestHandler({
		build,
		mode: process.env.NODE_ENV,
		getLoadContext,
	});
}

// Create a request handler that watches for changes to the server build during development.
function createDevRequestHandler(): RequestHandler {
	async function handleServerUpdate() {
		// This makes sure the build is wrapped on reload by RDT
		build = rdt.withServerDevTools(await reimportServer(), rdtServerConfig);

		// Add debugger to assist in v2 dev debugging
		if (build?.assets === undefined) {
			console.log(build.assets);
			debugger;
		}

		// 2. tell dev server that this app server is now up-to-date and ready
		broadcastDevReady(build);
	}

	chokidar
		.watch(WATCH_PATH, {
			ignoreInitial: true,
		})
		.on("add", handleServerUpdate)
		.on("change", handleServerUpdate);

	// wrap request handler to make sure its recreated with the latest build for every request
	return async (req, res, next) => {
		try {
			return createRequestHandler({
				build,
				mode: "development",
				getLoadContext(req, res) {
					return {
						res,
					};
				},
			})(req, res, next);
		} catch (error) {
			next(error);
		}
	};
}

// CJS require cache busting
/**
 * @type {() => Promise<ServerBuild>}
 */
async function reimportServer() {
	// 1. manually remove the server build from the require cache
	for (const key of Object.keys(require.cache)) {
		if (key.startsWith(BUILD_PATH)) {
			delete require.cache[key];
		}
	}

	// 2. re-import the server build
	return require(BUILD_PATH);
}
