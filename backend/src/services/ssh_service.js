/**
 * @file ssh_service.js
 * @description SSH 连接管理服务，封装 ssh2 库的连接、SFTP 操作、命令执行功能
 */

const { Client } = require('ssh2');
const path = require('path');

// 存储活跃的 SSH 连接会话
const active_sessions = new Map();

/**
 * 生成唯一的会话 ID
 * @returns {string} 会话 ID
 */
function GenerateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 建立 SSH 连接
 * @param {Object} config - 连接配置
 * @param {string} config.host - 主机地址
 * @param {number} config.port - SSH 端口
 * @param {string} config.username - 用户名
 * @param {string} [config.password] - 密码
 * @param {string} [config.privateKey] - 私钥内容
 * @returns {Promise<string>} 会话 ID
 */
async function Connect(config) {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        const session_id = GenerateSessionId();
        let connection_timeout = null;
        let is_resolved = false;

        // 设置连接超时（30秒）
        connection_timeout = setTimeout(() => {
            if (!is_resolved) {
                is_resolved = true;
                conn.end();
                reject(new Error('连接超时：无法在30秒内建立连接，请检查网络和目标主机状态'));
            }
        }, 30000);

        conn.on('ready', () => {
            if (is_resolved) return;
            is_resolved = true;
            clearTimeout(connection_timeout);
            
            console.log(`[SSH] 连接成功: ${config.host}:${config.port}, 会话: ${session_id}`);
            active_sessions.set(session_id, {
                connection: conn,
                host: config.host,
                port: config.port,
                username: config.username,
                connected_at: new Date(),
                sftp_client: null,  // 缓存 SFTP 客户端，复用以避免频繁创建通道
                sftp_creating: false  // 标记是否正在创建 SFTP 客户端
            });
            resolve(session_id);
        });

        conn.on('error', (err) => {
            if (is_resolved) return;
            is_resolved = true;
            clearTimeout(connection_timeout);
            
            console.error(`[SSH] 连接错误: ${err.message}`);
            console.error(`[SSH] 完整错误对象:`, err);
            
            // 提供更详细的错误信息
            let error_message = '';
            if (err.message.includes('Connection lost before handshake')) {
                error_message = '连接在握手阶段丢失。可能原因：\n' +
                    '1. 目标主机的SSH服务未运行\n' +
                    '2. 防火墙阻止了连接\n' +
                    '3. IP地址或端口配置错误\n' +
                    '4. 网络不稳定或延迟过高';
            } else if (err.message.includes('Authentication failed') || err.message.includes('All configured authentication methods failed')) {
                error_message = '身份验证失败：\n' +
                    '1. 用户名或密码可能错误\n' +
                    '2. SSH服务器不支持密码认证\n' +
                    '3. 密码中包含特殊字符时需要特殊处理\n\n' +
                    '请验证：\n' +
                    `- 主机: ${config.host}:${config.port || 22}\n` +
                    `- 用户: ${config.username}\n` +
                    '- 密码是否正确\n\n' +
                    '💡 提示：在命令行测试连接\n' +
                    `ssh -p ${config.port || 22} ${config.username}@${config.host}`;
            } else if (err.message.includes('ENOTFOUND')) {
                error_message = '主机名解析失败：无法找到目标主机';
            } else if (err.message.includes('ECONNREFUSED')) {
                error_message = '连接被拒绝：目标端口未开放或SSH服务未运行';
            } else if (err.message.includes('ETIMEDOUT')) {
                error_message = '连接超时：网络不通或防火墙阻止';
            } else {
                error_message = `SSH 连接失败: ${err.message}`;
            }
            
            reject(new Error(error_message));
        });

        conn.on('close', () => {
            if (!is_resolved) {
                is_resolved = true;
                clearTimeout(connection_timeout);
                reject(new Error('连接在建立前被关闭，请检查SSH服务配置'));
            }
        });

        conn.on('end', () => {
            if (!is_resolved) {
                is_resolved = true;
                clearTimeout(connection_timeout);
                reject(new Error('连接在完成握手前被终止'));
            }
        });

        // SSH 连接选项配置
        const connect_options = {
            host: config.host,
            port: config.port || 22,
            username: config.username,
            readyTimeout: 30000,  // 增加到30秒
            keepaliveInterval: 10000,  // 每10秒发送keepalive
            keepaliveCountMax: 3,  // 最多3次失败后断开
            // 兼容旧版SSH服务器的算法配置
            algorithms: {
                kex: [
                    'ecdh-sha2-nistp256',
                    'ecdh-sha2-nistp384',
                    'ecdh-sha2-nistp521',
                    'diffie-hellman-group-exchange-sha256',
                    'diffie-hellman-group14-sha256',
                    'diffie-hellman-group14-sha1',
                    'diffie-hellman-group1-sha1'
                ],
                cipher: [
                    'aes128-ctr',
                    'aes192-ctr',
                    'aes256-ctr',
                    'aes128-gcm',
                    'aes128-gcm@openssh.com',
                    'aes256-gcm',
                    'aes256-gcm@openssh.com',
                    'aes128-cbc',
                    'aes192-cbc',
                    'aes256-cbc',
                    '3des-cbc'
                ],
                serverHostKey: [
                    'ssh-rsa',
                    'ecdsa-sha2-nistp256',
                    'ecdsa-sha2-nistp384',
                    'ecdsa-sha2-nistp521',
                    'ssh-ed25519'
                ],
                hmac: [
                    'hmac-sha2-256',
                    'hmac-sha2-512',
                    'hmac-sha1'
                ]
            },
            debug: (msg) => {
                console.log(`[SSH Debug] ${msg}`);
            }
        };

        if (config.password) {
            connect_options.password = config.password;
        } else if (config.privateKey) {
            connect_options.privateKey = config.privateKey;
        }

        console.log(`[SSH] 尝试连接: ${config.username}@${config.host}:${config.port || 22}`);
        
        try {
            conn.connect(connect_options);
        } catch (err) {
            if (!is_resolved) {
                is_resolved = true;
                clearTimeout(connection_timeout);
                reject(new Error(`连接初始化失败: ${err.message}`));
            }
        }
    });
}

