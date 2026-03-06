# WebRTC 连接问题排查指南

## 问题症状

浏览器控制台显示：
```
[WebRTC] 连接状态: connecting
[WebRTC] ICE 连接状态: disconnected
[WebRTC] 连接状态: failed
[WebRTC] 连接失败，尝试降级到 HLS/MJPEG
```

## 根本原因分析

| 错误信息 | 可能原因 | 解决方案 |
|---------|---------|---------|
| `ICE 连接状态: disconnected` | STUN 服务器无法访问 或 NAT 穿透失败 | 检查网络、防火墙 UDP 设置 |
| `连接状态: failed` | MediaMTX 服务未运行 或 WHEP 端点无响应 | 重启 MediaMTX 容器 |
| `网络请求失败` | CORS 配置错误 或 端口未开放 | 检查 MediaMTX 配置 |
| `流列表中无 agv_camera` | 没有推流源 | 启动摄像头推流程序 |

## 快速诊断

### 第 1 步：检查 MediaMTX 容器是否运行

```bash
docker-compose ps mediamtx
```

输出应该显示 `Up` 且状态为 `healthy` 或 `running`：
```
NAME                 STATE
agv-system_mediamtx_1   Up (healthy)
```

### 第 2 步：运行诊断脚本

```bash
cd /www/wwwroot/agv-system
bash deployment/diagnose-webrtc.sh
```

检查输出中是否有 ❌ 的项目。

### 第 3 步：检查浏览器控制台

1. 打开浏览器开发者工具（F12）
2. 进入 Console 标签
3. 查看 `[WebRTC]` 开头的日志，寻找具体错误
4. 进入 Network 标签，搜索 `whep`，检查 WHEP 请求状态

## 常见解决方案

### 场景 1：MediaMTX 容器未运行或不健康

```bash
# 重启 MediaMTX
docker-compose restart mediamtx

# 等待 10 秒让容器完全启动
sleep 10

# 验证状态
docker-compose ps mediamtx
```

### 场景 2：MediaMTX 进程已停止

强制重新创建容器：

```bash
cd /www/wwwroot/agv-system

# 停止 MediaMTX
docker-compose stop mediamtx

# 删除容器
docker-compose rm -f mediamtx

# 重新创建并启动（使用延长超时）
COMPOSE_HTTP_TIMEOUT=180 docker-compose up -d mediamtx

# 等待完全启动
sleep 15

# 检查状态
bash deployment/diagnose-webrtc.sh
```

### 场景 3：API 端口无响应

MediaMTX 可能配置有问题：

```bash
# 查看容器日志
docker logs --tail=100 agv-system_mediamtx_1

# 检查配置文件
cat deployment/mediamtx-fixed.yml

# 重新构建镜像（如果日志显示启动错误）
docker-compose up -d --build mediamtx
```

### 场景 4：HLS/MJPEG 也无法工作

这说明是网络连接问题，而非 WebRTC 特定问题：

1. **检查防火墙：** 确保允许 UDP 通信
   ```bash
   # 在 Linux 上（如果使用 ufw）
   sudo ufw allow 8000:9000/udp
   ```

2. **检查网络连接：** 确认可以访问 MediaMTX
   ```bash
   # 测试 HTTP 连接
   curl -v http://localhost:9997/v1/config/get
   
   # 测试端口开放
   nc -zv localhost 8889
   nc -zv localhost 8888
   ```

3. **查看 MediaMTX 日志：** 查找启动错误
   ```bash
   docker logs -f agv-system_mediamtx_1
   ```

### 场景 5：确实需要推流源

如果诊断脚本显示 "未找到 agv_camera 流"，需要启动推流源：

```bash
# 示例：使用 ffmpeg 推流（假设有本地摄像头）
ffmpeg -f dshow -i video="Your Camera Name" \
  -f flv rtmp://localhost:1935/agv_camera

# 或使用 GStreamer
gst-launch-1.0 -v v4l2src device=/dev/video0 ! \
  queue ! videoconvert ! x264enc ! flvmux ! \
  rtmpsink location="rtmp://localhost:1935/agv_camera"
```

