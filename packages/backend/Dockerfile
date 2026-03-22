# Build from repo root: docker build -f packages/backend/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /usr/src/app

# Copy workspace and backend files required for compilation and minification.
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/backend/tsconfig.json ./packages/backend/
COPY packages/backend/tsconfig.prod.json ./packages/backend/
COPY packages/backend/src ./packages/backend/src

# Build backend artifact inside Docker.
RUN npm ci \
	&& npm run build:prod -w @mocker/backend \
	&& npm prune --omit=dev \
	&& mkdir -p /usr/src/app/images

FROM gcr.io/distroless/nodejs20-debian12:nonroot AS release
ENV NODE_ENV=production \
	PORT=80

WORKDIR /usr/src/app

# Copy backend build artifacts and writable path from build stage.
COPY --from=build --chown=65532:65532 /usr/src/app/packages/backend/dist ./dist
COPY --from=build --chown=65532:65532 /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=65532:65532 --chmod=700 /usr/src/app/images ./images

EXPOSE 80

CMD ["/usr/src/app/dist/index.js"]
