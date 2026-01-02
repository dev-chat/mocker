FROM node:20-alpine AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN rm -rf /usr/src/app/dist
RUN npm ci && npm run lint && npm run build:prod

FROM node:20-alpine AS release
ENV NODE_ENV=production PORT=80
COPY --from=build /usr/src/app/dist /usr/src/app
COPY --from=build /usr/src/app/package.json /usr/src/app/
COPY --from=build /usr/src/app/package-lock.json /usr/src/app/
WORKDIR /usr/src/app
RUN mkdir /usr/src/app/images
RUN npm pkg delete scripts.prepare && npm ci --omit=dev && npm prune --production
EXPOSE 80

CMD ["node", "/usr/src/app/index.js"]
