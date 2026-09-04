FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm config set fetch-retries 5 && npm config set fetch-retry-mintimeout 20000 && npm install

COPY . .

RUN npx prisma generate

CMD ["npm", "run", "dev"]