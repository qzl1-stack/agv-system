# 流媒体系统部署指南

本目录包含了将 MJPEG 视频流升级为支持多客户端的 WebRTC 流媒体系统所需的所有部署脚本。

## 📋 部署概览

```
本地摄像头 (MJPEG:8080)
    ↓
FFmpeg 转码 (MJPEG → H.264)
    ↓
云服务器 MediaMTX (RTMP接收)
    ↓
多个客户端 (WebRTC拉流)
```

## 🚀 快速开始

### 步骤 1: 在云服务器上部署 MediaMTX

```bash
# 1. 上传安装脚本到云服务器
scp mediamtx-install.sh root@47.105.118.142:/tmp/

# 2. SSH 登录云服务器
ssh root@47.105.118.142

# 3. 运行安装脚本
cd /tmp
chmod +x mediamtx-install.sh
sudo ./mediamtx-install.sh

# 4. 验证服务状态
sudo systemctl status mediamtx

# 5. 查看 API 端点
curl http://localhost:9997/v3/paths/list
```

### 步骤 2: 配置云服务器安全组

在阿里云/腾讯云控制台中开放以下端口：

| 端口 | 协议 | 用途 |
|------|------|------|
| 1935 | TCP | RTMP 推流 |
| 8554 | TCP | RTSP |
| 8889 | TCP | WebRTC 信令 |
| 8888 | TCP | HLS |
| 9997 | TCP | API |
| 8189 | TCP/UDP | ICE |
| 8000-9000 | UDP | WebRTC 媒体 |

### 步骤 3: 配置本地 FFmpeg 推流

```bash
# 1. 确保本地已安装 FFmpeg
ffmpeg -version

# 如果未安装：
# Ubuntu/Debian: sudo apt install ffmpeg
# CentOS/RHEL: sudo yum install ffmpeg
# macOS: brew install ffmpeg

# 2. 修改推流脚本中的服务器地址（如果需要）
nano push_stream.sh
# 修改 CLOUD_SERVER="47.105.118.142"

# 3. 赋予执行权限
chmod +x push_stream.sh

# 4. 测试推流（前台运行）
./push_stream.sh

# 5. 如果测试成功，配置为系统服务（可选）
# 修改 ffmpeg-push.service 中的路径
sudo cp ffmpeg-push.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ffmpeg-push
sudo systemctl start ffmpeg-push

# 查看推流状态
sudo systemctl status ffmpeg-push
sudo journalctl -u ffmpeg-push -f
```

### 步骤 4: 验证推流

```bash
# 在云服务器上检查是否接收到流
curl http://localhost:9997/v3/paths/list

# 预期输出应包含 agv_camera 路径，状态为 "ready"
```

## 🔧 故障排查

### 问题 1: MediaMTX 无法启动

```bash
# 查看详细日志
sudo journalctl -u mediamtx -n 100

# 常见原因：
# - 端口被占用：使用 netstat -tulpn | grep 1935 检查
# - 配置文件错误：检查 /opt/mediamtx/mediamtx.yml
```

### 问题 2: FFmpeg 推流失败

```bash
# 查看推流日志
tail -f /var/log/ffmpeg/push_stream.log

# 常见原因：
# - 本地 8080 端口无法访问：curl http://localhost:8080/?action=stream
# - 云服务器防火墙未开放 1935 端口
# - 网络连接问题：ping 47.105.118.142
```

### 问题 3: 客户端无法播放

```bash
# 检查 WebRTC 端口
curl http://47.105.118.142:8889/agv_camera/whep

# 检查 HLS 端口（备选方案）
curl http://47.105.118.142:8888/agv_camera/index.m3u8

# 查看 MediaMTX 日志
sudo journalctl -u mediamtx -f
```

## 📊 性能监控

### 查看推流统计

```bash
# MediaMTX API
curl http://47.105.118.142:9997/v3/paths/list | jq .

# 查看连接数
curl http://47.105.118.142:9997/v3/rtmpconns/list
```

### 系统资源监控

```bash
# CPU 和内存使用
htop

# 网络带宽
iftop

# FFmpeg 进程状态
ps aux | grep ffmpeg
```

## 🔄 服务管理命令

### MediaMTX 服务

```bash
# 启动
sudo systemctl start mediamtx

# 停止
sudo systemctl stop mediamtx

# 重启
sudo systemctl restart mediamtx

# 查看状态
sudo systemctl status mediamtx

# 查看日志
sudo journalctl -u mediamtx -f
```

### FFmpeg 推流服务

```bash
# 启动
sudo systemctl start ffmpeg-push

# 停止
sudo systemctl stop ffmpeg-push

# 重启
sudo systemctl restart ffmpeg-push

# 查看状态
sudo systemctl status ffmpeg-push

# 查看日志
sudo journalctl -u ffmpeg-push -f
```

## 🎯 性能优化建议

### 1. 调整视频参数

编辑 `push_stream.sh`：

```bash
# 低延迟模式（牺牲画质）
VIDEO_BITRATE="1000k"
GOP_SIZE="15"

# 高画质模式（增加延迟）
VIDEO_BITRATE="2500k"
GOP_SIZE="60"

# 平衡模式（推荐）
VIDEO_BITRATE="1500k"
GOP_SIZE="30"
```

### 2. 网络优化

```bash
# 检查网络延迟
ping -c 10 47.105.118.142

# 检查带宽
iperf3 -c 47.105.118.142
```

### 3. 服务器资源优化

```bash
# 增加文件描述符限制
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# 重启服务
sudo systemctl restart mediamtx
```

## 📝 配置文件说明

### mediamtx.yml 关键配置

- `rtmpAddress: :1935` - RTMP 推流端口
- `webrtcAddress: :8889` - WebRTC 信令端口
- `hlsAddress: :8888` - HLS 端口（备选方案）
- `paths.agv_camera` - 视频流路径名称

### push_stream.sh 关键参数

- `MJPEG_SOURCE` - 本地视频源地址
- `CLOUD_SERVER` - 云服务器 IP
- `VIDEO_BITRATE` - 视频比特率
- `GOP_SIZE` - 关键帧间隔

## 🔐 安全建议

1. **启用 RTMP 认证**（生产环境）:

```yaml
# 在 mediamtx.yml 中添加
paths:
  agv_camera:
    source: publisher
    publishUser: your_username
    publishPass: your_password
```

2. **使用 HTTPS/WSS**（生产环境）:

```yaml
webrtcServerKey: /path/to/server.key
webrtcServerCert: /path/to/server.crt
```

3. **限制 IP 访问**:

```bash
# 仅允许特定 IP 推流
sudo ufw allow from 你的本地公网IP to any port 1935
```

## 📞 技术支持

如遇到问题，请提供以下信息：

1. MediaMTX 日志: `sudo journalctl -u mediamtx -n 100`
2. FFmpeg 日志: `cat /var/log/ffmpeg/push_stream.log`
3. 网络测试: `ping 47.105.118.142` 和 `traceroute 47.105.118.142`
4. 服务状态: `sudo systemctl status mediamtx ffmpeg-push`

## 📚 相关文档

- [MediaMTX 官方文档](https://github.com/bluenviron/mediamtx)
- [FFmpeg 官方文档](https://ffmpeg.org/documentation.html)
- [WebRTC 标准](https://webrtc.org/)