## 调试步骤

### 启用详细日志

修改 `deployment/mediamtx-fixed.yml`：

```yaml
logLevel: debug  # 改为 debug
logDestinations: [stdout, /var/log/mediamtx.log]
```

然后重启：
```bash
docker-compose restart mediamtx
docker logs -f agv-system_mediamtx_1
```

### 在浏览器中启用更多日志

在 `Agv3DModel.vue` 已添加详细的 WebRTC 日志。查看以下输出：

- `[WebRTC] Offer SDP:` - 本地 SDP
- `[WebRTC] ICE 候选项发现:` - NAT 穿透候选项
- `[WebRTC] 连接 WHEP 端点:` - 实际请求的 URL
- `[WebRTC] 错误响应:` - WHEP 服务器返回的错误

## 完整排查流程

```bash
#!/bin/bash

echo "=== WebRTC 完整诊断和修复 ==="

# 1. 检查 Docker
echo "1. 检查 Docker..."
docker version > /dev/null || { echo "❌ Docker 未运行"; exit 1; }

# 2. 诊断当前状态
echo "2. 运行诊断..."
cd /www/wwwroot/agv-system
bash deployment/diagnose-webrtc.sh

# 3. 如果有问题，自动修复
echo "3. 修复建议："
docker-compose ps mediamtx | grep -q "unhealthy" && {
  echo "   检测到不健康的容器，正在修复..."
  docker-compose stop mediamtx
  docker-compose rm -f mediamtx
  COMPOSE_HTTP_TIMEOUT=180 docker-compose up -d mediamtx
  sleep 15
  echo "   修复完成，重新诊断..."
  bash deployment/diagnose-webrtc.sh
}

echo "=== 诊断完成 ==="
```

## 如果以上都不行

1. **检查系统日志：**
   ```bash
   journalctl -xe | tail -50
   docker system df  # 检查磁盘空间
   ```

2. **清理和重建：**
   ```bash
   docker-compose down -v
   docker system prune -a
   COMPOSE_HTTP_TIMEOUT=180 docker-compose up -d
   ```

3. **使用 HLS 作为备选方案：**
   - WebRTC 失败时，自动降级到 HLS
   - HLS 延迟较高（2-5 秒），但兼容性更好

4. **收集日志用于技术支持：**
   ```bash
   # 保存诊断信息
   {
     echo "=== 容器状态 ==="
     docker-compose ps
     echo ""
     echo "=== MediaMTX 日志 ==="
     docker logs --tail=100 agv-system_mediamtx_1
     echo ""
     echo "=== 诊断脚本输出 ==="
     bash deployment/diagnose-webrtc.sh
   } > /tmp/webrtc-diagnosis.txt
   
   # 分享 /tmp/webrtc-diagnosis.txt
   ```

## 相关端口

| 服务 | 端口 | 协议 | 用途 |
|------|------|------|------|
| RTMP | 1935 | TCP | 推流（接收摄像头） |
| RTSP | 8554 | TCP | 实时传输 |
| **WebRTC (WHEP)** | **8889** | **TCP + UDP** | **WebRTC 连接** |
| HLS | 8888 | TCP | HTTP 直播 |
| API | 9997 | TCP | 管理接口 |
| ICE | 8189 | TCP | NAT 穿透 |
| 媒体 | 8000-9000 | UDP | WebRTC 媒体 |

## 参考资源

- [MediaMTX 官方文档](https://github.com/bluenviron/mediamtx)
- [WebRTC 规范](https://www.w3.org/TR/webrtc/)
- [WHEP 规范](https://datatracker.ietf.org/doc/draft-murillo-whep/)

---

**最后更新：2026-03-06**  
**自动诊断脚本：** `deployment/diagnose-webrtc.sh`  
**修复工具：** `deployment/fix-mediamtx.sh`
