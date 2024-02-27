FROM nikolaik/python-nodejs:python3.12-nodejs18	 AS base

ENV NODE_ENV production

FROM base as deps
WORKDIR /code

COPY ./worker/package.json ./worker/package-lock.json ./

RUN npm ci --omit=dev

# Build the app
FROM base as build
WORKDIR /code

COPY --from=deps /code/node_modules /code/node_modules

COPY ./worker/ .

RUN npm run build

CMD ["npm", "run", "start:core"]
