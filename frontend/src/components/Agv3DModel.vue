<template>
  <div ref="container" class="three-container">
    <div class="view-controls">
      <button @click="toggleExplodedView" class="control-btn" :class="{ active: isExploded }">
        {{ isExploded ? '📦 合并' : '💥 爆炸视图' }}
      </button>
      <button @click="resetCamera" class="control-btn">🎯 复位视角</button>
    </div>

    <!-- 摄像头视频面板 - 支持拖动 -->
    <transition name="video-panel">
      <div 
        v-if="showVideoPanel" 
        class="video-panel"
        :style="videoPanelStyle"
        @mousedown="startDrag"
      >
        <button @click="closeVideoPanel" class="video-close-btn">✕</button>
        <div class="video-container">
          <video
            ref="videoElement"
            class="video-stream"
            autoplay
            playsinline
            muted
            @mousedown.stop
          ></video>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
// 普通 script 块：定义 props，允许使用动态环境变量
export default {
  props: {
    agvData: {
      type: Object,
      required: true,
      default: () => ({ components: [] })
    },
    selectedId: {
      type: String,
      default: null
    },
    cameraServerUrl: {
      type: String,
      default() {
        const mediaHost = import.meta.env.VITE_MEDIA_HOST || window.location.hostname;
        const cameraHttpPort = import.meta.env.VITE_CAMERA_HTTP_PORT || '9090';
        const mediaScheme = import.meta.env.VITE_MEDIA_SCHEME || 'http';
        return `${mediaScheme}://${mediaHost}:${cameraHttpPort}`;
      }
    }
  },
  emits: ['select-component']
};
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import 'webrtc-adapter'; // 确保跨浏览器 WebRTC 兼容性

// 在 <script setup> 中声明 props（使用 defineProps）
// 这样才能在 setup 作用域内访问 props
const props = defineProps({
  agvData: {
    type: Object,
    required: true,
    default: () => ({ components: [] })
  },
  selectedId: {
    type: String,
    default: null
  },
  cameraServerUrl: {
    type: String,
    default: `${import.meta.env.VITE_MEDIA_SCHEME || 'http'}://${import.meta.env.VITE_MEDIA_HOST || window.location.hostname}:${import.meta.env.VITE_CAMERA_HTTP_PORT || '9090'}`
  }
});

const emit = defineEmits(['select-component']);

const mediaHost =
  import.meta.env.VITE_MEDIA_HOST || window.location.hostname;
const cameraHttpPort =
  import.meta.env.VITE_CAMERA_HTTP_PORT || '9090';
const mediamtxHlsPort =
  import.meta.env.VITE_MEDIAMTX_HLS_PORT || '8888';
const mediamtxWhepPort =
  import.meta.env.VITE_MEDIAMTX_WHEP_PORT || '8889';
const mediaScheme =
  import.meta.env.VITE_MEDIA_SCHEME || 'http';

function BuildMediaHttpUrl(port, urlPath) {
  return `${mediaScheme}://${mediaHost}:${port}${urlPath}`;
}

const container = ref(null);
let scene, camera, renderer, controls, raycaster, pointer;
let animationId;
let componentMeshes = new Map(); // Map<uuid, {component, mesh, originalPos, explodedPos}>
let labelSprites = new Map(); // 3D labels
const isExploded = ref(false);

// 摄像头视频相关状态
const showVideoPanel = ref(false);
const selectedComponentName = ref('');
const videoUrl = ref('');
const videoElement = ref(null); // video 元素引用

// WebRTC 相关状态
let pc = null; // RTCPeerConnection 实例
let whepSession = null; // WHEP 会话信息

// 拖动相关状态
const videoPanelPosition = ref({ x: 0, y: 0 });
const isDragging = ref(false);
let dragStartX = 0;
let dragStartY = 0;

// 计算视频面板的样式
const videoPanelStyle = computed(() => ({
  transform: `translate(${videoPanelPosition.value.x}px, ${videoPanelPosition.value.y}px)`,
  cursor: isDragging.value ? 'grabbing' : 'grab'
}));

// 开始拖动
const startDrag = (event) => {
  // 如果点击的是关闭按钮，不拖动
  if (event.target.closest('.video-close-btn')) {
    return;
  }
  
  isDragging.value = true;
  dragStartX = event.clientX - videoPanelPosition.value.x;
  dragStartY = event.clientY - videoPanelPosition.value.y;
  
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
};

// 拖动中
const onDrag = (event) => {
  if (!isDragging.value) return;
  
  videoPanelPosition.value.x = event.clientX - dragStartX;
  videoPanelPosition.value.y = event.clientY - dragStartY;
};

// 停止拖动
const stopDrag = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
};

// ==================== WebRTC 相关函数 ====================

// 启动 WebRTC 连接（带 fallback 到 HLS）
const startWebRTC = async () => {
  try {
    console.log('[WebRTC] 开始初始化 WebRTC 连接...');
    
    // 创建 RTCPeerConnection
    pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // 监听 ICE 连接状态
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE 连接状态:', pc.iceConnectionState);
    };

    // 监听连接状态
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] 连接状态:', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        console.warn('[WebRTC] 连接失败，尝试降级到 HLS/MJPEG');
        fallbackToHLS();
      }
    };

    // 监听媒体流
    pc.ontrack = (event) => {
      console.log('[WebRTC] 接收到媒体流:', event.streams.length);
      if (videoElement.value && event.streams[0]) {
        videoElement.value.srcObject = event.streams[0];
        videoElement.value.play().catch(err => {
          console.warn('[WebRTC] 自动播放失败:', err);
        });
      }
    };

    // 创建 Offer（仅接收视频，不发送音频/视频）
    const offer = await pc.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: false
    });
    await pc.setLocalDescription(offer);

    console.log('[WebRTC] Offer 已创建，正在发送到 MediaMTX...');

    // 发送 Offer 到 MediaMTX (WHEP 协议)
    const whepUrl =
      BuildMediaHttpUrl(mediamtxWhepPort, '/agv_camera/whep');
    
    let response;
    try {
      response = await fetch(whepUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      });
    } catch (fetchError) {
      console.error('[WebRTC] 网络请求失败:', fetchError.message);
      // 检查是否是 CORS 或网络问题
      throw new Error(`无法连接到 MediaMTX: ${fetchError.message}`);
    }

    if (!response.ok) {
      throw new Error(`WebRTC 握手失败: ${response.status} ${response.statusText}`);
    }

    // 接收 Answer
    const answer = await response.text();
    await pc.setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: answer
      })
    );

    // 保存 WHEP 会话信息（用于后续关闭）
    const location = response.headers.get('Location');
    if (location) {
      whepSession = location;
      console.log('[WebRTC] WHEP 会话已建立:', whepSession);
    }

    console.log('[WebRTC] ✓ WebRTC 连接成功建立');
  } catch (error) {
    console.error('[WebRTC] 连接错误:', error);
    // 降级到 HLS/MJPEG
    fallbackToHLS();
  }
};

