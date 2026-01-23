<template>
  <div class="monitor-wrapper">
    <!-- 顶部导航栏 -->
    <header class="top-header">
      <div class="header-left">
        <div class="logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="logo-text">AGV 实时诊断系统</span>
        </div>
      </div>
      <div class="header-right">
        <router-link to="/configurator" class="nav-link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" />
            <path d="M2 17L12 22L22 17" />
            <path d="M2 12L12 17L22 12" />
          </svg>
          <span>3D配置</span>
        </router-link>
        <router-link to="/remote" class="nav-link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span>远程管理</span>
        </router-link>
        <div class="live-indicator">
          <span class="dot"></span>
          <span>实时监控中</span>
        </div>
      </div>
    </header>

    <div class="main-layout">
      <!-- 左侧边栏 -->
      <aside class="sidebar">
        <div class="sidebar-section">
          <h3 class="section-title">系统概览</h3>
          <div class="stats-cards">
            <div class="stat-item">
              <div class="stat-icon total">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                </svg>
              </div>
              <div class="stat-content">
                <div class="stat-label">总告警</div>
                <div class="stat-number">{{ stats.total }}</div>
              </div>
            </div>
            
            <div class="stat-item critical">
              <div class="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div class="stat-content">
                <div class="stat-label">严重故障</div>
                <div class="stat-number">{{ stats.critical }}</div>
              </div>
            </div>

            <div class="stat-item warning">
              <div class="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div class="stat-content">
                <div class="stat-label">警告提示</div>
                <div class="stat-number">{{ stats.warning }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <h3 class="section-title">AGV 筛选</h3>
          <div class="filter-group">
            <button 
              class="filter-btn" 
              :class="{ active: selectedAgv === 'ALL' }"
              @click="selectedAgv = 'ALL'"
            >
              全部 AGV
            </button>
            <button 
              v-for="agvId in agvList" 
              :key="agvId"
              class="filter-btn"
              :class="{ active: selectedAgv === agvId }"
              @click="selectedAgv = agvId"
            >
              {{ agvId }}
            </button>
          </div>
        </div>

        <div class="sidebar-section">
          <h3 class="section-title">告警级别</h3>
          <div class="filter-group">
            <button class="filter-btn" :class="{ active: levelFilter === 'ALL' }" @click="levelFilter = 'ALL'">全部</button>
            <button class="filter-btn" :class="{ active: levelFilter === 'critical' }" @click="levelFilter = 'critical'">严重</button>
            <button class="filter-btn" :class="{ active: levelFilter === 'warning' }" @click="levelFilter = 'warning'">警告</button>
          </div>
        </div>
      </aside>

      <!-- 主内容区域 -->
      <main class="content-area">
        <div class="content-header">
          <h2>告警动态</h2>
          <div class="content-meta">最近更新: {{ lastUpdateTime }}</div>
        </div>

        <!-- 告警网格 -->
        <transition-group name="card-list" tag="div" class="alerts-grid" v-if="filteredAlerts.length > 0">
          <article 
            v-for="alert in filteredAlerts" 
            :key="alert.id" 
            class="alert-card"
            :class="'level-' + alert.level"
          >
            <div class="card-top">
              <div class="agv-identifier">{{ extractAgvId(alert.type) }}</div>
              <div class="alert-timestamp">{{ formatTime(alert.timestamp) }}</div>
            </div>

            <div class="card-main">
              <h4 class="alert-title">{{ extractAlertType(alert.type) }}</h4>
              <div class="alert-badge" :class="alert.level">
                {{ getLevelLabel(alert.level) }}
              </div>
              <p class="alert-description">{{ alert.msg }}</p>
            </div>

            <div class="card-bottom" v-if="alert.suggestion">
              <div class="suggestion-tag">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4"/>
                  <path d="M12 8h.01"/>
                </svg>
                <span>{{ alert.suggestion }}</span>
              </div>
            </div>
          </article>
        </transition-group>

        <!-- 空状态 -->
        <div v-else class="empty-view">
          <svg class="empty-icon" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <h3>系统运行正常</h3>
          <p>当前暂无告警信息</p>
        </div>
      </main>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AgvMonitor',
  data() {
    return {
      alerts: [],
      eventSource: null,
      stats: {
        total: 0,
        critical: 0,
        warning: 0
      },
      lastUpdateTime: '--:--:--',
      selectedAgv: 'ALL',
      levelFilter: 'ALL',
      agvList: []
    };
  },
  computed: {
    filteredAlerts() {
      let filtered = this.alerts;
      
      // 按 AGV 筛选
      if (this.selectedAgv !== 'ALL') {
        filtered = filtered.filter(alert => {
          const agvId = this.extractAgvId(alert.type);
          return agvId === this.selectedAgv;
        });
      }
      
      // 按级别筛选
      if (this.levelFilter !== 'ALL') {
        filtered = filtered.filter(alert => alert.level === this.levelFilter);
      }
      
      return filtered;
    }
  },
  mounted() {
    this.connectSSE();
    this.updateClock();
    setInterval(this.updateClock, 1000);
  },
  beforeUnmount() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  },
  methods: {
    connectSSE() {
      // Nginx 反向代理配置：直接使用相对路径
      // Nginx 会自动转发 /api/alerts 到后端 http://127.0.0.1:3000
      const baseUrl = '/api';
      const connectUrl = `${baseUrl}/alerts`;
      
      console.log('🔗 SSE 连接地址:', connectUrl);
      console.log('📍 当前主机:', window.location.hostname);
      console.log('🌐 当前协议:', window.location.protocol);
      
      this.eventSource = new EventSource(connectUrl);

      // 用于排查：确认连接已打开、是否真的收到 message
      this.eventSource.onopen = () => {
        console.log('✅ SSE 已连接打开');
      };
      
      this.eventSource.onmessage = (event) => {
        try {
          console.log('📥 SSE 原始数据:', event.data);
          const data = JSON.parse(event.data);
          
          if (data.alerts && Array.isArray(data.alerts)) {
            data.alerts.forEach(newAlert => {
              const enrichedAlert = {
                ...newAlert,
                id: Date.now() + Math.random().toString(16).slice(2),
                timestamp: data.timestamp * 1000
              };
              
              // 1. 更新列表
              this.alerts.unshift(enrichedAlert);
              if (this.alerts.length > 50) this.alerts.pop();

              // 2. 更新统计
              this.updateStats(newAlert.level);
              
              // 3. 自动添加新出现的 AGV ID
              const agvId = this.extractAgvId(enrichedAlert.type);
              if (agvId !== 'UNKNOWN' && !this.agvList.includes(agvId)) {
                this.agvList.push(agvId);
                this.agvList.sort();
              }
            });
          }
        } catch (e) {
          console.error("解析 SSE 消息失败", e);
        }
      };
      
      this.eventSource.onerror = (err) => {
        console.error("SSE 错误", err);
      };
    },
    updateStats(level) {
      this.stats.total++;
      if (level === 'critical') this.stats.critical++;
      if (level === 'warning') this.stats.warning++;
    },
    updateClock() {
      const now = new Date();
      this.lastUpdateTime = now.toLocaleTimeString('zh-CN', { hour12: false });
    },
    formatTime(ts) {
      if (!ts) return '';
      return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
    },
    extractAgvId(alertType) {
      // 从 "[AGV_001] Navigation Deviation" 提取 "AGV_001"
      const match = alertType.match(/\[([A-Z0-9_]+)\]/);
      return match ? match[1] : 'UNKNOWN';
    },
    extractAlertType(alertType) {
      // 从 "[AGV_001] Navigation Deviation" 提取 "Navigation Deviation"
      return alertType.replace(/\[.*?\]\s*/, '');
    },
    getLevelLabel(level) {
      const map = {
        'critical': '严重',
        'warning': '警告',
        'error': '错误',
        'info': '提示'
      };
      return map[level] || level;
    }
  }
}
</script>

