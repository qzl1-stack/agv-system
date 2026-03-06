#!/bin/bash

# WebRTC 诊断脚本
echo "=== AGV WebRTC 诊断开始 ==="
echo ""

# 1. 检查 mediamtx 容器是否运行
echo "1️⃣ 检查 MediaMTX 容器状态..."
if docker ps | grep -q agv-system_mediamtx_1; then
    echo "   ✅ MediaMTX 容器运行中"
else
    echo "   ❌ MediaMTX 容器未运行"
    docker-compose ps
    exit 1
fi

echo ""

# 2. 检查 MediaMTX 进程是否活跃
echo "2️⃣ 检查 MediaMTX 进程..."
if docker exec agv-system_mediamtx_1 pgrep -f mediamtx > /dev/null; then
    echo "   ✅ MediaMTX 进程运行中"
else
    echo "   ❌ MediaMTX 进程未运行"
fi

echo ""

# 3. 检查 API 端口（9997）是否响应
echo "3️⃣ 检查 MediaMTX API 端口 (9997)..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9997/v1/config/get)
if [ "$RESPONSE" = "200" ]; then
    echo "   ✅ API 响应正常 (HTTP $RESPONSE)"
else
    echo "   ⚠️  API 响应异常 (HTTP $RESPONSE)"
fi

echo ""

# 4. 检查 WHEP 端口（8889）是否开放
echo "4️⃣ 检查 WebRTC (WHEP) 端口 (8889)..."
if nc -zv localhost 8889 &>/dev/null; then
    echo "   ✅ 端口 8889 可访问"
else
    echo "   ⚠️  端口 8889 可能关闭或无响应"
fi

echo ""

# 5. 检查 HLS 端口（8888）
echo "5️⃣ 检查 HLS 端口 (8888)..."
if nc -zv localhost 8888 &>/dev/null; then
    echo "   ✅ 端口 8888 可访问"
else
    echo "   ⚠️  端口 8888 可能关闭或无响应"
fi

echo ""

# 6. 尝试获取流列表
echo "6️⃣ 检查 MediaMTX 流列表..."
curl -s http://localhost:9997/v1/paths/list | grep -q "agv_camera" && \
    echo "   ✅ 找到 agv_camera 流" || \
    echo "   ⚠️  未找到 agv_camera 流 (确保有推流源)"

echo ""

# 7. 检查容器日志
echo "7️⃣ MediaMTX 容器最近日志..."
docker logs --tail=20 agv-system_mediamtx_1 | grep -i "error\|fail\|warn" || \
    echo "   ✅ 无错误日志"

echo ""
echo "=== 诊断完成 ==="
echo ""
echo "💡 建议："
echo "   1. 如果 API 响应异常，重启 MediaMTX: docker-compose restart mediamtx"
echo "   2. 检查防火墙是否阻止 UDP（WebRTC 需要 UDP）"
echo "   3. 确保有推流源向 RTMP (1935) 推送 agv_camera 流"
echo "   4. 查看浏览器控制台日志了解具体错误"