// 降级到 HLS 或 MJPEG 直连
const fallbackToHLS = () => {
  console.warn('[WebRTC] WebRTC 连接失败，尝试降级...');
  if (videoElement.value) {
    // 第一选择：HLS（低延迟，需要 MediaMTX 配置）
    const hlsUrl =
      BuildMediaHttpUrl(mediamtxHlsPort, '/agv_camera/index.m3u8');
    
    // 检查浏览器是否原生支持 HLS
    if (videoElement.value.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('[Video] 尝试使用 HLS 播放');
      videoElement.value.src = hlsUrl;
      videoElement.value.play().catch(err => {
        console.warn('[Video] HLS 播放失败，尝试 MJPEG 直连:', err);
        fallbackToMJPEG();
      });
    } else {
      console.log('[Video] 浏览器不支持原生 HLS，使用 MJPEG 直连');
      fallbackToMJPEG();
    }
  }
};

// 最终降级：MJPEG 直连（可能多客户端卡顿，但功能可用）
const fallbackToMJPEG = () => {
  console.warn('[Video] 使用 MJPEG 直连（仅用于测试，多客户端可能卡顿）');
  if (videoElement.value) {
    // 改用 img 标签的方式（如果需要）
    const mjpegUrl =
      BuildMediaHttpUrl(cameraHttpPort, '/?action=stream');
    videoElement.value.poster = mjpegUrl; // 设置海报/缩略图
    
    // 创建一个隐藏的 img 标签用于显示 MJPEG
    const img = document.createElement('img');
    img.src = mjpegUrl;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.display = 'block';
    
    // 替换 video 内容
    videoElement.value.style.display = 'none';
    videoElement.value.parentElement.appendChild(img);
    
    console.log('[Video] MJPEG 直连已启用');
  }
};

// 关闭 WebRTC 连接
const closeWebRTC = async () => {
  if (pc) {
    console.log('[WebRTC] 关闭 WebRTC 连接');
    pc.close();
    pc = null;
  }

  // 如果有 WHEP 会话，通知服务器关闭
  if (whepSession) {
    try {
      const closeUrl = whepSession.startsWith('http')
        ? whepSession
        : BuildMediaHttpUrl(
            mediamtxWhepPort,
            `${whepSession.startsWith('/') ? '' : '/'}${whepSession}`
          );
      
      await fetch(closeUrl, {
        method: 'DELETE'
      });
      console.log('[WebRTC] WHEP 会话已关闭');
    } catch (err) {
      console.warn('[WebRTC] 关闭 WHEP 会话失败:', err);
    }
    whepSession = null;
  }

  // 清除视频源
  if (videoElement.value) {
    videoElement.value.srcObject = null;
    videoElement.value.src = '';
  }
};

// ==================== End WebRTC ====================

// 增强的PBR材质 - AGV风格（白色/黑色/绿色）
const materials = {
  // 车壳（白色光泽）
  shell: new THREE.MeshStandardMaterial({ 
    color: 0xffffff, 
    metalness: 0.1, 
    roughness: 0.2,
    envMapIntensity: 1.0
  }),
  // 顶盖（黑色哑光）
  topCover: new THREE.MeshStandardMaterial({ 
    color: 0x111111, 
    metalness: 0.2, 
    roughness: 0.8 
  }),
  // 状态指示灯（绿色发光）
  statusLight: new THREE.MeshBasicMaterial({ 
    color: 0x00ff66,
    transparent: true,
    opacity: 0.8
  }),
  // 底盘框架（深灰色金属）
  chassisFrame: new THREE.MeshStandardMaterial({ 
    color: 0x333333, 
    metalness: 0.8, 
    roughness: 0.4 
  }),
  // 轮胎（黑色橡胶）
  wheel: new THREE.MeshStandardMaterial({ 
    color: 0x0a0a0a, 
    roughness: 0.9,
    metalness: 0.0 
  }),
  // 轮毂（银色）
  wheelHub: new THREE.MeshStandardMaterial({ 
    color: 0xcccccc, 
    metalness: 0.9, 
    roughness: 0.2 
  }),
  // 电子设备/驱动程序（金属盒）
  electronics: new THREE.MeshStandardMaterial({ 
    color: 0x8899aa, 
    metalness: 0.6, 
    roughness: 0.3 
  }),
  // PCB（绿色）
  pcb: new THREE.MeshStandardMaterial({ 
    color: 0x225533, 
    metalness: 0.3, 
    roughness: 0.5 
  }),
  // 选中高亮（柔和青色）
  selected: new THREE.MeshStandardMaterial({ 
    color: 0x00ffff, 
    emissive: 0x004455, 
    emissiveIntensity: 0.5,
    metalness: 0.5,
    roughness: 0.2,
    transparent: true,
    opacity: 0.9
  }),
  default: new THREE.MeshStandardMaterial({ color: 0xaaaaaa })
};

// 缩放因子：3D场景 1单位 = 1毫米
const SCALE = 1.0;
const EXPLODE_SCALE = 2.5; // 爆炸距离倍数 

