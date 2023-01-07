/* eslint-disable @typescript-eslint/naming-convention */
import type { LinksFunction, MetaFunction } from '@remix-run/node';
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react';
import Logo from '../public/logo.png';
import Favicon from '../public/favicon.png';
import TailwindCSS from '~/styles/app.css';

export const meta: MetaFunction = () => ({
  // eslint-disable-next-line unicorn/text-encoding-identifier-case
  'charset': 'utf-8',
  'title': 'chanson.live',
  'viewport': 'width=device-width,initial-scale=1',
  'keywords': 'radio,webrtc,mediasoup,remix,react,typescript',
  'description': 'A WebRTC radio station.',
  'url': 'https://radio.superserio.us',
  'type': 'website',
  'twitter:image': Logo,
  'twitter:card': 'summary_large_image',
  'og:image': Logo,
  'og:title': 'chanson.live',
  'og:description': 'A WebRTC radio station.',
  'og:url': 'https://radio.superserio.us',
  'og:site_name': 'chanson.live',
});

export const links: LinksFunction = () => {
  return [
    { rel: 'stylesheet', href: TailwindCSS, type: 'text/css' },
    { rel: 'icon', href: Favicon, type: 'image/png' },
  ];
};

export default function App() {
  return (
    <html lang='en'>
      <head>
        <Meta />
        <Links />
        <title>chanson.live</title>
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