<style scoped>
/* =========================
   全局样式与布局
========================= */
.monitor-wrapper {
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

.live-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: #dbeafe;
  border-radius: 20px;
  font-size: 14px;
  color: #1e40af;
  font-weight: 500;
}

.live-indicator .dot {
  width: 8px;
  height: 8px;
  background: #3b82f6;
  border-radius: 50%;
  animation: pulse-blue 2s infinite;
}

@keyframes pulse-blue {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* =========================
   主布局（侧边栏 + 内容）
========================= */
.main-layout {
  display: flex;
  height: calc(100vh - 64px);
}

/* =========================
   侧边栏
========================= */
.sidebar {
  width: 280px;
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

.stats-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s;
}

.stat-item:hover {
  border-color: #cbd5e1;
  background: #f1f5f9;
}

.stat-item.critical {
  background: #fef2f2;
  border-color: #fecaca;
}

.stat-item.warning {
  background: #fffbeb;
  border-color: #fde68a;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #e0f2fe;
  color: #0284c7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-item.critical .stat-icon {
  background: #fee2e2;
  color: #dc2626;
}

.stat-item.warning .stat-icon {
  background: #fef3c7;
  color: #d97706;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 4px;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-btn {
  padding: 10px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.filter-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.filter-btn.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  font-weight: 500;
}

/* =========================
   主内容区域
========================= */
.content-area {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
  background: #f8fafc;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.content-header h2 {
  font-size: 24px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.content-meta {
  font-size: 14px;
  color: #64748b;
}

/* =========================
   告警网格
========================= */
.alerts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 20px;
}

.alert-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}

.alert-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px -10px rgba(0, 0, 0, 0.15);
  border-color: #cbd5e1;
}

.alert-card.level-critical {
  border-left: 4px solid #dc2626;
}

.alert-card.level-warning {
  border-left: 4px solid #f59e0b;
}

.alert-card.level-error {
  border-left: 4px solid #dc2626;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 12px;
  border-bottom: 1px solid #f1f5f9;
}

.agv-identifier {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  background: #dbeafe;
  color: #1e40af;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.5px;
}

.alert-badge {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.alert-badge.critical {
  background: #fee2e2;
  color: #991b1b;
}

.alert-badge.warning {
  background: #fef3c7;
  color: #92400e;
}

.alert-badge.error {
  background: #fee2e2;
  color: #991b1b;
}

.alert-timestamp {
  font-size: 13px;
  color: #94a3b8;
  font-family: 'Courier New', monospace;
}

.card-main {
  padding: 16px 20px;
}

.alert-title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 8px 0;
}

.alert-description {
  font-size: 14px;
  line-height: 1.6;
  color: #475569;
  margin: 0;
}

.card-bottom {
  padding: 12px 20px;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
}

.suggestion-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #475569;
}

.suggestion-tag svg {
  color: #3b82f6;
  flex-shrink: 0;
}

/* =========================
   空状态
========================= */
.empty-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
}

.empty-icon {
  color: #cbd5e1;
  margin-bottom: 24px;
}

.empty-view h3 {
  font-size: 20px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 8px 0;
}

.empty-view p {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
}

/* =========================
   动画
========================= */
.card-list-enter-active,
.card-list-leave-active {
  transition: all 0.4s ease;
}

.card-list-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.card-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.card-list-move {
  transition: transform 0.4s ease;
}
</style>
