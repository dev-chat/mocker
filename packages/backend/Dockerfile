# Build from repo root: docker build -f packages/backend/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /usr/src/app

# Copy root package files for workspaces
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./

# Copy backend package
COPY packages/backend/package.json packages/backend/
COPY packages/backend/tsconfig.json packages/backend/
COPY packages/backend/tsconfig.prod.json packages/backend/
COPY packages/backend/src packages/backend/src

# Copy config files for linting
COPY .eslintrc.js .prettierrc.js ./

# Install dependencies and build
RUN npm ci
RUN npm run lint -w @mocker/backend
RUN npm run build:prod -w @mocker/backend

FROM node:20-alpine AS release
ENV NODE_ENV=production PORT=80
WORKDIR /usr/src/app

# Copy built output
COPY --from=build /usr/src/app/packages/backend/dist ./

# Copy package files for production install
COPY --from=build /usr/src/app/package.json ./
COPY --from=build /usr/src/app/package-lock.json ./
COPY --from=build /usr/src/app/packages/backend/package.json ./packages/backend/

RUN mkdir -p /usr/src/app/images

# Install production dependencies only for the backend workspace
RUN npm pkg delete scripts.prepare && npm ci --omit=dev -w @mocker/backend --ignore-scripts

EXPOSE 80

CMD ["node", "/usr/src/app/index.js"]
