import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

function LoadKeyValueEnvFile(file_path) {
    try {
        if (!fs.existsSync(file_path)) {
            return {}
        }
        const content = fs.readFileSync(file_path, 'utf-8')
        const env = {}
        for (const raw_line of content.split(/\r?\n/)) {
            const line = raw_line.trim()
            if (!line || line.startsWith('#')) {
                continue
            }
            const eq_idx = line.indexOf('=')
            if (eq_idx <= 0) {
                continue
            }
            const key = line.slice(0, eq_idx).trim()
            const value = line.slice(eq_idx + 1).trim()
            if (!key) {
                continue
            }
            env[key] = value
        }
        return env
    } catch (e) {
        return {}
    }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env_file = path.resolve(process.cwd(), `env.${mode}`)
    const fallback_env_file = path.resolve(process.cwd(), 'env.development')
    const loaded_env =
        Object.keys(LoadKeyValueEnvFile(env_file)).length > 0
            ? LoadKeyValueEnvFile(env_file)
            : LoadKeyValueEnvFile(fallback_env_file)

    const api_target =
        loaded_env.VITE_API_TARGET || 'http://127.0.0.1:3000'

    return {
        plugins: [vue()],
        server: {
            host: '0.0.0.0', // 允许外部访问
            port: 5173,
            proxy: {
                '/api': {
                    target: api_target,
                    changeOrigin: true,
                    secure: false,
                    ws: true // 支持 WebSocket 代理
                }
            }
        }
    }
})
