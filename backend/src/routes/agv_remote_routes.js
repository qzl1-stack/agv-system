/**
 * @file agv_remote_routes.js
 * @description AGV 远程管理 API 路由
 */

const express = require('express');
const router = express.Router();
const ssh_service = require('../services/ssh_service');

function NormalizeSshHost(host) {
    const raw_host = (host || '').trim();
    if (!raw_host) {
        return raw_host;
    }

    // 注意：该接口在后端容器里执行 SSH 连接。
    // 用户填写 localhost/127.0.0.1 时，通常期望连接到“宿主机”而非容器自身。
    // 这里将其映射到 host.docker.internal（docker-compose 中通过 host-gateway 提供）。
    if (raw_host === 'localhost' || raw_host === '127.0.0.1' || raw_host === '::1') {
        return 'host.docker.internal';
    }

    return raw_host;
}

/**
 * @route POST /api/agv-remote/connect
 * @description 建立 SSH 连接
 * @body {host, port, username, password?, privateKey?}
 */
router.post('/connect', async (req, res) => {
    try {
        const { host, port, username, password, privateKey } = req.body;

        if (!host || !username) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: host, username'
            });
        }

        if (!password && !privateKey) {
            return res.status(400).json({
                success: false,
                error: '需要提供 password 或 privateKey'
            });
        }

        const normalized_host = NormalizeSshHost(host);

        const session_id = await ssh_service.Connect({
            host: normalized_host,
            port: port || 22,
            username,
            password,
            privateKey
        });

        res.json({
            success: true,
            session_id: session_id,
            message: `已连接到 ${host}:${port || 22}`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/agv-remote/disconnect
 * @description 断开 SSH 连接
 * @body {session_id}
 */
router.post('/disconnect', (req, res) => {
    try {
        const { session_id } = req.body;

        if (!session_id) {
            return res.status(400).json({
                success: false,
                error: '缺少 session_id'
            });
        }

        const result = ssh_service.Disconnect(session_id);

        if (result) {
            res.json({
                success: true,
                message: '连接已断开'
            });
        } else {
            res.status(404).json({
                success: false,
                error: '会话不存在'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/agv-remote/sessions
 * @description 获取所有活跃会话
 */
router.get('/sessions', (req, res) => {
    try {
        const sessions = ssh_service.GetActiveSessions();
        res.json({
            success: true,
            sessions: sessions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/agv-remote/files
 * @description 列出远程目录内容
 * @query {session_id, path}
 */
router.get('/files', async (req, res) => {
    try {
        const { session_id, path: remote_path } = req.query;

        if (!session_id || !remote_path) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: session_id, path'
            });
        }

        if (!ssh_service.HasSession(session_id)) {
            return res.status(404).json({
                success: false,
                error: '会话不存在或已断开'
            });
        }

        const files = await ssh_service.ListDirectory(session_id, remote_path);
        res.json({
            success: true,
            path: remote_path,
            files: files
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/agv-remote/file
 * @description 读取远程文件内容
 * @query {session_id, path}
 */
router.get('/file', async (req, res) => {
    try {
        const { session_id, path: remote_path } = req.query;

        if (!session_id || !remote_path) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: session_id, path'
            });
        }

        if (!ssh_service.HasSession(session_id)) {
            return res.status(404).json({
                success: false,
                error: '会话不存在或已断开'
            });
        }

        const content = await ssh_service.ReadFile(session_id, remote_path);
        res.json({
            success: true,
            path: remote_path,
            content: content
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route PUT /api/agv-remote/file
 * @description 写入远程文件内容
 * @body {session_id, path, content}
 */
router.put('/file', async (req, res) => {
    try {
        const { session_id, path: remote_path, content } = req.body;

        if (!session_id || !remote_path || content === undefined) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: session_id, path, content'
            });
        }

        if (!ssh_service.HasSession(session_id)) {
            return res.status(404).json({
                success: false,
                error: '会话不存在或已断开'
            });
        }

        await ssh_service.WriteFile(session_id, remote_path, content);
        res.json({
            success: true,
            message: `文件已保存: ${remote_path}`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/agv-remote/ota
 * @description 触发 OTA 升级
 * @body {session_id, script_path?, command?}
 */
router.post('/ota', async (req, res) => {
    try {
        const { session_id, script_path, command } = req.body;

        if (!session_id) {
            return res.status(400).json({
                success: false,
                error: '缺少 session_id'
            });
        }

        if (!ssh_service.HasSession(session_id)) {
            return res.status(404).json({
                success: false,
                error: '会话不存在或已断开'
            });
        }

        // 默认 OTA 脚本路径
        const ota_command = command || `sudo ${script_path || '/usr/local/bin/run_ota.sh'}`;

        console.log(`[OTA] 执行命令: ${ota_command}`);
        const result = await ssh_service.ExecuteCommand(session_id, ota_command);

        res.json({
            success: result.exit_code === 0,
            command: ota_command,
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/agv-remote/exec
 * @description 执行任意远程命令
 * @body {session_id, command}
 */
router.post('/exec', async (req, res) => {
    try {
        const { session_id, command } = req.body;

        if (!session_id || !command) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: session_id, command'
            });
        }

        if (!ssh_service.HasSession(session_id)) {
            return res.status(404).json({
                success: false,
                error: '会话不存在或已断开'
            });
        }

        const result = await ssh_service.ExecuteCommand(session_id, command);
        res.json({
            success: true,
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
