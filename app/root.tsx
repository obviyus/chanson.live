import type { LinksFunction, MetaFunction } from "@remix-run/node";
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, } from "@remix-run/react";
import TailwindCSS from '~/styles/app.css'
import Logo from '../public/logo.png'
import Favicon from '../public/favicon.png'

export const meta: MetaFunction = () => ({
    charset: "utf-8",
    title: "Mach Radio",
    viewport: "width=device-width,initial-scale=1",
    keywords: "radio,webrtc,mediasoup,remix,react,typescript",
    description: "A WebRTC radio station.",
    url: "https://radio.superserio.us",
    type: "website",
    "twitter:image": Logo,
    "twitter:card": "summary_large_image",
    "og:image": Logo,
    "og:title": "Mach Radio",
    "og:description": "A WebRTC radio station.",
    "og:url": "https://radio.superserio.us",
    "og:site_name": "Mach Radio",
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
