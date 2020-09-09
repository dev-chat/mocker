FROM node:14

WORKDIR /usr/src/mocker
COPY package.json .
RUN npm install --only=prod
COPY . .
RUN npm run build:prod
EXPOSE 3000

CMD ["node", "./dist/index.js"]