const initThree = () => {
  // 场景 - 增强背景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f4f8); // 更精致的浅蓝灰背景
  scene.fog = new THREE.Fog(0xf0f4f8, 4000, 10000);
  
  // 网格 - 增强视觉效果
  const gridHelper = new THREE.GridHelper(5000, 100, 0xd0d0d0, 0xe5e5e5);
  gridHelper.position.y = 0;
  scene.add(gridHelper);
  
  const axesHelper = new THREE.AxesHelper(600);
  scene.add(axesHelper);

  // 摄像机 - 优化视角
  camera = new THREE.PerspectiveCamera(45, container.value.clientWidth / container.value.clientHeight, 5, 25000);
  camera.position.set(2000, 1500, 2000);
  camera.lookAt(0, 200, 0);

  // 超高质量渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, precision: 'highp' });
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio); // 使用最高设备像素比
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // 更高质量阴影
  renderer.shadowMap.autoUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0; // 优化曝光
  renderer.outputColorSpace = THREE.SRGBColorSpace; // sRGB色彩空间
  container.value.appendChild(renderer.domElement);

  // 优化控制器
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 800;
  controls.maxDistance = 6000;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.autoRotate = false;

  // ===== 增强的多层光照系统 =====
  
  // 1. 环境光 - 提供基础均匀光照
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // 2. 主光源 - 模拟日光
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(2500, 3500, 1500);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 4096;
  keyLight.shadow.mapSize.height = 4096;
  keyLight.shadow.camera.left = -3000;
  keyLight.shadow.camera.right = 3000;
  keyLight.shadow.camera.top = 3000;
  keyLight.shadow.camera.bottom = -3000;
  keyLight.shadow.camera.near = 100;
  keyLight.shadow.camera.far = 8000;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  // 3. 补光1 - 蓝色冷光，模拟天光
  const skyLight = new THREE.DirectionalLight(0xccddff, 0.7);
  skyLight.position.set(-2000, 2000, -1500);
  scene.add(skyLight);

  // 4. 补光2 - 暖光，模拟反射光
  const fillLight = new THREE.DirectionalLight(0xffddaa, 0.4);
  fillLight.position.set(1500, 1000, -2000);
  scene.add(fillLight);

  // 5. 边缘光 - 突出轮廓
  const rimLight = new THREE.DirectionalLight(0xffbb88, 0.5);
  rimLight.position.set(-1000, 1500, 2500);
  scene.add(rimLight);

  // 6. 点光源 - 增加场景深度感
  const pointLight1 = new THREE.PointLight(0xffffff, 0.3, 5000);
  pointLight1.position.set(1000, 800, 1000);
  pointLight1.castShadow = true;
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xccddff, 0.2, 4000);
  pointLight2.position.set(-1000, 600, -1000);
  scene.add(pointLight2);

  // 交互
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  window.addEventListener('resize', onWindowResize);
  container.value.addEventListener('click', onMouseClick);
};

// 创建底壳（白色车身 - 下部分）
const createBottomShell = (comp) => {
  const group = new THREE.Group();

  // 主要白色车身（1300 x 200 x 850，下半部分）
  const shellGeo = new RoundedBoxGeometry(1300, 200, 850, 4, 40);
  const shell = new THREE.Mesh(shellGeo, materials.shell);
  shell.position.y = 130; // 下部位置，向上移确保不在地下
  shell.castShadow = true;
  shell.receiveShadow = true;
  // 为子网格设置symbolName，确保点击时能正确识别
  shell.userData.symbolName = 'BottomShell';
  group.add(shell);

  group.userData = { componentType: 'BottomShell', symbolName: 'BottomShell', isShellPart: true };
  return group;
};

// 创建顶盖（黑色板）
const createTopCover = (comp) => {
  const group = new THREE.Group();

  // 顶盖（黑色）
  const topGeo = new RoundedBoxGeometry(1250, 15, 800, 4, 30);
  const top = new THREE.Mesh(topGeo, materials.topCover);
  top.position.y = 290; // 向上移确保整体位置正确
  top.castShadow = true;
  // 为子网格设置symbolName，确保点击时能正确识别
  top.userData.symbolName = 'TopCover';
  group.add(top);

  group.userData = { componentType: 'TopCover', symbolName: 'TopCover', isShellPart: true };
  return group;
};

// 创建状态指示灯（四个角的横向灯带，分离不连接）
const createStatusLights = (comp) => {
  const group = new THREE.Group();

  // 四个角的位置和配置
  const corners = [
    { pos: [640, 150, 415], xLen: 150, zLen: 150 },   // 右前
    { pos: [-640, 150, 415], xLen: 150, zLen: 150 },  // 左前
    { pos: [640, 150, -415], xLen: 150, zLen: 150 },  // 右后
    { pos: [-640, 150, -415], xLen: 150, zLen: 150 }  // 左后
  ];

  corners.forEach(corner => {
    const [xPos, yPos, zPos] = corner.pos;

    // 1. 沿X方向的短灯带（只在角处，长度150）
    const xStripGeo = new THREE.BoxGeometry(150, 15, 20);
    const xStrip = new THREE.Mesh(xStripGeo, materials.statusLight);
    xStrip.position.set(xPos - (xPos > 0 ? 75 : -75), yPos, zPos); // 从角向内延伸
    xStrip.userData.symbolName = 'StatusLights';
    group.add(xStrip);

    // 2. 沿Z方向的短灯带（只在角处，长度150）
    const zStripGeo = new THREE.BoxGeometry(20, 15, 150);
    const zStrip = new THREE.Mesh(zStripGeo, materials.statusLight);
    zStrip.position.set(xPos, yPos, zPos - (zPos > 0 ? 75 : -75)); // 从角向内延伸
    zStrip.userData.symbolName = 'StatusLights';
    group.add(zStrip);
  });

  group.userData = { componentType: 'StatusLights', symbolName: 'StatusLights', isShellPart: true };
  return group;
};