/**
 * 断开 SSH 连接
 * @param {string} session_id - 会话 ID
 * @returns {boolean} 是否成功断开
 */
function Disconnect(session_id) {
    const session = active_sessions.get(session_id);
    if (!session) {
        return false;
    }

    try {
        // 先清理 SFTP 客户端
        if (session.sftp_client) {
            try {
                session.sftp_client.end();
                console.log(`[SSH] SFTP 客户端已关闭: ${session_id}`);
            } catch (sftpErr) {
                console.error(`[SSH] 关闭 SFTP 客户端错误: ${sftpErr.message}`);
            }
            session.sftp_client = null;
        }
        
        // 关闭 SSH 连接
        session.connection.end();
        active_sessions.delete(session_id);
        console.log(`[SSH] 已断开会话: ${session_id}`);
        return true;
    } catch (err) {
        console.error(`[SSH] 断开连接错误: ${err.message}`);
        // 即使出错也删除会话记录
        active_sessions.delete(session_id);
        return false;
    }
}

/**
 * 获取 SFTP 客户端（带缓存和复用机制）
 * @param {string} session_id - 会话 ID
 * @returns {Promise<Object>} SFTP 客户端
 */
async function GetSftpClient(session_id) {
    const session = active_sessions.get(session_id);
    if (!session) {
        throw new Error('会话不存在或已断开');
    }

    // 如果已有缓存的 SFTP 客户端，直接返回
    if (session.sftp_client) {
        console.log(`[SSH] 复用已缓存的 SFTP 客户端: ${session_id}`);
        return session.sftp_client;
    }

    // 如果正在创建 SFTP 客户端，等待创建完成
    if (session.sftp_creating) {
        console.log(`[SSH] 等待 SFTP 客户端创建完成: ${session_id}`);
        // 轮询等待，最多等待 10 秒
        for (let i = 0; i < 100; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (session.sftp_client) {
                return session.sftp_client;
            }
            if (!session.sftp_creating) {
                // 创建失败，重新尝试
                break;
            }
        }
    }

    // 创建新的 SFTP 客户端
    session.sftp_creating = true;
    
    try {
        const sftp = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                session.sftp_creating = false;
                reject(new Error('SFTP 初始化超时（15秒）'));
            }, 15000);

            session.connection.sftp((err, sftp_instance) => {
                clearTimeout(timeout);
                if (err) {
                    session.sftp_creating = false;
                    
                    let error_msg = `SFTP 初始化失败: ${err.message}`;
                    
                    // 提供更详细的错误信息和解决方案
                    if (err.message.includes('Channel open failure') || err.message.includes('open failed')) {
                        error_msg = '无法打开 SFTP 通道。可能原因：\n' +
                            '1. SSH 服务器的 SFTP 子系统未启用或配置错误\n' +
                            '2. SSH 服务器资源不足或达到最大通道限制\n' +
                            '3. 之前的连接未正确关闭，请尝试断开并重新连接\n\n' +
                            '解决方法：\n' +
                            '• 检查服务器 /etc/ssh/sshd_config 中的 Subsystem sftp 配置\n' +
                            '• 重启目标设备的 SSH 服务\n' +
                            '• 断开当前连接后重新连接';
                    } else if (err.message.includes('Handshake failed')) {
                        error_msg = 'SSH 连接已失效，请断开并重新连接';
                    }
                    
                    reject(new Error(error_msg));
                } else {
                    // 缓存 SFTP 客户端
                    session.sftp_client = sftp_instance;
                    session.sftp_creating = false;
                    console.log(`[SSH] SFTP 客户端创建成功并已缓存: ${session_id}`);
                    resolve(sftp_instance);
                }
            });
        });

        return sftp;
    } catch (err) {
        session.sftp_creating = false;
        throw err;
    }
}

/**
 * 列出远程目录内容
 * @param {string} session_id - 会话 ID
 * @param {string} remote_path - 远程路径
 * @returns {Promise<Array>} 目录列表
 */
