# Build from repo root: docker build -f packages/backend/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /usr/src/app
ARG PREVIOUS_RELEASE_SHA

# Copy workspace and backend files required for compilation and minification.
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY .git ./.git
COPY packages/backend/package.json ./packages/backend/
COPY packages/backend/scripts ./packages/backend/scripts
COPY packages/backend/tsconfig.json ./packages/backend/
COPY packages/backend/tsconfig.prod.json ./packages/backend/
COPY packages/backend/src ./packages/backend/src

# Build backend artifact inside Docker.
RUN apk add --no-cache git \
	&& npm ci \
	&& PREVIOUS_RELEASE_SHA="$PREVIOUS_RELEASE_SHA" node ./packages/backend/scripts/write-release-metadata.js ./packages/backend/release-metadata.json \
	&& npm run build:prod -w @mocker/backend \
	&& npm prune --omit=dev

FROM gcr.io/distroless/nodejs20-debian12:nonroot AS release
ENV NODE_ENV=production \
	PORT=80 \
	IMAGE_DIR=/tmp/mocker-images

WORKDIR /usr/src/app

# Copy backend build artifacts. Runtime-generated images are written under /tmp.
COPY --from=build --chown=65532:65532 /usr/src/app/packages/backend/dist ./dist
COPY --from=build --chown=65532:65532 /usr/src/app/packages/backend/release-metadata.json ./release-metadata.json
COPY --from=build --chown=65532:65532 /usr/src/app/node_modules ./node_modules

EXPOSE 80

CMD ["/usr/src/app/dist/index.js"]
