FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ .

# 从 env 文件读取配置
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]

