<template>
  <div class="configurator-wrapper">
    <!-- Header -->
    <header class="config-header">
      <div class="header-left">
        <h2>AGV 3D 参数配置器</h2>
      </div>
      <div class="header-actions">
        <input 
          type="file" 
          ref="fileInput" 
          @change="handleFileUpload" 
          accept=".vcf,.xml" 
          style="display: none" 
        />
        <button class="action-btn" @click="$refs.fileInput.click()">
          📂 导入 VCF
        </button>
        <button class="action-btn" @click="createNew">
          📄 新建
        </button>
        <button class="action-btn primary" @click="handleDownload">
          💾 导出 VCF
        </button>
      </div>
    </header>

    <div class="main-content">
      <!-- 3D Canvas -->
      <div class="canvas-area">
        <Agv3DModel 
          :agvData="agvData" 
          :selectedId="selectedComponentId" 
          @select-component="onComponentSelected" 
        />
        <div class="overlay-info">
          <p v-if="selectedComponentId">选中: {{ selectedComponentId }}</p>
          <p v-else>点击模型部件进行编辑</p>
        </div>
      </div>

      <!-- Properties Sidebar -->
      <aside class="properties-panel" :class="{ 'is-open': selectedComponent }">
        <div class="panel-header">
          <h3>组件属性</h3>
          <button v-if="selectedComponent" @click="selectedComponentId = null" class="close-btn">×</button>
        </div>

        <div v-if="selectedComponent" class="panel-content">
          <div class="prop-group info-group">
            <label>名称 (SymbolName)</label>
            <input type="text" v-model="selectedComponent.SymbolName" disabled />
            
            <label>类型 (DataType)</label>
            <input type="text" v-model="selectedComponent.DataType" disabled />
            
            <label>备注 (Remark)</label>
            <input type="text" v-model="selectedComponent.Remark" />
          </div>

          <div class="prop-group props-list">
            <h4>参数列表</h4>
            <div 
              v-for="(prop, index) in getProperties(selectedComponent)" 
              :key="index" 
              class="prop-item"
            >
              <label :title="prop.Remark">{{ prop.SymbolName }}</label>
              <div class="input-wrapper">
                <input 
                  v-if="isNumber(prop.Value)"
                  type="number" 
                  v-model.number="prop.Value" 
                  @input="updateComponentHelper(selectedComponent, prop.SymbolName, prop.Value)"
                />
                <input 
                  v-else
                  type="text" 
                  v-model="prop.Value"
                  @input="updateComponentHelper(selectedComponent, prop.SymbolName, prop.Value)"
                />
                <span class="unit-hint" v-if="getUnitHint(prop)">{{ getUnitHint(prop) }}</span>
              </div>
              <small class="prop-remark">{{ prop.Remark }}</small>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>请在左侧 3D 视图中选择一个组件以查看和编辑属性</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import Agv3DModel from '../components/Agv3DModel.vue';
import { parseVcf, generateVcf, createEmptyVcf } from '../utils/xmlHandler';

const agvData = ref({ raw: null, components: [] });
const selectedComponentId = ref(null);
const fileInput = ref(null);

const selectedComponent = computed(() => {
  if (!selectedComponentId.value) return null;
  return agvData.value.components.find(c => c.SymbolName === selectedComponentId.value);
});

// Helper to access properties array safely
const getProperties = (comp) => {
  if (comp && comp.Properties && comp.Properties.Property) {
    return Array.isArray(comp.Properties.Property) 
      ? comp.Properties.Property 
      : [comp.Properties.Property];
  }
  return [];
};

const isNumber = (val) => !isNaN(parseFloat(val)) && isFinite(val);

const getUnitHint = (prop) => {
  if (prop.Remark && prop.Remark.includes('mm')) return 'mm';
  if (prop.Remark && prop.Remark.includes('°')) return '°';
  if (prop.SymbolName === 'Angle') return '0.01°';
  return '';
};

// Sync property changes to the helper _props so 3D model updates
const updateComponentHelper = (comp, key, value) => {
  // Update internal helpers for 3D reactivity
  if (key === 'X') comp._x = parseFloat(value) || 0;
  if (key === 'Y') comp._y = parseFloat(value) || 0;
  if (key === 'Angle') comp._angle = parseFloat(value) || 0;
  
  // Also update _props map
  if (comp._props) {
    comp._props[key] = value;
  }
};

const onComponentSelected = (id) => {
  selectedComponentId.value = id;
};

const loadXml = (xmlContent) => {
  try {
    const result = parseVcf(xmlContent);
    agvData.value = result;
    selectedComponentId.value = null;
  } catch (e) {
    console.error(e);
    alert('解析文件失败: ' + e.message);
  }
};

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => loadXml(e.target.result);
  reader.readAsText(file);
};

const createNew = () => {
  loadXml(createEmptyVcf());
};

const handleDownload = () => {
  if (!agvData.value.raw) return;
  
  try {
    const xmlStr = generateVcf(agvData.value.raw, agvData.value.components);
    const blob = new Blob([xmlStr], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `agv_config_${new Date().getTime()}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('生成文件失败: ' + e.message);
  }
};

onMounted(() => {
  // Load initial template
  createNew();
});
</script>

<style scoped>
.configurator-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1e1e1e;
  color: #fff;
}

.config-header {
  height: 60px;
  background: #2d2d30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #3e3e42;
}

.header-left h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}

.action-btn {
  background: #3e3e42;
  border: none;
  color: white;
  padding: 8px 16px;
  margin-left: 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn:hover {
  background: #4e4e52;
}

.action-btn.primary {
  background: #007acc;
}

.action-btn.primary:hover {
  background: #0098ff;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.canvas-area {
  flex: 1;
  position: relative;
}

.overlay-info {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.5);
  padding: 5px 10px;
  border-radius: 4px;
  pointer-events: none;
}

.properties-panel {
  width: 350px;
  background: #252526;
  border-left: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
}

.panel-header {
  height: 40px;
  background: #2d2d30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
  border-bottom: 1px solid #3e3e42;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.close-btn {
  background: none;
  border: none;
  color: #aaa;
  cursor: pointer;
  font-size: 20px;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.prop-group {
  margin-bottom: 20px;
}

.prop-group label {
  display: block;
  font-size: 12px;
  color: #aaa;
  margin-bottom: 4px;
  margin-top: 10px;
}

.prop-group input {
  width: 100%;
  background: #3c3c3c;
  border: 1px solid #3c3c3c;
  color: #fff;
  padding: 6px;
  border-radius: 2px;
}

.prop-group input:focus {
  border-color: #007acc;
  outline: none;
}

.prop-item {
  margin-bottom: 12px;
  border-bottom: 1px solid #333;
  padding-bottom: 8px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.unit-hint {
  position: absolute;
  right: 8px;
  font-size: 11px;
  color: #888;
}

.prop-remark {
  display: block;
  font-size: 10px;
  color: #666;
  margin-top: 2px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  padding: 20px;
  text-align: center;
}

/* Scrollbar styling */
.panel-content::-webkit-scrollbar {
  width: 8px;
}
.panel-content::-webkit-scrollbar-track {
  background: #252526;
}
.panel-content::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 4px;
}
</style>

