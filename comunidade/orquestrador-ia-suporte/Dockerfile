FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY worker.mjs ./
CMD ["node", "worker.mjs"]
