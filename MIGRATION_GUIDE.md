# AGV 系统迁移指南

本文档介绍如何将 AGV 系统快速迁移到新服务器（使用 Docker Compose）。

---

## 📋 系统现状确认

### 已完成的容器化准备
✅ **后端** (`backend/server.js`)：已支持 `REDIS_HOST`、`REDIS_PORT`、`PUBLIC_IP` 等环境变量  
✅ **规则引擎** (`rule_engine_cpp`)：已支持 `REDIS_HOST`、`REDIS_PORT` 环境变量  
✅ **前端** (`frontend/vite.config.js`)：已支持 `VITE_API_TARGET`、`VITE_MEDIA_HOST` 等环境变量  
✅ **前端组件** (`Agv3DModel.vue`)：已把所有写死的 IP 改成环境变量  
✅ **生产构建**：`npm run build` 已成功生成 `dist/` 目录

---

## 🚀 快速迁移流程（3 步）

### 第一步：准备新服务器

```bash
# 1. 安装 Docker 和 Docker Compose（如果还没装）
# Ubuntu/Debian:
sudo apt update && sudo apt install -y docker.io docker-compose

# 2. 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 3. 拉取/上传代码到新服务器
git clone <仓库URL> /www/wwwroot/agv-system
cd /www/wwwroot/agv-system
```

### 第二步：配置环境变量

在新服务器上修改以下文件中的 IP 地址（替换为新服务器的公网 IP）：

#### 后端配置：`backend/env`
```bash
PUBLIC_IP=新服务器公网IP          # 改这里！
REDIS_HOST=redis               # Docker Compose 中 Redis 容器的名字
REDIS_PORT=6379                # Redis 端口（如无特殊需求，保持默认）
```

#### 前端配置：`frontend/env.production` (如果需要生产环境单独配置)
```bash
VITE_API_TARGET=http://新IP:3000  # 后端 API 地址（开发时用）
VITE_MEDIA_HOST=新服务器公网IP    # 改这里！（流媒体服务地址）
```

**说明**：
- 如果只用 Docker Compose 内网通信，后端地址可填 `http://backend:3000`
- 如果前端需要从公网访问，改为你的新 IP 或域名

### 第三步：启动所有服务

```bash
# 在项目根目录运行
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看日志（排查问题时用）
docker-compose logs -f backend
docker-compose logs -f rule_engine
docker-compose logs -f redis
```

✅ 完成！所有服务应该在 **数秒内** 启动完毕。

---

## 📝 Docker Compose 配置参考

### docker-compose.yml 骨架

如果你的项目还没有 `docker-compose.yml`，创建一个：

```yaml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - HOST=0.0.0.0
      - PUBLIC_IP=${PUBLIC_IP}
      - SSE_DEBUG_LOG=/app/logs/sse_forward.log
    volumes:
      - backend_logs:/app/logs
    ports:
      - "3000:3000"
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  rule_engine:
    build:
      context: ./rule_engine_cpp
      dockerfile: Dockerfile
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - VITE_API_TARGET=http://backend:3000
      - VITE_MEDIA_HOST=${PUBLIC_IP}
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

  # 可选：MediaMTX 流媒体服务器
  mediamtx:
    image: bluenviron/mediamtx:latest
    volumes:
      - ./deployment/mediamtx-fixed.yml:/etc/mediamtx/mediamtx.yml:ro
    ports:
      - "1935:1935"    # RTMP
      - "8554:8554"    # RTSP
      - "8888:8888"    # HLS
      - "8889:8889"    # WebRTC
      - "9997:9997"    # API
      - "8189:8189"    # ICE
      - "8000-9000:8000-9000/udp"  # WebRTC media
    restart: unless-stopped

volumes:
  redis_data:
  backend_logs:
```

### .env 文件（Docker Compose 会自动读取）

在项目根目录创建 `.env`：

```bash
# .env（Docker Compose 会读取这个文件）
PUBLIC_IP=你的新服务器公网IP
```

---

## 🐳 各个服务的 Dockerfile 模板

### backend/Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# 从 env 文件读取配置
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
```

### rule_engine_cpp/Dockerfile

```dockerfile
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    cmake \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN mkdir -p build && cd build && \
    cmake .. && \
    make

WORKDIR /app/build

# 从环境变量读取 Redis 配置
CMD ["./rule_engine"]
```

### frontend/Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# 构建前端
RUN npm run build

# 使用 nginx 服务
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY deployment/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### deployment/nginx.conf (前端反代后端)

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 反代后端 API
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 反代 WebSocket
    location /ws {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## 📊 迁移检查清单

### 迁移前
- [ ] 后端日志/数据备份（如需保留历史告警）
- [ ] Redis 数据备份（如需保留）
- [ ] 记下当前服务器的所有配置（端口、IP、域名）

### 迁移中
- [ ] 新服务器安装 Docker + Compose
- [ ] 上传/克隆代码
- [ ] 修改 `backend/env` 中的 `PUBLIC_IP`
- [ ] 修改 `frontend/env.development` 中的 `VITE_MEDIA_HOST`
- [ ] 运行 `docker-compose up -d --build`
- [ ] 验证所有容器运行正常（`docker-compose ps`）

### 迁移后
- [ ] 访问前端页面（`http://新IP`）
- [ ] 检查 SSE 实时告警是否正常
- [ ] 检查 WebSocket AGV 数据是否正常接收
- [ ] 检查视频流是否正常播放
- [ ] 配置云服务器安全组/防火墙规则

---

## 🔧 故障排查

### 容器启动失败
```bash
# 查看日志
docker-compose logs backend
docker-compose logs rule_engine

# 重新构建
docker-compose up -d --build --force-recreate
```

### Redis 连接失败
```bash
# 检查 Redis 是否运行
docker-compose ps redis

# 重启 Redis
docker-compose restart redis
```

### 前端无法连接后端
- 检查 `nginx.conf` 中的 `proxy_pass` 是否指向正确的后端地址
- 确保 `REDIS_HOST` 和 `REDIS_PORT` 与后端一致

### 视频流不显示
- 检查 `VITE_MEDIA_HOST` 是否正确填写
- 验证 MediaMTX 是否运行：`docker-compose logs mediamtx`
- 检查安全组是否开放了相应端口（1935, 8888, 8889 等）

---

## 📞 额外提示

### 本地开发测试
如果要在本地测试 Docker Compose，修改 `.env`：
```bash
PUBLIC_IP=localhost
```

然后 `docker-compose up -d --build`，访问 `http://localhost`。

### 仅迁移不用 Docker
如果你的新服务器暂不支持 Docker，你也可以：
1. 改 env 文件中的 IP
2. 直接运行 `npm start`（后端）和 `./rule_engine`（C++）
3. 用 Nginx 反代前端

但强烈建议使用 Docker，因为一致性更好，迁移更容易。

---

**迁移指南完成于** 2026-01-20  
**下一步**：按照"快速迁移流程"的 3 步走即可！

