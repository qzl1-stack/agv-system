#!/bin/bash

# 公网模式启动脚本
# 用于从远程客户端启动 AGV 模拟器

echo "🚀 启动 AGV 模拟器 (公网模式)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

PUBLIC_IP="34.67.204.128"
PORT="3000"

# 规则：
# - 远程客户端：本机一般不会监听 3000，此时用公网 IP
# - 部署机本身：本机通常已有后端监听 3000，但访问自身公网 IP 可能因
#   云安全组/防火墙/hairpin NAT 导致超时，优先用 localhost
if ss -lnt 2>/dev/null | awk '{print $4}' | grep -qE "(:${PORT})$"; then
    export AGV_SERVER_HOST=localhost
    echo "🧠 检测到本机已监听 ${PORT}，改用 localhost 连接后端"
else
    export AGV_SERVER_HOST="${PUBLIC_IP}"
fi

export AGV_SERVER_PORT="${PORT}"

node simulate_agv.js

