const Redis = require('ioredis');

// 默认 Redis 配置
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// 发布者：用于发送原始帧到队列
const redisPub = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: false,  // 立即连接，不延迟
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: null,  // ioredis 6+ 需要
    enableReadyCheck: false
});

// 订阅者：用于接收规则引擎的告警
const redisSub = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: false,  // 立即连接，不延迟
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: null  // ioredis 6+ 需要
});

redisPub.on('error', (err) => console.error('❌ [Redis Pub] 错误:', err.message || err));
redisPub.on('ready', () => console.log('✅ [Redis Pub] 已连接'));
redisPub.on('connect', () => console.log('✅ [Redis Pub] 连接建立'));

redisSub.on('error', (err) => console.error('❌ [Redis Sub] 错误:', err.message || err));
redisSub.on('ready', () => console.log('✅ [Redis Sub] 已连接'));
redisSub.on('connect', () => console.log('✅ [Redis Sub] 连接建立'));

async function connect() {
    try {
        console.log(`📍 正在连接 Redis: ${REDIS_HOST}:${REDIS_PORT}`);
        
        // redisPub 立即连接（lazyConnect: false）
        // 监听连接事件
        
        // 对于 redisSub，我们需要显式订阅
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Redis 连接超时 (5s)'));
            }, 5000);
            
            // 检查连接是否已建立
            const checkConnection = () => {
                if (redisPub.status === 'ready' && redisSub.status === 'ready') {
                    clearTimeout(timeout);
                    console.log('✅ Redis 连接成功');
                    resolve();
                } else {
                    setTimeout(checkConnection, 100);
                }
            };
            
            checkConnection();
        });
    } catch (err) {
        console.error('❌ Redis 连接失败:', err.message || err);
        // 继续运行，允许重试
    }
}

module.exports = {
    redisPub,
    redisSub,
    connect
};
