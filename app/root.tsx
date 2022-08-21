import type { LinksFunction, MetaFunction } from "@remix-run/node";
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, } from "@remix-run/react";
import TailwindCSS from '~/styles/app.css'
import Logo from '../public/logo.png'
import Favicon from '../public/favicon.png'

export const meta: MetaFunction = () => ({
    charset: "utf-8",
    title: "Mach Radio",
    viewport: "width=device-width,initial-scale=1",
    description: "A WebRTC radio station.",
    "og:image": Logo,
    "og:title": "Mach Radio",
    "og:description": "A WebRTC radio station.",
});

export const links: LinksFunction = () => {
    return [
        { rel: "stylesheet", href: TailwindCSS },
        { rel: "icon", href: Favicon, type: "image/png" },
    ]
}


export default function App() {
    return (
        <html lang="en">
        <head>
            <Meta/>
            <Links/>
            <title>Mach Radio</title>
        </head>
        <body>
        <Outlet/>
        <ScrollRestoration/>
        <Scripts/>
        <LiveReload/>
        </body>
        </html>
    );
}
