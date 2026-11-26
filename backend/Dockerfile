FROM node:20-alpine
RUN apk upgrade --no-cache
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
CMD ["node", "src/index.js"]