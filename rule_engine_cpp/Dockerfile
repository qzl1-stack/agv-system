FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    cmake \
    build-essential \
    git \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY rule_engine_cpp/ .

# 清理本地的旧构建文件（如果有的话）
RUN rm -rf build

RUN mkdir -p build && cd build && \
    cmake .. && \
    make

WORKDIR /app/build

# 从环境变量读取 Redis 配置
CMD ["./rule_engine"]

