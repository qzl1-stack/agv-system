#!/bin/bash

# FFmpeg MJPEG 转码推流脚本
# 将本地 MJPEG 视频流转码为 H.264 并推送到云服务器 MediaMTX

set -e

# ==================== 配置参数 ====================
# 本地 MJPEG 视频源
MJPEG_SOURCE="http://localhost:8080/?action=stream"

# 云服务器 MediaMTX RTMP 地址
CLOUD_SERVER="47.105.118.142"
RTMP_PORT="1935"
STREAM_KEY="agv_camera"
RTMP_TARGET="rtmp://${CLOUD_SERVER}:${RTMP_PORT}/${STREAM_KEY}"

# 视频编码参数
VIDEO_BITRATE="1500k"      # 视频比特率
MAX_BITRATE="2000k"        # 最大比特率
BUFFER_SIZE="2000k"        # 缓冲区大小
GOP_SIZE="30"              # GOP 大小（关键帧间隔）
FRAMERATE="30"             # 帧率

# 日志文件
LOG_DIR="/var/log/ffmpeg"
LOG_FILE="${LOG_DIR}/push_stream.log"

# ==================================================

echo "========================================"
echo "FFmpeg MJPEG 转码推流脚本"
echo "========================================"
echo "视频源: ${MJPEG_SOURCE}"
echo "推流目标: ${RTMP_TARGET}"
echo "视频比特率: ${VIDEO_BITRATE}"
echo "========================================"
echo ""

# 创建日志目录
mkdir -p ${LOG_DIR}

# 检查 FFmpeg 是否已安装
if ! command -v ffmpeg &> /dev/null; then
    echo "错误: 未检测到 FFmpeg，请先安装："
    echo "  Ubuntu/Debian: sudo apt install ffmpeg"
    echo "  CentOS/RHEL: sudo yum install ffmpeg"
    echo "  macOS: brew install ffmpeg"
    exit 1
fi

echo "开始推流..."
echo "日志文件: ${LOG_FILE}"
echo "按 Ctrl+C 停止推流"
echo ""

# 主推流命令
ffmpeg \
  -fflags nobuffer \
  -flags low_delay \
  -analyzeduration 1000000 \
  -probesize 1000000 \
  -i "${MJPEG_SOURCE}" \
  -c:v libx264 \
  -preset ultrafast \
  -tune zerolatency \
  -b:v ${VIDEO_BITRATE} \
  -maxrate ${MAX_BITRATE} \
  -bufsize ${BUFFER_SIZE} \
  -pix_fmt yuv420p \
  -g ${GOP_SIZE} \
  -keyint_min ${GOP_SIZE} \
  -sc_threshold 0 \
  -r ${FRAMERATE} \
  -f flv \
  -flvflags no_duration_filesize \
  "${RTMP_TARGET}" \
  2>&1 | tee -a "${LOG_FILE}"

# 如果推流异常退出
echo ""
echo "推流已停止"
echo "退出代码: $?"