// 创建升降机构（底部平台）
const createLiftMechanism = (comp) => {
  const group = new THREE.Group();

  // 主平台（钢铁灰）
  const platformGeo = new THREE.BoxGeometry(1200, 20, 800);
  const platform = new THREE.Mesh(platformGeo, materials.chassisFrame);
  platform.position.y = 80; // 向上移与外壳保持相对位置
  platform.castShadow = true;
  platform.receiveShadow = true;
  // 为子网格设置symbolName，确保点击时能正确识别
  platform.userData.symbolName = 'LiftMechanism';
  group.add(platform);

  // 支撑杆（4个侧面）
  const barGeo = new THREE.BoxGeometry(30, 60, 30);
  const barMat = materials.chassisFrame;
  const supportPositions = [
    [550, 80, 350], [-550, 80, 350], [550, 80, -350], [-550, 80, -350]
  ];
  supportPositions.forEach(pos => {
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(...pos);
    bar.castShadow = true;
    // 为子网格设置symbolName
    bar.userData.symbolName = 'LiftMechanism';
    group.add(bar);
  });

  // 气动缸（简化为圆柱体）
  const cylGeo = new THREE.CylinderGeometry(15, 15, 150, 16);
  const cylMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.2 });
  const cylPositions = [
    [300, 110, 200], [-300, 110, 200], [300, 110, -200], [-300, 110, -200]
  ];
  cylPositions.forEach(pos => {
    const cyl = new THREE.Mesh(cylGeo, cylMat);
    cyl.position.set(...pos);
    cyl.rotation.x = Math.PI / 2;
    cyl.castShadow = true;
    // 为子网格设置symbolName
    cyl.userData.symbolName = 'LiftMechanism';
    group.add(cyl);
  });

  group.userData = { componentType: 'LiftMechanism', symbolName: 'LiftMechanism' };
  return group;
};

// 创建内部电子设备（驱动程序、IO等）
const createElectronicBox = (comp, size = [150, 50, 100], type = 'driver') => {
  const group = new THREE.Group();
  
  // 如果是D011电机驱动，使用专门的模型
  if (type === 'driver') {
    return createMotorDriver(comp, group);
  }
  
  // 普通电子盒（IO等）
  const boxGeo = new THREE.BoxGeometry(...size);
  const box = new THREE.Mesh(boxGeo, materials.electronics);
  box.castShadow = true;
  group.add(box);
  
  // 标签/细节
  const stickerGeo = new THREE.PlaneGeometry(size[0]*0.8, size[2]*0.6);
  const stickerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sticker = new THREE.Mesh(stickerGeo, stickerMat);
  sticker.position.y = size[1]/2 + 0.1;
  sticker.rotation.x = -Math.PI/2;
  group.add(sticker);

  // 端子（橙色连接器）
  const termGeo = new THREE.BoxGeometry(20, 10, 10);
  const termMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const term = new THREE.Mesh(termGeo, termMat);
  term.position.set(size[0]/2, 0, 0);
  group.add(term);

  group.userData = { componentType: 'Electronics', symbolName: comp.SymbolName };
  return group;
};

// 预构建电机驱动的几何体和材质（避免重复创建）
let motorDriverCache = {
  geometries: {},
  materials: {}
};

const initMotorDriverCache = () => {
  if (motorDriverCache.geometries.shaft) return; // 已初始化
  
  // 缓存材质（全局共享）
  motorDriverCache.materials.silver = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
  motorDriverCache.materials.darkSilver = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 });
  motorDriverCache.materials.black = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.3, roughness: 0.7 });
  motorDriverCache.materials.metal = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.9, roughness: 0.1 });
  
  // 缓存几何体（降低细分度以提升性能）
  motorDriverCache.geometries.shaft = new THREE.CylinderGeometry(8, 8, 40, 16); // 32 → 16
  motorDriverCache.geometries.bearing = new THREE.CylinderGeometry(25, 25, 5, 16); // 32 → 16
  motorDriverCache.geometries.innerBearing = new THREE.CylinderGeometry(15, 15, 2, 16); // 32 → 16
  motorDriverCache.geometries.body = new THREE.CylinderGeometry(32, 32, 80, 16); // 32 → 16
  motorDriverCache.geometries.screw = new THREE.CylinderGeometry(4, 4, 2, 12); // 16 → 12
  motorDriverCache.geometries.innerScrew = new THREE.CylinderGeometry(2, 2, 1, 12); // 16 → 12
  motorDriverCache.geometries.transBlock = new THREE.BoxGeometry(25, 55, 55);
  motorDriverCache.geometries.button = new THREE.SphereGeometry(8, 16, 12); // 32×16 → 16×12
  motorDriverCache.geometries.blackBody = new THREE.BoxGeometry(100, 50, 50);
  motorDriverCache.geometries.rib = new THREE.BoxGeometry(100, 2, 2);
  motorDriverCache.geometries.terminal = new THREE.BoxGeometry(15, 10, 30);
  
  // 简化法兰盘：用简单的圆柱代替ExtrudeGeometry
  motorDriverCache.geometries.flange = new THREE.CylinderGeometry(35, 35, 10, 16); // 使用简单圆柱代替复杂形状
};

