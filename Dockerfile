# Servidor de jogo (Colyseus). O cliente (site) é publicado à parte, como site estático.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run servidor:build
ENV NODE_ENV=production
# A hospedagem define PORT; sem ela, o servidor usa 2567.
EXPOSE 2567
CMD ["node", "dist-servidor/index.js"]
