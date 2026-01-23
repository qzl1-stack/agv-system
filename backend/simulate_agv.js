const WebSocket = require('ws');
const os = require('os');

// 智能检测运行环境
// 如果在本地服务器上运行，使用 localhost
// 如果从远程调用，使用公网 IP
function getServerAddress() {
    // 优先级 1：环境变量
    if (process.env.AGV_SERVER_HOST) {
        return {
            host: process.env.AGV_SERVER_HOST,
            port: process.env.AGV_SERVER_PORT || 3000
        };
    }
    
    // 优先级 2：检测是否为本地回环地址
    const interfaces = os.networkInterfaces();
    const isLocalOnly = Object.values(interfaces).flat()
        .every(addr => addr.family === 'IPv4' && (addr.address === '127.0.0.1' || addr.address === 'localhost'));
    
    // 优先级 3：默认策略
    // 如果运行在 AGV_LOCAL_MODE=true，使用本地地址
    // 否则使用公网 IP
    if (process.env.AGV_LOCAL_MODE === 'true' || process.argv.includes('--local')) {
        return {
            host: 'localhost',
            port: 3000
        };
    }
    
    // 默认使用公网 IP
    return {
        host: '34.67.204.128',
        port: 3000
    };
}

const serverAddr = getServerAddress();
const primaryUrl = `ws://${serverAddr.host}:${serverAddr.port}`;
const fallbackUrl = `ws://localhost:${serverAddr.port}`;

function createWebSocket(url) {
    return new WebSocket(url, { handshakeTimeout: 5000 });
}

let ws = createWebSocket(primaryUrl);

console.log(`🚀 AGV 模拟器启动`);
console.log(`📡 连接服务器: ${primaryUrl}`);

// 模拟 5 台 AGV
const AGV_CONFIGS = [
    { id: "AGV_001", radius: 5, center: { x: 10, y: 10 }, speed: 0.1, anomalyRate: 0.05 },
    { id: "AGV_002", radius: 4, center: { x: 20, y: 15 }, speed: 0.08, anomalyRate: 0.03 },
    { id: "AGV_003", radius: 6, center: { x: 15, y: 20 }, speed: 0.12, anomalyRate: 0.07 },
    { id: "AGV_004", radius: 3, center: { x: 25, y: 10 }, speed: 0.09, anomalyRate: 0.04 },
    { id: "AGV_005", radius: 5, center: { x: 30, y: 25 }, speed: 0.11, anomalyRate: 0.06 }
];

const agvStates = AGV_CONFIGS.map(config => ({
    ...config,
    angle: Math.random() * 2 * Math.PI // 随机初始角度
}));

ws.on('open', () => {
    console.log('已连接到后端');
    startSending();
});

ws.on('error', (err) => {
    const code = err && err.code ? err.code : '';
    const msg = err && err.message ? String(err.message) : '';
    console.error('WS 错误:', err);

    // 兜底：当脚本运行在服务端本机时，访问自身公网 IP 常因安全组/防火墙/hairpin
    // NAT 导致超时或拒绝，自动回退到 localhost，避免误判为后端没启动。
    const shouldFallback =
        primaryUrl !== fallbackUrl &&
        (
            code === 'ETIMEDOUT' ||
            code === 'ECONNREFUSED' ||
            code === 'EHOSTUNREACH' ||
            msg.includes('Opening handshake has timed out') ||
            msg.includes('handshake') && msg.includes('timed out')
        );
    if (!shouldFallback) {
        return;
    }

    console.log(`🧠 尝试回退连接: ${fallbackUrl}`);
    ws = createWebSocket(fallbackUrl);
    ws.on('open', () => {
        console.log('已连接到后端 (fallback: localhost)');
        startSending();
    });
    ws.on('error', (e) => console.error('WS 错误 (fallback):', e));
});

function startSending() {
    setInterval(() => {
        agvStates.forEach(agv => {
            // 模拟 AGV 做圆周运动
            agv.angle += agv.speed;
            const x = agv.center.x + agv.radius * Math.cos(agv.angle);
            const y = agv.center.y + agv.radius * Math.sin(agv.angle);

            // 模拟轻微偏差
            const deviation = (Math.random() - 0.5) * 0.2; // +/- 0.1m 随机噪声
            // 根据各 AGV 的异常率注入大偏差
            const isAnomaly = Math.random() > (1 - agv.anomalyRate);
            const current_x = isAnomaly ? x + 0.8 : x + deviation;
            const current_y = y + deviation;

            const frame = {
                id: agv.id,
                timestamp: Date.now() / 1000,
                position: { x: current_x, y: current_y, theta: agv.angle * 180 / Math.PI },
                guidance: { nav_x: x, nav_y: y, nav_theta: agv.angle * 180 / Math.PI },
                LeftWheel: { left_set: 1.0, left_actual: 1.0 }, // 正常
                RightWheel: { right_set: 1.0, right_actual: 0.99 },
                barcode: { value: Math.random() > 0.98 ? -1 : 12345 } // 偶尔的条码坏值
            };

            ws.send(JSON.stringify(frame));
            if (isAnomaly) {
                console.log(`[${agv.id}] 发送帧 (异常: true)`);
            }
        });
    }, 5000); // 每5秒发送所有 AGV 的数据
}