// 创建逼真的电机驱动模型（D011）- 性能优化版本
const createMotorDriver = (comp, group) => {
  initMotorDriverCache();
  const cache = motorDriverCache;
  
  // 1. 左侧 - 电机轴和法兰盘
  const shaft = new THREE.Mesh(cache.geometries.shaft, cache.materials.metal);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(-110, 0, 0);
  shaft.castShadow = true;
  group.add(shaft);

  // 简化的圆形法兰盘
  const flange = new THREE.Mesh(cache.geometries.flange, cache.materials.silver);
  flange.rotation.z = Math.PI / 2;
  flange.position.set(-85, 0, 0);
  flange.castShadow = true;
  group.add(flange);

  // 法兰内部轴承位
  const bearing = new THREE.Mesh(cache.geometries.bearing, cache.materials.darkSilver);
  bearing.rotation.z = Math.PI / 2;
  bearing.position.set(-91, 0, 0);
  group.add(bearing);

  const innerBearing = new THREE.Mesh(cache.geometries.innerBearing, cache.materials.metal);
  innerBearing.rotation.z = Math.PI / 2;
  innerBearing.position.set(-92, 0, 0);
  group.add(innerBearing);

  // 2. 中间 - 银色圆柱主体
  const body = new THREE.Mesh(cache.geometries.body, cache.materials.silver);
  body.rotation.z = Math.PI / 2;
  body.position.set(-40, 0, 0);
  body.castShadow = true;
  group.add(body);

  // 银色主体上的螺钉孔位（简化：仅保留4个）
  for (let i = 0; i < 4; i++) {
    const screw = new THREE.Mesh(cache.geometries.screw, cache.materials.darkSilver);
    const angle = (i * Math.PI) / 2;
    screw.position.set(-40, Math.cos(angle) * 32, Math.sin(angle) * 32);
    screw.lookAt(new THREE.Vector3(-40, 0, 0));
    screw.rotateX(Math.PI / 2);
    group.add(screw);
  }

  // 3. 银色转接块
  const transBlock = new THREE.Mesh(cache.geometries.transBlock, cache.materials.silver);
  transBlock.position.set(12, 0, 0);
  transBlock.castShadow = true;
  group.add(transBlock);

  // 转接块上的圆型指示器（简化细分）
  const button = new THREE.Mesh(cache.geometries.button, cache.materials.darkSilver);
  button.position.set(12, 27, 0);
  group.add(button);

  // 4. 右侧 - 黑色散热器主体
  const blackBody = new THREE.Mesh(cache.geometries.blackBody, cache.materials.black);
  blackBody.position.set(75, 0, 0);
  blackBody.castShadow = true;
  group.add(blackBody);

  // 黑色主体上的散热肋片（简化：仅保留2个方向的肋片）
  for (let i = 0; i < 2; i++) {
    const rib = new THREE.Mesh(cache.geometries.rib, cache.materials.black);
    rib.position.set(75, 25, -18 + i * 36);
    group.add(rib);
    
    const rib2 = new THREE.Mesh(cache.geometries.rib, cache.materials.black);
    rib2.position.set(75, -25, -18 + i * 36);
    group.add(rib2);
  }

  // 5. 底部连接座
  const terminal = new THREE.Mesh(cache.geometries.terminal, cache.materials.black);
  terminal.position.set(120, -25, 0);
  group.add(terminal);

  group.userData = { componentType: 'MotorDriver', symbolName: comp.SymbolName };
  group.castShadow = true;
  return group;
};

// 创建底部导航仪（二维码摄像头）
const createBottomNav = (comp) => {
  const group = new THREE.Group();
  
  // 摄像头外壳
  const bodyGeo = new THREE.BoxGeometry(60, 40, 60);
  const body = new THREE.Mesh(bodyGeo, materials.electronics);
  group.add(body);
  
  // 镜头（朝向下）
  const lensGeo = new THREE.CylinderGeometry(15, 15, 10, 32);
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.position.y = -20;
  group.add(lens);
  
  // 红色灯环
  const ringGeo = new THREE.TorusGeometry(20, 2, 16, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = -20;
  ring.rotation.x = Math.PI/2;
  group.add(ring);
  
  group.userData = { componentType: 'Navigator', symbolName: comp.SymbolName };
  return group;
};

// 创建逼真的轮子
const createWheel = (comp) => {
  const group = new THREE.Group();
  
  // 轮胎（橙色/黄色聚氨酯，如照片所示）
  const tireGeo = new THREE.CylinderGeometry(100, 100, 60, 32);
  const tire = new THREE.Mesh(tireGeo, new THREE.MeshStandardMaterial({
    color: 0xffaa00, // 橙色/黄色
    roughness: 0.6,
    metalness: 0.1
  }));
  tire.rotation.z = Math.PI / 2; // 圆柱体默认沿Y轴，旋转以对齐Z轴
  // AGV中轮子在左/右（在AGV中为Y轴，在ThreeJS中为Z），前后滚动（X轴）
  // 轴沿Z轴（ThreeJS）。所以圆柱体（Y轴向上）需要绕X轴旋转90度
  // 重新调整方向
  // ThreeJS圆柱体默认垂直（Y轴）
  // 如果轮轴是侧向的（在场景中为Z轴），需要绕X轴旋转圆柱体90度
  tire.rotation.set(Math.PI / 2, 0, 0); 
  tire.castShadow = true;
  group.add(tire);
  
  // 轮毂（黑色中心）
  const hubGeo = new THREE.CylinderGeometry(70, 70, 62, 32);
  const hub = new THREE.Mesh(hubGeo, new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.5,
    roughness: 0.5
  }));
  hub.rotation.set(Math.PI / 2, 0, 0);
  group.add(hub);
  
  // 轴盖（银色）
  const capGeo = new THREE.CylinderGeometry(15, 15, 70, 16);
  const cap = new THREE.Mesh(capGeo, materials.wheelHub);
  cap.rotation.set(Math.PI / 2, 0, 0);
  group.add(cap);
  
  group.userData = { componentType: 'Wheel', symbolName: comp.SymbolName };
  return group;
};

// 创建LIDAR传感器
const createLidar = (comp) => {
  const group = new THREE.Group();
  
  // 底座
  const baseGeo = new THREE.CylinderGeometry(80, 90, 30, 32);
  const base = new THREE.Mesh(baseGeo, materials.electronics);
  base.position.y = 15;
  base.castShadow = true;
  group.add(base);
  
  // 旋转头部（这种风格通常是黑色，或激活时为蓝色）
  const headGeo = new THREE.CylinderGeometry(70, 70, 60, 32);
  const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0x333333 }));
  head.position.y = 60;
  head.castShadow = true;
  group.add(head);
  
  // 镜头窗口（4个侧面）
  for (let i = 0; i < 4; i++) {
    const lensGeo = new THREE.BoxGeometry(50, 30, 5);
    const lensMat = new THREE.MeshStandardMaterial({ 
      color: 0x000000, 
      transparent: true, 
      opacity: 0.8, 
      metalness: 1.0, 
      roughness: 0.1 
    });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(
      Math.cos((i * Math.PI) / 2) * 70,
      60,
      Math.sin((i * Math.PI) / 2) * 70
    );
    lens.lookAt(0, 60, 0);
    group.add(lens);
  }
  
  group.userData = { componentType: 'Lidar', symbolName: comp.SymbolName };
  return group;
};

// 创建组件标签（始终面向摄像头）
const createLabel = (text, color = 0x333333) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;
  
  // 透明背景以获得清晰的外观
  // context.fillStyle = `rgba(0, 0, 0, 0.6)`;
  // context.fillRect(0, 0, canvas.width, canvas.height);
  
  context.font = 'Bold 48px Arial';
  context.fillStyle = '#000000'; // 白色背景的黑色文本
  context.strokeStyle = '#ffffff';
  context.lineWidth = 4;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  
  // 先描边后填充以提高可见性
  context.strokeText(text, 256, 64);
  context.fillText(text, 256, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(200, 50, 1);
  
  return sprite;
};

