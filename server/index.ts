import path from "path";
import express from "express";
import compression from "compression";
import http from "http";
import { Server } from "socket.io";
import { createRequestHandler } from "@remix-run/express";
import { defaultWorker } from "./mediasoupHandler";
import { commandServer } from "./commandServer";
import { SocketHandler } from "./socketHandler";

const BUILD_DIR = path.join(process.cwd(), "build");

const app = express();
const index = new http.Server(app);
export const io = new Server(index);

app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

// Remix fingerprints its assets so we can cache forever.
app.use(
    "/build",
    express.static("public/build", { immutable: true, maxAge: "1y" })
);

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static("public", { maxAge: "1h" }));

app.all(
    "*",
    process.env.NODE_ENV === "development"
        ? (req: express.Request, res: express.Response, next: express.NextFunction) => {
            purgeRequireCache();

            return createRequestHandler({
                build: require(BUILD_DIR),
                mode: process.env.NODE_ENV,
            })(req, res, next);
        }
        : createRequestHandler({
            build: require(BUILD_DIR),
            mode: process.env.NODE_ENV,
        })
);

const EXPRESS_PORT = parseInt(process.env.PORT ?? "8080");

index.listen(EXPRESS_PORT, '0.0.0.0', () => {
    console.log(`Express and Socket server listening on :${EXPRESS_PORT}`);
});

/**
 * COMMAND_SERVER listens only on 127.0.0.1 to restrict producer access.
 */
const COMMAND_SERVER_PORT = parseInt(process.env.COMMAND_SERVER_PORT ?? '8081');
commandServer.listen(COMMAND_SERVER_PORT, '127.0.0.1', () => {
    console.log(`COMMAND_SERVER started on port :${COMMAND_SERVER_PORT}`);
});

setInterval(() => {
    if (defaultWorker.producer && !defaultWorker.producer.closed) {
        defaultWorker.producer.getStats().then(async stats => {
            // FIXME: Use a dedicated logger.
            console.log(stats);

            /**
             * Close producer if RTP score is 0. This is just a fallback mechanism if the
             * ffmpeg process fails to exit gracefully.
             */
            if (stats.length > 0 && stats[0]['score'] === 0) {
                io.sockets.emit("producerClosed", { id: defaultWorker.producer.id });
                await defaultWorker.producer.close();
            }
        });
    }
}, 5000);

/**
 * Socket Handler
 */
SocketHandler();

function purgeRequireCache() {
    // purge require cache on requests for "server side HMR" this won't let
    // you have in-memory objects between requests in development,
    // alternatively you can set up nodemon/pm2-dev to restart the server on
    // file changes, but then you'll have to reconnect to databases/etc on each
    // change. We prefer the DX of this, so we've included it for you by default
    for (let key in require.cache) {
        if (key.startsWith(BUILD_DIR)) {
            delete require.cache[key];
        }
    }
}
