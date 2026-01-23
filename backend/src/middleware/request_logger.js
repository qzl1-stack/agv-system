/**
 * @file request_logger.js
 * @description 全局请求日志中间件
 * 捕获所有进入后端的HTTP请求
 */

function requestLogger(req, res, next) {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const path = req.path;
    const url = req.url;
    
    // 只记录agv-remote相关请求
    if (path.includes('agv-remote')) {
        console.log('');
        console.log(`[${timestamp}] 📨 收到HTTP请求`);
        console.log(`   方法: ${method}`);
        console.log(`   路径: ${path}`);
        console.log(`   完整URL: ${url}`);
        console.log(`   内容类型: ${req.get('content-type') || '未指定'}`);
        console.log(`   请求体大小: ${JSON.stringify(req.body).length} 字节`);
        
        // 拦截响应，记录状态码
        const originalSend = res.send;
        res.send = function(data) {
            console.log(`   📤 响应状态码: ${res.statusCode}`);
            console.log('');
            return originalSend.call(this, data);
        };
    }
    
    next();
}

module.exports = requestLogger;