async function ListDirectory(session_id, remote_path) {
    const sftp = await GetSftpClient(session_id);

    return new Promise((resolve, reject) => {
        sftp.readdir(remote_path, (err, list) => {
            if (err) {
                reject(new Error(`读取目录失败: ${err.message}`));
            } else {
                const formatted_list = list.map(item => {
                    const is_directory = item.attrs.isDirectory();
                    const is_file = item.attrs.isFile();
                    
                    return {
                        name: item.filename,
                        path: path.posix.join(remote_path, item.filename),
                        type: is_directory ? 'directory' : 'file',  // 前端期望的格式
                        is_directory: is_directory,  // 保留原始字段
                        is_file: is_file,
                        size: item.attrs.size,
                        modifyTime: new Date(item.attrs.mtime * 1000).toISOString(),  // 前端期望的字段名
                        modified_time: new Date(item.attrs.mtime * 1000).toISOString(),  // 保留原始字段名
                        permissions: item.attrs.mode
                    };
                });

                // 按目录在前、文件在后排序
                formatted_list.sort((a, b) => {
                    if (a.is_directory && !b.is_directory) return -1;
                    if (!a.is_directory && b.is_directory) return 1;
                    return a.name.localeCompare(b.name);
                });

                resolve(formatted_list);
            }
        });
    });
}

/**
 * 读取远程文件内容
 * @param {string} session_id - 会话 ID
 * @param {string} remote_path - 远程文件路径
 * @returns {Promise<string>} 文件内容
 */
async function ReadFile(session_id, remote_path) {
    const sftp = await GetSftpClient(session_id);

    // 首先检查路径是文件还是目录
    return new Promise((resolve, reject) => {
        sftp.stat(remote_path, (statErr, stats) => {
            if (statErr) {
                reject(new Error(`无法访问路径: ${statErr.message}`));
                return;
            }

            // 如果是目录，返回错误
            if (stats.isDirectory()) {
                reject(new Error('无法读取目录，请选择文件或双击进入目录'));
                return;
            }

            // 检查文件大小，避免读取过大的文件
            const max_file_size = 10 * 1024 * 1024; // 10MB
            if (stats.size > max_file_size) {
                reject(new Error(`文件过大 (${(stats.size / 1024 / 1024).toFixed(2)} MB)，仅支持 10MB 以下的文件`));
                return;
            }

            // 读取文件内容
            sftp.readFile(remote_path, (err, data) => {
                if (err) {
                    reject(new Error(`读取文件失败: ${err.message}`));
                } else {
                    try {
                        // 尝试以 UTF-8 解码
                        const content = data.toString('utf-8');
                        resolve(content);
                    } catch (decodeErr) {
                        reject(new Error('文件可能是二进制文件，无法以文本格式显示'));
                    }
                }
            });
        });
    });
}

/**
 * 写入远程文件内容
 * @param {string} session_id - 会话 ID
 * @param {string} remote_path - 远程文件路径
 * @param {string} content - 文件内容
 * @returns {Promise<void>}
 */
async function WriteFile(session_id, remote_path, content) {
    const sftp = await GetSftpClient(session_id);

    return new Promise((resolve, reject) => {
        sftp.writeFile(remote_path, content, (err) => {
            if (err) {
                reject(new Error(`写入文件失败: ${err.message}`));
            } else {
                console.log(`[SSH] 文件已写入: ${remote_path}`);
                resolve();
            }
        });
    });
}

/**
 * 执行远程命令
 * @param {string} session_id - 会话 ID
 * @param {string} command - 要执行的命令
 * @returns {Promise<Object>} 执行结果 { stdout, stderr, exitCode }
 */
async function ExecuteCommand(session_id, command) {
    const session = active_sessions.get(session_id);
    if (!session) {
        throw new Error('会话不存在或已断开');
    }

    return new Promise((resolve, reject) => {
        session.connection.exec(command, (err, stream) => {
            if (err) {
                reject(new Error(`命令执行失败: ${err.message}`));
                return;
            }

            let stdout = '';
            let stderr = '';

            stream.on('close', (code) => {
                resolve({
                    stdout: stdout,
                    stderr: stderr,
                    exit_code: code
                });
            });

            stream.on('data', (data) => {
                stdout += data.toString();
            });

            stream.stderr.on('data', (data) => {
                stderr += data.toString();
            });
        });
    });
}

/**
 * 获取所有活跃会话信息
 * @returns {Array} 会话列表
 */
function GetActiveSessions() {
    const sessions = [];
    active_sessions.forEach((session, id) => {
        sessions.push({
            session_id: id,
            host: session.host,
            port: session.port,
            username: session.username,
            connected_at: session.connected_at
        });
    });
    return sessions;
}

/**
 * 检查会话是否存在
 * @param {string} session_id - 会话 ID
 * @returns {boolean}
 */
function HasSession(session_id) {
    return active_sessions.has(session_id);
}

module.exports = {
    Connect,
    Disconnect,
    ListDirectory,
    ReadFile,
    WriteFile,
    ExecuteCommand,
    GetActiveSessions,
    HasSession
};
