/**
 * @file ssh_logger.js
 * @description SSH 请求日志中间件
 * 记录所有 SSH 相关的 API 请求日志
 */

function sshLogger(req, res, next) {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const path = req.path;
    const url = req.url;
    
    // 记录 SSH 相关请求
    if (path.includes('agv-remote')) {
        console.log('');
        console.log(`[${timestamp}] 🔐 SSH 请求日志`);
        console.log(`   方法: ${method}`);
        console.log(`   路径: ${path}`);
        console.log(`   完整URL: ${url}`);
        
        // 如果有请求体，记录关键信息（不记录敏感信息如密码）
        if (req.body && Object.keys(req.body).length > 0) {
            const sanitizedBody = { ...req.body };
            // 隐藏敏感信息
            if (sanitizedBody.password) {
                sanitizedBody.password = '***';
            }
            if (sanitizedBody.privateKey) {
                sanitizedBody.privateKey = '***';
            }
            console.log(`   请求体: ${JSON.stringify(sanitizedBody, null, 2)}`);
        }
        
        // 拦截响应，记录状态码
        const originalSend = res.send;
        res.send = function(data) {
            console.log(`   📤 SSH 响应状态码: ${res.statusCode}`);
            console.log('');
            return originalSend.call(this, data);
        };
    }
    
    next();
}

module.exports = sshLogger;