const buildModel = () => {
  // 清除现有的
  componentMeshes.forEach((data) => {
    if (data.mesh) scene.remove(data.mesh);
    if (data.label) scene.remove(data.label);
  });
  componentMeshes.clear();
  labelSprites.clear();

  if (!props.agvData || !props.agvData.components) return;

  // 首先添加外壳组件（始终存在）
  const shellComponents = [
    { mesh: createBottomShell(null), pos: [0, 0, 0], label: 'BottomShell' },
    { mesh: createTopCover(null), pos: [0, 0, 0], label: 'TopCover' },
    { mesh: createStatusLights(null), pos: [0, 0, 0], label: 'StatusLights' },
    { mesh: createLiftMechanism(null), pos: [0, 0, 0], label: 'LiftMechanism' }
  ];

  shellComponents.forEach((shellComp, idx) => {
    const mesh = shellComp.mesh;
    const originalPos = new THREE.Vector3(...shellComp.pos);
    const explodedPos = calculateExplodedPosition(originalPos, shellComp.label);

    mesh.position.set(...shellComp.pos);

    // 为每个子元素存储材质
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.userData.originalMaterial = child.material;
      }
    });

    scene.add(mesh);
    componentMeshes.set(mesh.uuid, {
      component: { SymbolName: shellComp.label, DataType: shellComp.label, _x: 0, _y: 0, _angle: 0 },
      mesh: mesh,
      label: null,
      originalPos: originalPos.clone(),
      explodedPos: explodedPos.clone(),
      baseY: 0,
      isShellPart: true
    });
  });

  // 然后添加功能组件
  let driverCount = 0, ioCount = 0, otherCount = 0;

  // 构建组件映射，用于查询导航器引用的传感器，以及收集被引用的传感器名称
  const componentMap = new Map();
  const referencedSensors = new Set(); // 被BarcodeNavigator和SlamNavigator引用的传感器
  
  props.agvData.components.forEach((comp) => {
    componentMap.set(comp.SymbolName, comp);
  });

  // 扫描BarcodeNavigator和SlamNavigator组件，收集被引用的传感器
  props.agvData.components.forEach((comp) => {
    if ((comp.DataType === 'BarcodeNavigator' || comp.DataType === 'SlamNavigator') && comp.References && comp.References.Reference) {
      const reference = comp.References.Reference;
      const references = Array.isArray(reference) ? reference : [reference];
      
      if (references.length > 0 && references[0].ReferenceItem) {
        const refItems = Array.isArray(references[0].ReferenceItem) ? references[0].ReferenceItem : [references[0].ReferenceItem];
        if (refItems.length > 0) {
          referencedSensors.add(refItems[0].Value);
        }
      }
    }
  });

  // 然后遍历所有组件进行渲染
  props.agvData.components.forEach((comp) => {
    let mesh = null;
    const dataType = comp.DataType;
    
    if (dataType === 'Chassis') {
      return; // 跳过，已处理外壳
    } else if (dataType === 'BarcodeNavigator') {
      // 从BarcodeNavigator的References中获取实际的传感器名称
      if (comp.References && comp.References.Reference) {
        const reference = comp.References.Reference;
        // 支持单个或多个引用
        const references = Array.isArray(reference) ? reference : [reference];
        
        // 获取第一个引用项（BarcodeSensor等）
        if (references.length > 0 && references[0].ReferenceItem) {
          const refItems = Array.isArray(references[0].ReferenceItem) ? references[0].ReferenceItem : [references[0].ReferenceItem];
          if (refItems.length > 0) {
            const sensorName = refItems[0].Value;
            const sensorComp = componentMap.get(sensorName);
            
            if (sensorComp) {
              // 使用传感器的DataType来创建模型
              const sensorDataType = sensorComp.DataType;
              if (sensorDataType.includes('Irayple') || sensorDataType.includes('Sc2000')) {
                mesh = createBottomNav(sensorComp);
                comp = sensorComp; // 使用传感器的位置和属性
              }
            }
          }
        }
      }
      
      // 如果没有找到有效的传感器引用，则跳过
      if (!mesh) return;
    } else if (dataType === 'SlamNavigator') {
      // 从SlamNavigator的References中获取实际的激光雷达传感器名称
      if (comp.References && comp.References.Reference) {
        const reference = comp.References.Reference;
        // 支持单个或多个引用
        const references = Array.isArray(reference) ? reference : [reference];
        
        // 获取第一个引用项（LaserScanners等）
        if (references.length > 0 && references[0].ReferenceItem) {
          const refItems = Array.isArray(references[0].ReferenceItem) ? references[0].ReferenceItem : [references[0].ReferenceItem];
          if (refItems.length > 0) {
            const sensorName = refItems[0].Value;
            const sensorComp = componentMap.get(sensorName);
            
            if (sensorComp) {
              // 使用传感器的DataType来创建模型
              const sensorDataType = sensorComp.DataType;
              if (sensorDataType.includes('R2000')) {
                mesh = createLidar(sensorComp);
                comp = sensorComp; // 使用传感器的位置和属性
              }
            }
          }
        }
      }
      
      // 如果没有找到有效的传感器引用，则跳过
      if (!mesh) return;
    } else if (referencedSensors.has(comp.SymbolName) ) {
      // 跳过被BarcodeNavigator和SlamNavigator引用的传感器（避免重复渲染）
      return;
    } else if (dataType.includes('Wheel')) {
      mesh = createWheel(comp);
    } else if (dataType.includes('D011003V100')) {
      mesh = createElectronicBox(comp, [120, 50, 100], 'driver');
    } else if (dataType.includes('Pio') || dataType.includes('CAN') || dataType.includes('COM')) {
      mesh = createElectronicBox(comp, [80, 30, 60], 'io');
    } else if (dataType.includes('Mcd') || dataType.includes('Guidance')) {
      const group = new THREE.Group();
      const pcb = new THREE.Mesh(new THREE.BoxGeometry(100, 10, 80), materials.pcb);
      group.add(pcb);
      group.userData = { componentType: 'Logic', symbolName: comp.SymbolName };
      mesh = group;
    } else {
      return;
    }
    
    if (!mesh) return;
    
    let pX = comp._x || 0;
    let pZ = -(comp._y || 0);
    let pY = 0;
    
    if (dataType.includes('Wheel')) {
      pY = 100;
      // 调整轮子位置，使其在BottomShell外部显示，增加左右轮子间距
      // BottomShell宽度1300，轮子直径100，所以x位置应该在±700左右
      if (pX > 0) {
        pZ = Math.max(pZ, 400); // 右轮子
      } else if (pX < 0) {
        pZ = Math.min(pZ, -400); // 左轮子
      } else {
        // 如果x为0，根据z轴位置判断左右
        pZ = pZ > 0 ? 400 : -400;
      }
    } else if (dataType.includes('Irayple') || dataType.includes('Sc2000')) {
      pY = 70; // 向上移50个单位，与BottomShell保持相对位置
    } else if (dataType.includes('R2000')) {
      pY = 130; // 放在外壳内部，y轴与SlamNavigator保持一致
      pX = 450; // 放在模型最右边
      pZ = 0;
    } else if (dataType.includes('Slam')) {
      pY = 130; // 与R2000保持y轴一致
      pX = 450; // 放在模型最左边
      pZ = 0;
    } else if (dataType.includes('D011003V100')) {
      pY = 130; // 驱动器位置高度
      
      // 三个驱动器的配置：两个轮驱，一个升降驱
      if (driverCount === 0) {
        // 第一个驱动：左轮驱动
        pX = 0;    // 与左轮对齐的x位置
        pZ = -380;   // 左侧（与左轮z位置对齐）
      } else if (driverCount === 1) {
        // 第二个驱动：右轮驱动
        pX = 0;    // 与右轮对齐的x位置
        pZ = 380;    // 右侧（与右轮z位置对齐）
      } else {
        // 第三个驱动：升降驱动（中心偏x方向）
        pX = 350;   // 中心偏后方（负x方向）
        pZ = 0;      // 中心线
      }
      driverCount++;
    } else if (dataType.includes('Pio') || dataType.includes('CAN')) {
      pY = 130; // 向上移50个单位，与BottomShell保持相对位置
      pZ = 0;
      pX = -400 + ioCount * 100;
      ioCount++;
    } else {
      pY = 130; // 向上移50个单位，与BottomShell保持相对位置
      pX = 0 + otherCount * 100;
      otherCount++;
    }

    let angleVal = comp._angle || 0;
    if (Math.abs(angleVal) > 360) angleVal /= 100;
    mesh.rotation.y = -(angleVal * Math.PI / 180);
    
    mesh.position.set(pX, pY, pZ);
    
    mesh.userData.symbolName = comp.SymbolName;
    mesh.userData.componentType = dataType;

    // 存储原始材质
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.userData.originalMaterial = child.material;
      }
    });

    const originalPos = new THREE.Vector3(pX, pY, pZ);
    const explodedPos = calculateExplodedPosition(originalPos, dataType);

    const label = createLabel(comp.SymbolName);
    label.position.copy(originalPos);
    label.position.y += 100;
    label.visible = false;
    scene.add(label);
    
    scene.add(mesh);
    
    componentMeshes.set(mesh.uuid, {
      component: comp,
      mesh: mesh,
      label: label,
      originalPos: originalPos.clone(),
      explodedPos: explodedPos.clone(),
      baseY: pY
    });
  });
  
  updateExplosion();
};

