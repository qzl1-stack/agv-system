#!/bin/bash

# MediaMTX 流媒体服务器安装脚本
# 用于解决多客户端视频流卡顿问题

set -e

echo "==================================="
echo "MediaMTX 流媒体服务器安装脚本"
echo "==================================="

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo "请使用 sudo 运行此脚本"
    exit 1
fi

# 配置参数
MEDIAMTX_VERSION="v1.5.0"
INSTALL_DIR="/opt/mediamtx"
DOWNLOAD_URL="https://github.com/bluenviron/mediamtx/releases/download/${MEDIAMTX_VERSION}/mediamtx_${MEDIAMTX_VERSION}_linux_amd64.tar.gz"

# 步骤 1: 创建安装目录
echo "[1/7] 创建安装目录..."
mkdir -p ${INSTALL_DIR}
cd ${INSTALL_DIR}

# 步骤 2: 下载 MediaMTX
echo "[2/7] 下载 MediaMTX ${MEDIAMTX_VERSION}..."
if [ -f "mediamtx" ]; then
    echo "MediaMTX 已存在，跳过下载"
else
    wget -O mediamtx.tar.gz ${DOWNLOAD_URL}
    tar -xzf mediamtx.tar.gz
    rm mediamtx.tar.gz
fi

# 步骤 3: 设置执行权限
echo "[3/7] 设置执行权限..."
chmod +x mediamtx

# 步骤 4: 创建配置文件
echo "[4/7] 创建配置文件..."
cat > ${INSTALL_DIR}/mediamtx.yml << 'EOF'
# MediaMTX 配置文件
# 用于 AGV 系统视频流分发

# 日志配置
logLevel: info
logDestinations: [stdout]
logFile: /var/log/mediamtx.log

# API 配置
api: yes
apiAddress: :9997

# RTMP 推流端口（接收 FFmpeg 推流）
rtmp: yes
rtmpAddress: :1935
rtmpEncryption: "no"

# RTSP 配置
rtsp: yes
rtspAddress: :8554
rtspEncryption: "no"

# WebRTC 配置（客户端拉流）
webrtc: yes
webrtcAddress: :8889
webrtcICEServers:
  - urls: [stun:stun.l.google.com:19302]
webrtcICEHostNAT1To1IPs: []
webrtcICEUDPMuxAddress: :8189
webrtcICETCPMuxAddress: :8189

# HLS 配置（备选方案）
hls: yes
hlsAddress: :8888
hlsAlwaysRemux: yes
hlsVariant: lowLatency
hlsSegmentCount: 7
hlsSegmentDuration: 500ms
hlsPartDuration: 200ms
hlsSegmentMaxSize: 50M
hlsAllowOrigin: "*"
hlsDirectory: /var/tmp/mediamtx-hls

# 路径配置
paths:
  agv_camera:
    source: publisher
    sourceOnDemand: no
    runOnReady: ""
    runOnDemand: ""
    
  # 可以添加更多摄像头路径
  # agv_camera_2:
  #   source: publisher
  #   sourceOnDemand: no
EOF

echo "配置文件已创建: ${INSTALL_DIR}/mediamtx.yml"

# 步骤 5: 创建 systemd 服务文件
echo "[5/7] 创建 systemd 服务..."
cat > /etc/systemd/system/mediamtx.service << EOF
[Unit]
Description=MediaMTX RTSP/RTMP/WebRTC Server
Documentation=https://github.com/bluenviron/mediamtx
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/mediamtx ${INSTALL_DIR}/mediamtx.yml
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# 资源限制
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

echo "systemd 服务文件已创建"

# 步骤 6: 配置防火墙
echo "[6/7] 配置防火墙规则..."
if command -v ufw &> /dev/null; then
    echo "检测到 UFW 防火墙，正在配置..."
    ufw allow 1935/tcp comment 'MediaMTX RTMP'
    ufw allow 8554/tcp comment 'MediaMTX RTSP'
    ufw allow 8889/tcp comment 'MediaMTX WebRTC信令'
    ufw allow 8888/tcp comment 'MediaMTX HLS'
    ufw allow 9997/tcp comment 'MediaMTX API'
    ufw allow 8189/tcp comment 'MediaMTX ICE TCP'
    ufw allow 8189/udp comment 'MediaMTX ICE UDP'
    ufw allow 8000:9000/udp comment 'MediaMTX WebRTC媒体端口'
    echo "UFW 防火墙规则已添加"
elif command -v firewall-cmd &> /dev/null; then
    echo "检测到 firewalld，正在配置..."
    firewall-cmd --permanent --add-port=1935/tcp
    firewall-cmd --permanent --add-port=8554/tcp
    firewall-cmd --permanent --add-port=8889/tcp
    firewall-cmd --permanent --add-port=8888/tcp
    firewall-cmd --permanent --add-port=9997/tcp
    firewall-cmd --permanent --add-port=8189/tcp
    firewall-cmd --permanent --add-port=8189/udp
    firewall-cmd --permanent --add-port=8000-9000/udp
    firewall-cmd --reload
    echo "firewalld 规则已添加"
else
    echo "未检测到防火墙，请手动配置以下端口："
    echo "  - 1935/tcp  (RTMP)"
    echo "  - 8554/tcp  (RTSP)"
    echo "  - 8889/tcp  (WebRTC 信令)"
    echo "  - 8888/tcp  (HLS)"
    echo "  - 9997/tcp  (API)"
    echo "  - 8189/tcp  (ICE TCP)"
    echo "  - 8189/udp  (ICE UDP)"
    echo "  - 8000-9000/udp (WebRTC 媒体)"
fi

# 步骤 7: 启动服务
echo "[7/7] 启动 MediaMTX 服务..."
systemctl daemon-reload
systemctl enable mediamtx
systemctl start mediamtx

# 等待服务启动
sleep 3

# 检查服务状态
if systemctl is-active --quiet mediamtx; then
    echo ""
    echo "==================================="
    echo "✓ MediaMTX 安装成功！"
    echo "==================================="
    echo ""
    echo "服务状态："
    systemctl status mediamtx --no-pager
    echo ""
    echo "配置文件位置: ${INSTALL_DIR}/mediamtx.yml"
    echo "日志查看: journalctl -u mediamtx -f"
    echo "API 端点: http://localhost:9997/v3/paths/list"
    echo ""
    echo "接下来的步骤："
    echo "1. 在云服务器安全组中开放上述端口"
    echo "2. 配置本地 FFmpeg 推流脚本"
    echo "3. 测试推流: ffmpeg -i rtmp://your-source -f flv rtmp://localhost:1935/agv_camera"
    echo ""
else
    echo ""
    echo "==================================="
    echo "✗ MediaMTX 启动失败"
    echo "==================================="
    echo ""
    echo "请查看日志: journalctl -u mediamtx -n 50"
    exit 1
fi

