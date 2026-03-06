#!/bin/bash

# WebRTC 诊断脚本
echo "=== AGV WebRTC 诊断开始 ==="
echo ""

# 1. 检查 mediamtx 容器是否运行
echo "1️⃣ 检查 MediaMTX 容器状态..."
if docker ps | grep -q agv-system_mediamtx_1; then
    CONTAINER_STATUS=$(docker ps | grep agv-system_mediamtx_1 | awk '{print $NF}')
    echo "   ✅ MediaMTX 容器运行中 (状态: $CONTAINER_STATUS)"
else
    echo "   ❌ MediaMTX 容器未运行"
    docker-compose ps
    exit 1
fi

echo ""

# 2. 检查 MediaMTX 是否监听端口（比进程检查更可靠）
echo "2️⃣ 检查 MediaMTX 服务可用性..."
if timeout 2 bash -c "cat < /dev/null > /dev/tcp/localhost/9997" 2>/dev/null; then
    echo "   ✅ MediaMTX 正在监听端口 9997"
else
    echo "   ❌ 无法连接到 MediaMTX 端口 9997"
fi

echo ""

# 3. 检查 API 端口（9997）是否响应（使用超时防止卡住）
echo "3️⃣ 检查 MediaMTX API 端点..."
RESPONSE=$(timeout 3 curl -s -o /dev/null -w "%{http_code}" http://localhost:9997/v1/config/get 2>/dev/null)
if [ -z "$RESPONSE" ] || [ "$RESPONSE" = "000" ]; then
    echo "   ⚠️  API 响应超时或无法连接 (HTTP $RESPONSE)"
    echo "      💡 可能原因: MediaMTX 未完全初始化，或 API 服务未启动"
elif [ "$RESPONSE" = "200" ]; then
    echo "   ✅ API 响应正常 (HTTP $RESPONSE)"
else
    echo "   ⚠️  API 返回异常状态码 (HTTP $RESPONSE)"
fi

echo ""

# 4. 检查 WHEP 端口（8889）是否开放
echo "4️⃣ 检查 WebRTC (WHEP) 端口 (8889)..."
if timeout 2 bash -c "cat < /dev/null > /dev/tcp/localhost/8889" 2>/dev/null; then
    echo "   ✅ 端口 8889 可访问"
else
    echo "   ⚠️  端口 8889 可能关闭或无响应"
fi

echo ""

# 5. 检查 HLS 端口（8888）
echo "5️⃣ 检查 HLS 端口 (8888)..."
if timeout 2 bash -c "cat < /dev/null > /dev/tcp/localhost/8888" 2>/dev/null; then
    echo "   ✅ 端口 8888 可访问"
else
    echo "   ⚠️  端口 8888 可能关闭或无响应"
fi

echo ""

# 6. 检查流列表（带超时）
echo "6️⃣ 检查 MediaMTX 流列表..."
STREAMS=$(timeout 3 curl -s http://localhost:9997/v1/paths/list 2>/dev/null)
if echo "$STREAMS" | grep -q "agv_camera"; then
    echo "   ✅ 找到 agv_camera 流"
    # 解析流信息
    STREAM_INFO=$(echo "$STREAMS" | grep -A 5 "agv_camera" | head -3)
    if echo "$STREAM_INFO" | grep -q "online"; then
        echo "      ✅ 流状态: 在线"
    else
        echo "      ⚠️  流状态: 离线 (确保有推流源向 RTMP 1935 推送)"
    fi
else
    echo "   ⚠️  未找到 agv_camera 流"
    echo "      💡 需要启动摄像头推流程序向 RTMP (1935) 推送 agv_camera"
fi

echo ""

# 7. 检查容器日志中的 WebRTC 事件
echo "7️⃣ MediaMTX 日志分析..."
RECENT_LOGS=$(docker logs --tail=50 agv-system_mediamtx_1 2>/dev/null)

# 检查错误
ERROR_COUNT=$(echo "$RECENT_LOGS" | grep -i "error\|fail\|closed" | wc -l)
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "   ⚠️  检测到 $ERROR_COUNT 条错误/断开日志"
    echo "      最后的断开信息："
    echo "$RECENT_LOGS" | grep -i "closed" | tail -3 | sed 's/^/      /'
else
    echo "   ✅ 未发现异常日志"
fi

# 检查 WebRTC 会话
WEBRTC_SESSIONS=$(echo "$RECENT_LOGS" | grep "WebRTC.*session" | tail -3)
if [ ! -z "$WEBRTC_SESSIONS" ]; then
    echo "   📊 最近的 WebRTC 会话活动："
    echo "$WEBRTC_SESSIONS" | sed 's/^/      /'
fi

echo ""
echo "=== 诊断完成 ==="
echo ""
echo "💡 问题排查步骤："
echo ""
echo "   如果 WebRTC 连接失败 (deadline exceeded)："
echo "   ├─ 原因: ICE 候选项无法建立（NAT 穿透失败）"
echo "   ├─ 解决方案:"
echo "   │  • 检查防火墙是否允许 UDP 8000-9000 范围"
echo "   │  • 确保公网能访问你的 MediaMTX 服务"
echo "   │  • 尝试在浏览器控制台查看 ICE 日志"
echo "   └─ 备选: 降级到 HLS (延迟较高但更稳定)"
echo ""
echo "   如果找不到 agv_camera 流："
echo "   └─ 需要启动摄像头推流程序向 RTMP (1935) 推送"
echo ""
echo "   如果 API 无法响应："
echo "   ├─ 尝试: docker-compose restart mediamtx"
echo "   └─ 然后等待 10-15 秒重新诊断"
echo ""
echo "📍 更多信息: 查看 WEBRTC_TROUBLESHOOTING_ZH.md"
