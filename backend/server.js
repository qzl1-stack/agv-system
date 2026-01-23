const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { redisPub, redisSub, connect } = require('./src/services/redis_client');
const agvRemoteRoutes = require('./src/routes/agv_remote_routes');
const sshLogger = require('./src/middleware/ssh_logger');
const requestLogger = require('./src/middleware/request_logger');

function LoadEnvFile(file_path) {
    try {
        if (!fs.existsSync(file_path)) {
            return;
        }
        const content = fs.readFileSync(file_path, 'utf-8');
        for (const raw_line of content.split(/\r?\n/)) {
            const line = raw_line.trim();
            if (!line || line.startsWith('#')) {
                continue;
            }
            const eq_idx = line.indexOf('=');
            if (eq_idx <= 0) {
                continue;
            }
            const key = line.slice(0, eq_idx).trim();
            const value = line.slice(eq_idx + 1).trim();
            if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
                continue;
            }
            process.env[key] = value;
        }
    } catch (e) {
        // ignore
    }
}

// 优先加载 backend/env（无点文件，便于在受限环境下创建）
LoadEnvFile(path.join(__dirname, 'env'));

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;
const RAW_QUEUE_KEY = 'agv:raw_queue';
const ALERT_CHANNEL = 'agv:alert_channel';
const SSE_DEBUG_LOG =
    process.env.SSE_DEBUG_LOG ||
    path.join(__dirname, 'logs', 'sse_forward.log');

function AppendSseDebugLog(line) {
    try {
        fs.mkdirSync(path.dirname(SSE_DEBUG_LOG), { recursive: true });
        fs.appendFileSync(SSE_DEBUG_LOG, `${new Date().toISOString()} ${line}\n`);
    } catch (e) {
        // ignore
    }
}

// JSON Body Parser 中间件
app.use(express.json());

// 全局请求日志（用于调试）
app.use(requestLogger);

// SSH日志中间件（用于调试）
app.use('/api/agv-remote', sshLogger);

// 挂载 AGV 远程管理路由
app.use('/api/agv-remote', agvRemoteRoutes);

// Connect to Redis
connect();


// SSE 客户端连接池
let sseClients = [];
// 最近告警缓存：用于新 SSE 客户端首次连接时回放，避免页面长时间空白
const MAX_RECENT_ALERTS = 50;
let recentAlerts = [];

// SSE 处理函数
function handleSSE(req, res) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Nginx SSE：明确禁用缓冲（即便 Nginx 已配置，也再补一层）
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*'); // 开发环境允许跨域

    // 立即把响应头刷出去，避免代理等待首包
    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }

    // 先发一条注释帧，确保客户端/代理进入流式状态
    res.write(': connected\n\n');

    const clientId = Date.now();
    // 心跳：防止中间层/浏览器长时间无数据而断开
    const heartbeatTimer = setInterval(() => {
        try {
            res.write(': ping\n\n');
        } catch (e) {
            // ignore
        }
    }, 15000);

    const newClient = { id: clientId, res, heartbeatTimer };
    sseClients.push(newClient);
    console.log(`✅ SSE 客户端已连接: ${clientId}, total=${sseClients.length}`);
    AppendSseDebugLog(`SSE_CONNECT id=${clientId} ip=${req.ip} total=${sseClients.length}`);

    // 回放最近告警（最多 10 条），让前端打开即有内容
    try {
        const startIdx =
            recentAlerts.length > 10 ? recentAlerts.length - 10 : 0;
        for (let i = startIdx; i < recentAlerts.length; i++) {
            res.write(`data: ${recentAlerts[i]}\n\n`);
        }
    } catch (e) {
        console.error('⚠️ SSE 回放最近告警失败:', e.message || e);
    }

    req.on('close', () => {
        sseClients = sseClients.filter(c => c.id !== clientId);
        clearInterval(heartbeatTimer);
        console.log(`❌ SSE 客户端已断开: ${clientId}, total=${sseClients.length}`);
        AppendSseDebugLog(`SSE_CLOSE id=${clientId} total=${sseClients.length}`);
    });
}

// --- 前端 SSE 实时推送端点 ---
app.get('/api/alerts', handleSSE);
// 兼容旧路径
app.get('/alerts', handleSSE);

// --- Redis 告警订阅者 ---
redisSub.subscribe(ALERT_CHANNEL, (err, count) => {
    if (err) console.error('订阅失败: %s', err.message);
    else console.log(`已订阅 ${count} 个频道。正在监听告警...`);
});

redisSub.on('message', (channel, message) => {
    if (channel === ALERT_CHANNEL) {
        // 缓存最近告警
        recentAlerts.push(message);
        if (recentAlerts.length > MAX_RECENT_ALERTS) {
            recentAlerts.shift();
        }

        AppendSseDebugLog(`REDIS_ALERT len=${(message || '').length} sse_clients=${sseClients.length}`);
        // 广播给所有已连接的前端客户端
        if (sseClients.length > 0) {
            console.log(`📣 广播告警给 SSE 客户端: count=${sseClients.length}`);
        }
        sseClients.forEach(client => {
            try {
                client.res.write(`data: ${message}\n\n`);
            } catch (e) {
                // ignore
            }
        });
    }
});

// --- AGV 数据 WebSocket ---
wss.on('connection', (ws) => {
    console.log('✅ AGV 客户端已连接');

    ws.on('message', async (message) => {
        try {
            // 将原始数据推送到 Redis 队列，供 C++ 引擎处理
            // 使用 RPUSH 追加到列表尾部
            const result = await redisPub.rpush(RAW_QUEUE_KEY, message.toString());
            console.log(`📤 数据推送到 Redis: [${result}] items in queue`);
        } catch (error) {
            console.error('❌ 推送到 Redis 错误:', error);
            console.error('   - Redis 连接状态:', redisPub.status);
            console.error('   - 消息大小:', message.toString().length, 'bytes');
        }
    });

    ws.on('close', () => {
        console.log('❌ AGV 客户端已断开');
    });

    ws.on('error', (error) => {
        console.error('⚠️  WebSocket 错误:', error);
    });
});


// Start Server
const HOST = process.env.HOST || '0.0.0.0'; // 监听所有网络接口，允许外部访问
const PUBLIC_IP = process.env.PUBLIC_IP || '47.105.118.142';
server.listen(PORT, HOST, () => {
    console.log(`Backend Server running on ${HOST}:${PORT}`);
    console.log(`- HTTP API: http://${HOST}:${PORT}`);
    console.log(`- WebSocket: ws://${HOST}:${PORT}`);
    console.log(`- SSE Alerts: http://${HOST}:${PORT}/api/alerts`);
    console.log(`\n📡 外部访问 (公网):`);
    console.log(`- HTTP API: http://${PUBLIC_IP}:${PORT}`);
    console.log(`- WebSocket: ws://${PUBLIC_IP}:${PORT}`);
    console.log(`- SSE Alerts: http://${PUBLIC_IP}:${PORT}/api/alerts`);
});
