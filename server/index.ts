// eslint-disable-next-line unicorn/prefer-node-protocol
import path from 'path';
import express from 'express';
import compression from 'compression';
import { createRequestHandler } from '@remix-run/express';
import worker from './mediasoup-handler';
import { commandServer } from './command-server';
import { SocketHandler } from './socket-handler';

// eslint-disable-next-line @typescript-eslint/naming-convention
const BUILD_DIR = path.join(process.cwd(), 'build');
export const app = express();

app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable('x-powered-by');

// Remix fingerprints its assets so we can cache forever.
app.use(
  '/build',
  express.static('public/build', { immutable: true, maxAge: '1y' })
);

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static('public', { maxAge: '1h' }));

app.all(
  '*',
  process.env.NODE_ENV === 'development'
    ? async (
        request: express.Request,
        response: express.Response,
        next: express.NextFunction
      ) => {
        purgeRequireCache();

        return createRequestHandler({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports, unicorn/prefer-module
          build: require(BUILD_DIR),
          mode: process.env.NODE_ENV,
        })(request, response, next);
      }
    : createRequestHandler({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports, unicorn/prefer-module
        build: require(BUILD_DIR),
        mode: process.env.NODE_ENV,
      })
);

// eslint-disable-next-line @typescript-eslint/naming-convention
const EXPRESS_PORT = Number.parseInt(process.env.PORT ?? '8080', 10);
export const socketHandler = new SocketHandler(app, EXPRESS_PORT);

/**
 * COMMAND_SERVER listens only on 127.0.0.1 to restrict producer access.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
const COMMAND_SERVER_PORT = Number.parseInt(
  process.env.COMMAND_SERVER_PORT ?? '8081',
  10
);

commandServer.listen(COMMAND_SERVER_PORT, '127.0.0.1', () => {
  console.log(`COMMAND_SERVER started on port :${COMMAND_SERVER_PORT}`);
});

setInterval(() => {
  if (worker.producer && !worker.producer.closed) {
    worker.producer
      .getStats()
      .then(async (stats) => {
        /**
         * Close producer if RTP score is 0. This is just a fallback mechanism if the
         * ffmpeg process fails to exit gracefully.
         */
        if (stats.length > 0 && stats[0].score === 0) {
          console.log('RTP score is 0, closing producer');
          worker.closeProducer();
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }
}, 5000);

function purgeRequireCache() {
  // Purge require cache on requests for "server side HMR" this won't let
  // you have in-memory objects between requests in development,
  // alternatively you can set up nodemon/pm2-dev to restart the server on
  // file changes, but then you'll have to reconnect to databases/etc on each
  // change. We prefer the DX of this, so we've included it for you by default
  for (const key in require.cache) {
    if (key.startsWith(BUILD_DIR)) {
      delete require.cache[key];
    }
  }
}
