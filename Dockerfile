FROM node:12

WORKDIR /usr/src/mocker
COPY package.json .
RUN npm install && npm build
COPY . .
EXPOSE 3000

CMD ["node", "./dist/index.js"]
