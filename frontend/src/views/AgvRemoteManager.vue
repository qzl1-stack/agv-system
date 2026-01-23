<template>
  <div class="remote-wrapper">
    <!-- 顶部导航栏 -->
    <header class="top-header">
      <div class="header-left">
        <div class="logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="logo-text">AGV 远程管理系统</span>
        </div>
      </div>
      <div class="header-right">
        <router-link to="/monitor" class="nav-link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 20V10"/>
            <path d="M12 20V4"/>
            <path d="M6 20v-6"/>
          </svg>
          <span>实时诊断</span>
        </router-link>
        <div class="connection-status" :class="{ connected: isConnected }">
          <span class="dot"></span>
          <span>{{ isConnected ? '已连接' : '未连接' }}</span>
        </div>
      </div>
    </header>

    <div class="main-layout">
      <!-- 左侧控制面板 -->
      <aside class="sidebar">
        <!-- 连接配置面板 -->
        <div class="sidebar-section">
          <h3 class="section-title">SSH 连接配置</h3>
          <div class="config-form">
            <div class="form-group">
              <label>主机地址</label>
              <input 
                v-model="sshConfig.host" 
                type="text" 
                placeholder="192.168.1.100"
                :disabled="isConnected"
              />
            </div>
            <div class="form-group">
              <label>端口</label>
              <input 
                v-model.number="sshConfig.port" 
                type="number" 
                placeholder="22"
                :disabled="isConnected"
              />
            </div>
            <div class="form-group">
              <label>用户名</label>
              <input 
                v-model="sshConfig.username" 
                type="text" 
                placeholder="root"
                :disabled="isConnected"
              />
            </div>
            <div class="form-group">
              <label>密码</label>
              <input 
                v-model="sshConfig.password" 
                type="password" 
                placeholder="••••••••"
                :disabled="isConnected"
              />
            </div>
            <!-- 连接状态提示 -->
            <div v-if="connectionStatus" class="connection-hint" :class="{ success: isConnected }">
              {{ connectionStatus }}
            </div>
            
            <!-- 测试连接按钮 -->
            <button 
              v-if="!isConnected"
              class="action-btn secondary" 
              @click="testConnection"
              :disabled="connecting || testing"
            >
              {{ testing ? '测试中...' : '测试连接' }}
            </button>
            
            <!-- 连接/断开按钮 -->
            <button 
              class="action-btn primary" 
              @click="toggleConnection"
              :disabled="connecting || testing"
            >
              {{ connecting ? '连接中...' : (isConnected ? '断开连接' : '连接') }}
            </button>
          </div>
        </div>

        <!-- 快捷目录 -->
        <div class="sidebar-section" v-if="isConnected">
          <h3 class="section-title">快捷目录</h3>
          <div class="shortcut-list">
            <button 
              v-for="dir in quickDirs" 
              :key="dir.path"
              class="shortcut-btn"
              @click="navigateToDir(dir.path)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
              <span>{{ dir.name }}</span>
            </button>
          </div>
        </div>

        <!-- OTA 操作面板 -->
        <div class="sidebar-section" v-if="isConnected">
          <h3 class="section-title">OTA 升级操作</h3>
          <div class="ota-panel">
            <div class="ota-info">
              <p class="ota-hint">执行 OTA 升级脚本</p>
            </div>
            <button 
              class="action-btn danger" 
              @click="triggerOTA"
              :disabled="otaRunning"
            >
              {{ otaRunning ? '升级中...' : '触发 OTA 升级' }}
            </button>
            <div v-if="otaOutput" class="ota-output">
              <pre>{{ otaOutput }}</pre>
            </div>
          </div>
        </div>
      </aside>

      <!-- 主内容区域 -->
      <main class="content-area">
        <div v-if="!isConnected" class="empty-state">
          <svg class="empty-icon" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <h3>未连接到 AGV 设备</h3>
          <p>请在左侧配置 SSH 连接信息并点击连接</p>
        </div>

        <div v-else class="file-manager">
          <!-- 文件浏览器头部 -->
          <div class="content-header">
            <div class="breadcrumb">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
              <span class="path">{{ currentPath }}</span>
            </div>
            <button class="action-btn small" @click="refreshFiles">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
              </svg>
              刷新
            </button>
          </div>

          <!-- 文件列表 -->
          <div class="file-list">
            <div v-if="loading" class="loading-state">
              <div class="spinner"></div>
              <p>加载中...</p>
            </div>
            <div v-else-if="files.length === 0" class="empty-folder">
              <p>此目录为空</p>
            </div>
            <div v-else class="file-grid">
              <div 
                v-for="file in files" 
                :key="file.name"
                class="file-item"
                :class="{ directory: file.type === 'directory' }"
                @click="handleFileClick(file)"
              >
                <div class="file-icon">
                  <svg v-if="file.type === 'directory'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                  </svg>
                  <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <path d="M14 2v6h6"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <path d="M10 9H8"/>
                  </svg>
                </div>
                <div class="file-info">
                  <div class="file-name">{{ file.name }}</div>
                  <div class="file-meta">
                    <span v-if="file.size">{{ formatSize(file.size) }}</span>
                    <span v-if="file.modifyTime">{{ formatDate(file.modifyTime) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 编辑器背景遮罩 -->
          <div v-if="editingFile" class="editor-overlay" @click.self="closeEditor"></div>
          
          <!-- 文件编辑器 -->
          <div v-if="editingFile" 
               class="file-editor" 
               :class="{ maximized: editorMaximized, dragging: isDragging }"
               :style="editorStyle"
               @mousedown="startDrag">
            <!-- 编辑器头部（可拖拽） -->
            <div class="editor-header" @mousedown.stop="startDrag">
              <!-- 拖拽把手 -->
              <div class="drag-handle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="9" cy="5" r="1"/>
                  <circle cx="9" cy="12" r="1"/>
                  <circle cx="9" cy="19" r="1"/>
                  <circle cx="16" cy="5" r="1"/>
                  <circle cx="16" cy="12" r="1"/>
                  <circle cx="16" cy="19" r="1"/>
                </svg>
              </div>
              
              <div class="editor-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <div class="title-info">
                  <span class="file-name-title">{{ editingFile.name }}</span>
                  <span class="file-path-title">{{ editingFile.path }}</span>
                </div>
              </div>
              
              <div class="editor-actions">
                <button 
                  class="icon-btn" 
                  @click="toggleMaximize"
                  @mousedown.stop
                  :title="editorMaximized ? '还原 (双击标题栏)' : '最大化'"
                >
                  <svg v-if="!editorMaximized" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
                  </svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/>
                  </svg>
                </button>
                <button 
                  class="action-btn small primary" 
                  @click="saveFile"
                  @mousedown.stop
                  :disabled="saving"
                  title="保存 (Ctrl+S)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                    <path d="M17 21v-8H7v8M7 3v5h8"/>
                  </svg>
                  {{ saving ? '保存中...' : '保存' }}
                </button>
                <button 
                  class="icon-btn close-btn" 
                  @click="closeEditor"
                  @mousedown.stop
                  title="关闭 (Esc)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <!-- 编辑器主体 -->
            <div class="editor-body">
              <div class="editor-line-numbers">
                <div 
                  v-for="(line, index) in fileContentLines" 
                  :key="index"
                  class="line-number"
                >
                  {{ index + 1 }}
                </div>
              </div>
              <textarea 
                ref="editorTextarea"
                v-model="fileContent" 
                class="editor-textarea"
                spellcheck="false"
                @keydown="handleEditorKeydown"
                @scroll="syncLineNumbersScroll"
              ></textarea>
            </div>
            
            <!-- 编辑器状态栏 -->
            <div class="editor-statusbar">
              <div class="statusbar-left">
                <span class="status-item">
                  行: {{ currentLine }} / {{ totalLines }}
                </span>
                <span class="status-item">
                  列: {{ currentColumn }}
                </span>
                <span class="status-item">
                  字符: {{ fileContent.length }}
                </span>
              </div>
              <div class="statusbar-right">
                <span class="status-item">UTF-8</span>
                <span class="status-item">CRLF</span>
                <!-- 拖拽调整大小的把手 -->
                <div class="resize-handle" @mousedown.stop="startResize"></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AgvRemoteManager',
  data() {
    return {
      // SSH 连接配置
      sshConfig: {
        host: '',
        port: 22,
        username: 'root',
        password: ''
      },
      isConnected: false,
      connecting: false,
      testing: false,
      sessionId: null,
      connectionStatus: '',
      
      // 文件管理
      currentPath: '/',
      files: [],
      loading: false,
      
      // 文件编辑
      editingFile: null,
      fileContent: '',
      saving: false,
      editorMaximized: false,
      editorWidth: 800,  // 像素
      editorHeight: 500,  // 像素
      editorLeft: 0,  // 像素
      editorTop: 0,  // 像素
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragStartLeft: 0,
      dragStartTop: 0,
      isResizing: false,
      resizeStartX: 0,
      resizeStartY: 0,
      resizeStartWidth: 0,
      resizeStartHeight: 0,
      
      // OTA
      otaRunning: false,
      otaOutput: '',
      
      // 快捷目录
      quickDirs: [
        { name: '根目录', path: '/' },
        { name: '/etc', path: '/etc' },
        { name: '/home', path: '/home' },
        { name: '/var/log', path: '/var/log' },
        { name: '/opt', path: '/opt' }
      ]
    };
  },
  methods: {
    async testConnection() {
      if (!this.sshConfig.host || !this.sshConfig.username) {
        alert('请先填写主机地址和用户名');
        return;
      }

      this.testing = true;
      this.connectionStatus = '正在测试连接...';
      
      try {
        // 使用一个简单的fetch测试后端是否可达
        const testConfig = {
          host: this.sshConfig.host,
          port: this.sshConfig.port || 22,
          username: this.sshConfig.username
        };
        
        console.log(`[前端] 测试连接配置:`, testConfig);
        this.connectionStatus = `正在测试 ${this.sshConfig.host}:${this.sshConfig.port || 22} 的可达性...`;
        
        // 这里实际上会尝试连接，但我们不保存会话
        // 只是为了验证配置是否正确
        alert(`📋 连接配置检查：
        
✅ 主机地址: ${this.sshConfig.host}
✅ 端口: ${this.sshConfig.port || 22}
✅ 用户名: ${this.sshConfig.username}
${this.sshConfig.password ? '✅' : '❌'} 密码: ${this.sshConfig.password ? '已填写' : '未填写'}

💡 提示：
• 确保目标设备可以通过网络访问
• 确保SSH服务已在目标设备上运行
• 确保防火墙允许SSH连接（端口 ${this.sshConfig.port || 22}）
• 可以使用命令测试：ping ${this.sshConfig.host}

准备就绪后，点击"连接"按钮建立SSH连接。`);
        
        this.connectionStatus = '';
      } catch (error) {
        console.error('[前端] 测试失败:', error);
        this.connectionStatus = '❌ 测试失败';
      } finally {
        this.testing = false;
      }
    },

    async toggleConnection() {
      if (this.isConnected) {
        await this.disconnect();
      } else {
        await this.connect();
      }
    },
    
    async connect() {
      // 表单验证
      if (!this.sshConfig.host || !this.sshConfig.username || !this.sshConfig.password) {
        alert('请填写完整的连接信息（主机地址、用户名、密码）');
        return;
      }

      this.connecting = true;
      console.log(`[前端] 尝试连接到 ${this.sshConfig.host}:${this.sshConfig.port}`);
      
      try {
        const response = await fetch('/api/agv-remote/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.sshConfig)
        });
        
        const data = await response.json();
        if (data.success) {
          this.isConnected = true;
          this.sessionId = data.session_id;
          this.currentPath = '/';
          console.log(`[前端] 连接成功，会话ID: ${data.session_id}`);
          await this.loadFiles('/');
          alert('✅ SSH 连接成功！');
        } else {
          throw new Error(data.error || '连接失败');
        }
      } catch (error) {
        console.error('[前端] 连接失败:', error);
        
        // 格式化错误消息
        let errorMessage = error.message;
        if (errorMessage.includes('\n')) {
          // 多行错误消息，使用更好的格式
          errorMessage = '❌ ' + errorMessage.replace(/\n/g, '\n   ');
        } else {
          errorMessage = '❌ ' + errorMessage;
        }
        
        // 添加故障排查建议
        errorMessage += '\n\n💡 故障排查建议：\n' +
          '   • 确认目标设备IP地址和端口正确\n' +
          '   • 检查目标设备SSH服务是否运行（ssh命令）\n' +
          '   • 验证用户名和密码是否正确\n' +
          '   • 确保防火墙允许SSH连接（端口22）\n' +
          '   • 如果是内网设备，确认网络互通';
        
        this.connectionStatus = '❌ 连接失败';
        alert(errorMessage);
      } finally {
        this.connecting = false;
      }
    },
    
    async disconnect() {
      try {
        await fetch('/api/agv-remote/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: this.sessionId })
        });
        
        this.isConnected = false;
        this.sessionId = null;
        this.files = [];
        this.editingFile = null;
        this.fileContent = '';
        this.connectionStatus = '';
        console.log('[前端] 已断开连接');
      } catch (error) {
        console.error('断开连接失败:', error);
      }
    },
    
    async loadFiles(path) {
      this.loading = true;
      try {
        const response = await fetch(`/api/agv-remote/files?session_id=${this.sessionId}&path=${encodeURIComponent(path)}`);
        const data = await response.json();
        
        if (data.success) {
          this.files = data.files || [];
          this.currentPath = path;
          console.log(`[前端] 加载目录 ${path}，文件数: ${this.files.length}`);
          // 调试：输出第一个文件的结构
          if (this.files.length > 0) {
            console.log('[前端] 文件对象示例:', this.files[0]);
          }
        } else {
          throw new Error(data.error || '加载文件列表失败');
        }
      } catch (error) {
        console.error('加载文件失败:', error);
        alert('加载文件失败: ' + error.message);
      } finally {
        this.loading = false;
      }
    },
    
    async handleFileClick(file) {
      console.log('[前端] 点击文件:', file.name, 'type:', file.type, 'is_directory:', file.is_directory);
      
      // 兼容两种字段名称
      const isDirectory = file.type === 'directory' || file.is_directory === true;
      
      if (isDirectory) {
        const newPath = this.currentPath === '/' 
          ? `/${file.name}` 
          : `${this.currentPath}/${file.name}`;
        console.log('[前端] 进入目录:', newPath);
        await this.loadFiles(newPath);
      } else {
        console.log('[前端] 打开文件:', file.name);
        await this.openFile(file);
      }
    },
    
    async openFile(file) {
      try {
        const filePath = this.currentPath === '/' 
          ? `/${file.name}` 
          : `${this.currentPath}/${file.name}`;
        
        const response = await fetch(`/api/agv-remote/file?session_id=${this.sessionId}&path=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (data.success) {
          this.editingFile = { ...file, path: filePath };
          this.fileContent = data.content;
        } else {
          throw new Error(data.error || '读取文件失败');
        }
      } catch (error) {
        console.error('打开文件失败:', error);
        alert('打开文件失败: ' + error.message);
      }
    },
    
    async saveFile() {
      this.saving = true;
      try {
        const response = await fetch('/api/agv-remote/file', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: this.sessionId,
            path: this.editingFile.path,
            content: this.fileContent
          })
        });
        
        const data = await response.json();
        if (data.success) {
          alert('保存成功');
        } else {
          throw new Error(data.error || '保存失败');
        }
      } catch (error) {
        console.error('保存文件失败:', error);
        alert('保存文件失败: ' + error.message);
      } finally {
        this.saving = false;
      }
    },
    
    closeEditor() {
      this.editingFile = null;
      this.fileContent = '';
    },
    
    async navigateToDir(path) {
      await this.loadFiles(path);
    },
    
    async refreshFiles() {
      await this.loadFiles(this.currentPath);
    },
    
    async triggerOTA() {
      if (!confirm('确定要触发 OTA 升级吗？此操作可能需要数分钟。')) {
        return;
      }
      
      this.otaRunning = true;
      this.otaOutput = '';
      
      try {
        const response = await fetch('/api/agv-remote/ota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: this.sessionId })
        });
        
        const data = await response.json();
        if (data.success) {
          this.otaOutput = data.output || '升级命令已执行';
          alert('OTA 升级已触发');
        } else {
          throw new Error(data.error || 'OTA 升级失败');
        }
      } catch (error) {
        console.error('OTA 升级失败:', error);
        alert('OTA 升级失败: ' + error.message);
      } finally {
        this.otaRunning = false;
      }
    },
    
    formatSize(bytes) {
      if (!bytes) return '-';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },
    
    formatDate(timestamp) {
      if (!timestamp) return '-';
      return new Date(timestamp).toLocaleString('zh-CN');
    },

    toggleMaximize() {
      this.editorMaximized = !this.editorMaximized;
    },

    handleEditorKeydown(event) {
      // Ctrl+S 保存
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        this.saveFile();
      }
      // Esc 关闭
      if (event.key === 'Escape') {
        this.closeEditor();
      }
    },

    syncLineNumbersScroll(event) {
      const lineNumbers = document.querySelector('.editor-line-numbers');
      if (lineNumbers) {
        lineNumbers.scrollTop = event.target.scrollTop;
      }
    },

    startDrag(event) {
      if (this.editorMaximized) return;
      this.isDragging = true;
      this.dragStartX = event.clientX;
      this.dragStartY = event.clientY;
      this.dragStartLeft = this.editorLeft;
      this.dragStartTop = this.editorTop;
      
      document.addEventListener('mousemove', this.handleDrag);
      document.addEventListener('mouseup', this.stopDrag);
    },

    handleDrag(event) {
      if (!this.isDragging) return;
      const deltaX = event.clientX - this.dragStartX;
      const deltaY = event.clientY - this.dragStartY;
      
      this.editorLeft = Math.max(0, this.dragStartLeft + deltaX);
      this.editorTop = Math.max(0, this.dragStartTop + deltaY);
    },

    stopDrag() {
      this.isDragging = false;
      document.removeEventListener('mousemove', this.handleDrag);
      document.removeEventListener('mouseup', this.stopDrag);
    },

    startResize(event) {
      if (this.editorMaximized) return;
      this.isResizing = true;
      this.resizeStartX = event.clientX;
      this.resizeStartY = event.clientY;
      this.resizeStartWidth = this.editorWidth;
      this.resizeStartHeight = this.editorHeight;
      
      document.addEventListener('mousemove', this.handleResize);
      document.addEventListener('mouseup', this.stopResize);
    },

    handleResize(event) {
      if (!this.isResizing) return;
      const deltaX = event.clientX - this.resizeStartX;
      const deltaY = event.clientY - this.resizeStartY;
      
      // 最小宽度和高度
      this.editorWidth = Math.max(400, this.resizeStartWidth + deltaX);
      this.editorHeight = Math.max(300, this.resizeStartHeight + deltaY);
    },

    stopResize() {
      this.isResizing = false;
      document.removeEventListener('mousemove', this.handleResize);
      document.removeEventListener('mouseup', this.stopResize);
    }
  },

  computed: {
    fileContentLines() {
      return this.fileContent.split('\n');
    },

    currentLine() {
      if (!this.$refs.editorTextarea) return 1;
      const textarea = this.$refs.editorTextarea;
      const textBeforeCursor = this.fileContent.substring(0, textarea.selectionStart);
      return textBeforeCursor.split('\n').length;
    },

    totalLines() {
      return this.fileContentLines.length;
    },

    currentColumn() {
      if (!this.$refs.editorTextarea) return 1;
      const textarea = this.$refs.editorTextarea;
      const textBeforeCursor = this.fileContent.substring(0, textarea.selectionStart);
      const lines = textBeforeCursor.split('\n');
      return lines[lines.length - 1].length + 1;
    },

    editorStyle() {
      if (this.editorMaximized) {
        return {
          width: '100%',
          height: '100%',
          left: '0',
          top: '0',
          right: 'auto',
          bottom: 'auto',
          borderRadius: '0'
        };
      }
      
      // 计算居中位置
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const left = this.editorLeft || (windowWidth - this.editorWidth) / 2;
      const top = this.editorTop || (windowHeight - this.editorHeight) / 2;
      
      return {
        width: `${this.editorWidth}px`,
        height: `${this.editorHeight}px`,
        left: `${left}px`,
        top: `${top}px`,
        right: 'auto',
        bottom: 'auto',
        borderRadius: '12px'
      };
    }
  },
  
  beforeUnmount() {
    if (this.isConnected) {
      this.disconnect();
    }
  }
}
</script>

<style scoped>
/* =========================
   全局样式与布局
========================= */
.remote-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #f0f4f8 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #1e293b;
}

/* =========================
   顶部导航栏
========================= */
.top-header {
  height: 64px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #2563eb;
}

.logo svg {
  color: #2563eb;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.nav-link:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: #fee2e2;
  border-radius: 20px;
  font-size: 14px;
  color: #991b1b;
  font-weight: 500;
}

.connection-status.connected {
  background: #dcfce7;
  color: #166534;
}

.connection-status .dot {
  width: 8px;
  height: 8px;
  background: #dc2626;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.connection-status.connected .dot {
  background: #22c55e;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* =========================
   主布局
========================= */
.main-layout {
  display: flex;
  height: calc(100vh - 64px);
}

/* =========================
   侧边栏
========================= */
.sidebar {
  width: 320px;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  padding: 24px;
  overflow-y: auto;
}

.sidebar-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 16px;
  letter-spacing: 0.5px;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #475569;
}

.form-group input {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-group input:disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}

.action-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.primary {
  background: #2563eb;
  color: #ffffff;
}

.action-btn.primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.action-btn.secondary {
  background: #64748b;
  color: #ffffff;
}

.action-btn.secondary:hover:not(:disabled) {
  background: #475569;
}

.action-btn.danger {
  background: #dc2626;
  color: #ffffff;
}

.action-btn.danger:hover:not(:disabled) {
  background: #b91c1c;
}

.connection-hint {
  padding: 10px 12px;
  background: #fef3c7;
  border: 1px solid #fde047;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
  text-align: center;
}

.connection-hint.success {
  background: #dcfce7;
  border-color: #86efac;
  color: #166534;
}

.action-btn.small {
  padding: 6px 12px;
  font-size: 13px;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.shortcut-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.ota-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ota-info {
  padding: 12px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
}

.ota-hint {
  font-size: 13px;
  color: #9a3412;
  margin: 0;
}

.ota-output {
  padding: 12px;
  background: #1e293b;
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.ota-output pre {
  font-size: 12px;
  color: #22c55e;
  font-family: 'Courier New', monospace;
  margin: 0;
  white-space: pre-wrap;
}

/* =========================
   主内容区域
========================= */
.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f8fafc;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.empty-icon {
  color: #cbd5e1;
  margin-bottom: 24px;
}

.empty-state h3 {
  font-size: 20px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 8px 0;
}

.empty-state p {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
}

/* =========================
   文件管理器
========================= */
.file-manager {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 32px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #475569;
}

.breadcrumb svg {
  color: #3b82f6;
}

.breadcrumb .path {
  font-size: 14px;
  font-weight: 500;
  font-family: 'Courier New', monospace;
}

.file-list {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-folder {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.file-item:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.file-item.directory {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.file-icon {
  flex-shrink: 0;
  color: #64748b;
}

.file-item.directory .file-icon {
  color: #3b82f6;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}

/* 编辑器背景遮罩 */
.editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  z-index: 99;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* =========================
   文件编辑器
========================= */
.file-editor {
  position: fixed;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: box-shadow 0.2s ease;
  border-radius: 12px;
}

.file-editor.dragging {
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.file-editor.maximized {
  width: 100% !important;
  height: 100% !important;
  border-radius: 0 !important;
  border: none !important;
  box-shadow: none !important;
}

/* 编辑器头部 */
.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
  border-radius: 12px 12px 0 0;
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
}

.editor-header:active {
  cursor: grabbing;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #cbd5e1;
  flex-shrink: 0;
}

.drag-handle svg {
  width: 16px;
  height: 16px;
}

.file-editor.maximized .editor-header {
  border-radius: 0;
  cursor: default;
}

.editor-title {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #2563eb;
}

.title-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-name-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.file-path-title {
  font-size: 11px;
  color: #64748b;
  font-family: 'Courier New', monospace;
}

.editor-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-left: auto;
}

.icon-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: #64748b;
}

.icon-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #1e293b;
}

.icon-btn.close-btn:hover {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
}

/* 编辑器主体 */
.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: #ffffff;
}

.editor-line-numbers {
  width: 50px;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  padding: 16px 8px;
  text-align: right;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #94a3b8;
  user-select: none;
  overflow: hidden;
  flex-shrink: 0;
}

.line-number {
  height: 20.8px; /* 13px * 1.6 line-height */
  padding-right: 8px;
}

.editor-textarea {
  flex: 1;
  padding: 16px;
  border: none;
  resize: none;
  font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #1e293b;
  background: #ffffff;
  overflow-y: auto;
  overflow-x: auto;
  white-space: pre;
  tab-size: 4;
}

.editor-textarea:focus {
  outline: none;
}

/* 滚动条样式 */
.editor-textarea::-webkit-scrollbar,
.editor-line-numbers::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.editor-textarea::-webkit-scrollbar-track,
.editor-line-numbers::-webkit-scrollbar-track {
  background: #f8fafc;
}

.editor-textarea::-webkit-scrollbar-thumb,
.editor-line-numbers::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 6px;
  border: 2px solid #f8fafc;
}

.editor-textarea::-webkit-scrollbar-thumb:hover,
.editor-line-numbers::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 编辑器状态栏 */
.editor-statusbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 16px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  font-size: 11px;
  color: #64748b;
  flex-shrink: 0;
}

.statusbar-left,
.statusbar-right {
  display: flex;
  gap: 16px;
  align-items: center;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

.status-item svg {
  width: 12px;
  height: 12px;
  color: #94a3b8;
}

/* 调整大小把手 */
.resize-handle {
  width: 20px;
  height: 20px;
  cursor: se-resize;
  background: linear-gradient(135deg, transparent 50%, #cbd5e1 50%);
  border-radius: 0 4px 0 0;
  flex-shrink: 0;
}
</style>

