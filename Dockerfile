FROM node:10.13.0

WORKDIR /usr/src/mocker
COPY package.json .
RUN npm install
COPY . .

CMD ["npm", "run", "start:prod"]
