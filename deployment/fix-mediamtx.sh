#!/bin/bash

# MediaMTX 问题修复脚本

echo "🔧 AGV MediaMTX 修复工具"
echo ""
echo "当前状态："
docker-compose ps mediamtx

echo ""
echo "选择操作："
echo "1) 重启 MediaMTX"
echo "2) 强制重启 MediaMTX（删除容器）"
echo "3) 查看 MediaMTX 容器日志"
echo "4) 检查 MediaMTX 配置文件"
echo ""

read -p "请选择 (1-4): " choice

case $choice in
  1)
    echo "正在重启 MediaMTX..."
    docker-compose restart mediamtx
    echo "等待启动..."
    sleep 10
    echo "最终状态："
    docker-compose ps mediamtx
    ;;
  2)
    echo "正在强制重启 MediaMTX..."
    docker-compose stop mediamtx
    docker-compose rm -f mediamtx
    echo "等待重新创建..."
    COMPOSE_HTTP_TIMEOUT=180 docker-compose up -d mediamtx
    sleep 10
    echo "最终状态："
    docker-compose ps mediamtx
    ;;
  3)
    echo "MediaMTX 日志："
    docker logs --tail=50 agv-system_mediamtx_1
    ;;
  4)
    echo "MediaMTX 配置文件 (/etc/mediamtx/mediamtx.yml)："
    cat deployment/mediamtx-fixed.yml
    ;;
  *)
    echo "无效选择"
    ;;
esac

echo ""
echo "📌 WebRTC 连接排查清单："
echo "  ✓ 确保 MediaMTX 容器运行（docker-compose ps）"
echo "  ✓ 确保有推流源向 RTMP 1935 推送 agv_camera 流"
echo "  ✓ 确保防火墙允许 UDP（WebRTC 需要 UDP）"
echo "  ✓ 查看浏览器控制台日志获取详细错误信息"
echo "  ✓ 尝试在浏览器开发者工具的 Network 标签查看 WHEP 请求"