const calculateExplodedPosition = (originalPos, dataType) => {
  const exploded = originalPos.clone();
  const offset = 600; // 较大的爆炸偏移
  
  if (dataType === 'BottomShell') {
    // 底壳下降
    exploded.y -= offset * 1.5;
  } else if (dataType === 'TopCover') {
    // 顶盖向上飞起更多，避免遮挡俯视视图
    exploded.y += offset * 10;
  } else if (dataType === 'StatusLights') {
    // 灯基本保持原位但略微向外
    exploded.x *= 1.3;
    exploded.z *= 1.3;
  } else if (dataType === 'LiftMechanism') {
    // 升降机构下降更多
    exploded.y -= offset * 2;
  } else if (dataType.includes('Wheel')) {
    // 轮子向两侧大幅分散
    exploded.z = exploded.z > 0 ? exploded.z + offset * 1.5 : exploded.z - offset * 1.5;
  } else if (dataType.includes('Irayple')) {
    // 底部导航仪向下移动很远
    exploded.y = -offset * 0.5;
  } else if (dataType.includes('Sc2000')) {
    exploded.y = -offset * 0.25;
  }
  else if (dataType.includes('R2000')) {
    // 激光雷达向右飞起
    exploded.x += offset * 0.5;
    exploded.y += offset * 0.8;
  }
  else if (dataType.includes('D011003V100')) {
    // 根据Z位置判断：Z=0是升降驱，Z=±380是轮驱
    if (Math.abs(originalPos.z) < 50) {
      // 第三个驱动：升降驱动（Z≈0）
      exploded.y += offset * 1.3;
    } else {
      // 第一、二个驱动：轮驱动（Z=±380）
      exploded.y += offset * 0.8;
    }
  } else {
    // 电子设备辐向四周并向上散开
    exploded.x *= 1.8;
    exploded.z *= 1.8;
    exploded.y += offset * 0.8;
  }
  
  return exploded;
};

const toggleExplodedView = () => {
  isExploded.value = !isExploded.value;
  // 仅在爆炸视图中显示标签
  componentMeshes.forEach(data => {
    if (data.label) data.label.visible = isExploded.value;
  });
  updateExplosion();
};

const updateExplosion = () => {
  componentMeshes.forEach((data) => {
    if (!data.mesh) return;
    
    const targetPos = isExploded.value ? data.explodedPos : data.originalPos;
    data.mesh.position.lerp(targetPos, 0.1);
    
    if (data.label && data.label.visible) {
      const labelTarget = targetPos.clone();
      labelTarget.y += 150;
      data.label.position.lerp(labelTarget, 0.1);
    }
  });
  
  const isAnimating = Array.from(componentMeshes.values()).some(data => {
    const targetPos = isExploded.value ? data.explodedPos : data.originalPos;
    return data.mesh.position.distanceTo(targetPos) > 1;
  });
  
  if (isAnimating) {
    requestAnimationFrame(updateExplosion);
  }
};

const resetCamera = () => {
  camera.position.set(1800, 1200, 1800);
  camera.lookAt(0, 200, 0);
  controls.target.set(0, 200, 0);
  controls.update();
};

const updateModel = () => {
  buildModel();
};

// 更新选中的视觉反馈 - 正确恢复材质
const updateSelection = () => {
  componentMeshes.forEach((data) => {
    if (!data.mesh) return;

    const isSelected = data.component.SymbolName === props.selectedId;
    // 确保这些组件永远不会被高亮
    const unSelectableComponents = ['StatusLights',  'TopCover', 'LiftMechanism'];
    const shouldHighlight = isSelected && !unSelectableComponents.includes(data.component.SymbolName);

    // 处理组
    data.mesh.traverse((child) => {
      if (child.isMesh) {
        // 初始化：如果未存储原始材质则存储
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material;
        }

        if (shouldHighlight) {
          // 高亮显示已选中
          child.material = materials.selected;
        } else {
          // 恢复原始材质
          child.material = child.userData.originalMaterial;
        }
      }
    });

    // 略微提升选中的组件（除了大的外壳）
    if (shouldHighlight && !isExploded.value && data.component.DataType !== 'Chassis') {
      data.mesh.position.y = data.baseY + 20;
    } else if (!isExploded.value) {
      data.mesh.position.y = data.baseY;
    }

    // 特殊：如果内部有东西被选中，是否使外壳透明？
    // 暂未实现以保持简单，但我们可以实现

    // 更新标签可见性
    if (data.label) {
      data.label.visible = isExploded.value || shouldHighlight;
    }
  });
};

const animate = () => {
  animationId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};

const onWindowResize = () => {
  if (!container.value) return;
  camera.aspect = container.value.clientWidth / container.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
};

const onMouseClick = (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    let clickedObject = intersects[0].object;
    while (clickedObject && !clickedObject.userData.symbolName) {
      clickedObject = clickedObject.parent;
      if (clickedObject === scene) {
        clickedObject = null;
        break;
      }
    }
    
    if (clickedObject && clickedObject.userData.symbolName) {
      // 这些组件不可选中
      const unSelectableComponents = ['StatusLights',  'TopCover', 'LiftMechanism'];
      if (unSelectableComponents.includes(clickedObject.userData.symbolName)) {
        emit('select-component', null);
        return;
      }

      // 检查是否是 Irayple 类型的摄像头模块
      const componentData = Array.from(componentMeshes.values()).find(
        data => data.component.SymbolName === clickedObject.userData.symbolName
      );

      if (componentData && componentData.component.DataType.includes('Irayple')) {
        // 显示摄像头视频面板
        showCameraVideo(componentData.component);
      } else {
        // 关闭视频面板，显示其他组件选择
        closeVideoPanel();
        emit('select-component', clickedObject.userData.symbolName);
      }
      return;
    }
  }
  emit('select-component', null);
};

// 显示摄像头视频（使用 WebRTC）
const showCameraVideo = async (component) => {
  selectedComponentName.value = component.SymbolName;
  showVideoPanel.value = true;
  
  // 等待 DOM 更新（确保 video 元素已渲染）
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 初始化 WebRTC 连接
  try {
    await startWebRTC();
  } catch (error) {
    console.error('[AGV] 启动视频流失败:', error);
  }
  
  emit('select-component', component.SymbolName);
};

// 关闭视频面板
const closeVideoPanel = async () => {
  // 关闭 WebRTC 连接
  await closeWebRTC();
  
  showVideoPanel.value = false;
  selectedComponentName.value = '';
  videoUrl.value = '';
  stopDrag(); // 清理拖动状态
};

watch(() => props.agvData, () => {
  updateModel();
}, { deep: true });

watch(() => props.selectedId, () => {
  updateSelection();
});

onMounted(() => {
  initThree();
  buildModel();
  animate();
});

onBeforeUnmount(async () => {
  // 清理 WebRTC 连接
  await closeWebRTC();
  
  cancelAnimationFrame(animationId);
  window.removeEventListener('resize', onWindowResize);
  container.value.removeEventListener('click', onMouseClick);
  // 清理拖动相关的全局监听器
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  renderer.dispose();
  scene.clear();
});
</script>

<style scoped>
.three-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #f5f5f5; /* 为白色AGV的浅灰色背景 */
  position: relative;
}

.view-controls {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 10;
  display: flex;
  gap: 10px;
}

.control-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #ddd;
  color: #333;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.control-btn:hover {
  background: white;
  border-color: #007acc;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 122, 204, 0.2);
}

.control-btn.active {
  background: #007acc;
  color: white;
  border-color: #007acc;
}

.control-btn:active {
  transform: translateY(0);
}

/* 摄像头视频面板样式 */
.video-panel {
  position: fixed; /* 使用 fixed 以支持在整个窗口范围内拖动 */
  bottom: 20px;
  right: 20px;
  background: #000; /* 纯黑背景 */
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  width: 640px; /* 放大宽度（原 320px） */
  height: 480px; /* 新增：显式指定高度 */
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  -webkit-user-select: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: grab;
}

.video-panel:active {
  cursor: grabbing;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.video-container {
  width: 100%;
  flex: 1; /* 填充剩余空间 */
  background: #000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-stream {
  width: 100%;
  height: 100%;
  object-fit: contain; /* 核心：确保视频内容完整显示，不裁剪 */
  display: block;
  pointer-events: none; /* 防止图片干扰拖动 */
}

.video-close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
  z-index: 1001;
  backdrop-filter: blur(4px);
}

.video-close-btn:hover {
  background: rgba(255, 0, 0, 0.7);
  transform: scale(1.1);
}

/* 过渡动画 */
.video-panel-enter-active,
.video-panel-leave-active {
  transition: all 0.2s ease;
}

.video-panel-enter-from,
.video-panel-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .video-panel {
    width: 240px;
    bottom: 10px;
    right: 10px;
  }
}
</style>
