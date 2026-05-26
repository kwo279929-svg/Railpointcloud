import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

const container = document.querySelector('#point-cloud-viewer');
const projectButtons = document.querySelectorAll('[data-project]');
const methodButtons = document.querySelectorAll('[data-method]');
const resetButton = document.querySelector('#reset-view');
const toggleSpinButton = document.querySelector('#toggle-spin');

const metricTarget = document.querySelector('#metric-target');
const metricParams = document.querySelector('#metric-params');
const metricFlow = document.querySelector('#metric-flow');
const metricSummary = document.querySelector('#metric-summary');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07131f);
scene.fog = new THREE.Fog(0x07131f, 18, 44);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
camera.position.set(7.5, 5.5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 4;
controls.maxDistance = 26;
controls.target.set(0, 0.2, 0);

const root = new THREE.Group();
scene.add(root);

const loader = new PLYLoader();

const grid = new THREE.GridHelper(18, 18, 0x244156, 0x162b3a);
grid.position.y = -2.1;
scene.add(grid);

const ambient = new THREE.AmbientLight(0xffffff, 0.52);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xdff8ff, 1.6);
keyLight.position.set(5, 9, 7);
scene.add(keyLight);

let activeProject = 'tunnel';
let activeMethod = 'traditional';
let autoSpin = true;
let sceneRequestId = 0;
const plyPointClouds = new Map();

const sceneConfig = {
  tunnel: {
    traditional: {
      path: './data/t_t.ply',
      loadingText: '正在加载隧道传统算法结果',
      errorText: '隧道传统算法结果加载失败',
      label: '隧道滑槽检测 · 传统算法',
      labelColor: 0xff9b55,
      pointSize: 0.02,
      target: '隧道顶部滑槽',
      params: '深度、长度、间距',
      flow: '几何特征、截面分析、规则阈值',
      summary: '基于传统几何规则对滑槽区域进行检测，突出可解释的截面与空间参数测量。',
    },
    deep: {
      path: './data/tunnel2.ply',
      loadingText: '正在加载隧道深度学习结果',
      errorText: '隧道深度学习结果加载失败',
      label: '隧道滑槽检测 · 深度学习',
      labelColor: 0xff9b55,
      pointSize: 0.018,
      target: '隧道顶部滑槽',
      params: '深度、长度、间距',
      flow: '模型预测、滑槽分割、几何参数计算',
      summary: '结合深度学习预测结果定位滑槽区域，用于提升复杂结构和噪声场景下的识别稳定性。',
    },
  },
  ocs: {
    traditional: {
      path: './data/t_o.ply',
      loadingText: '正在加载 OCS 传统算法结果',
      errorText: 'OCS 传统算法结果加载失败',
      label: 'OCS 腕臂识别 · 传统算法',
      labelColor: 0x8bd6ff,
      pointSize: 0.026,
      target: '绝缘子、螺栓、管帽、腕臂杆件',
      params: '空间位置、相对距离、结构关系',
      flow: '几何结构、空间关系、规则分割',
      summary: '基于杆件形态和空间连接关系识别腕臂部件，适合展示规则方法的可解释流程。',
    },
    deep: {
      path: './data/ocs.ply',
      loadingText: '正在加载 OCS 深度学习结果',
      errorText: 'OCS 深度学习结果加载失败',
      label: 'OCS 腕臂识别 · 深度学习',
      labelColor: 0x8bd6ff,
      pointSize: 0.018,
      target: '绝缘子、螺栓、管帽、腕臂杆件',
      params: '空间位置、相对距离、结构关系',
      flow: '模型预测、部件分割、场景解析',
      summary: '结合深度学习结果完成腕臂场景部件级识别，支撑接触网设施数字化建模。',
    },
  },
};

function pseudoRandom(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function makePointCloud(points, colors, size = 0.035) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.96,
  });

  return new THREE.Points(geometry, material);
}

function makePlyPointCloud(geometry, pointSize = 0.018) {
  geometry.computeBoundingBox();
  const center = new THREE.Vector3();
  geometry.boundingBox.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);

  const size = new THREE.Vector3();
  geometry.computeBoundingBox();
  geometry.boundingBox.getSize(size);
  const maxDimension = Math.max(size.x, size.y, size.z);
  const scale = maxDimension > 0 ? 8 / maxDimension : 1;
  geometry.scale(scale, scale, scale);

  const material = new THREE.PointsMaterial({
    size: pointSize,
    vertexColors: geometry.hasAttribute('color'),
    color: 0x8bd6ff,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.96,
  });

  return new THREE.Points(geometry, material);
}

function loadPlyPointCloud(name) {
  const config = getSceneConfig(name);
  if (plyPointClouds.has(name)) {
    return Promise.resolve(plyPointClouds.get(name).clone());
  }

  return new Promise((resolve, reject) => {
    loader.load(
      config.path,
      (geometry) => {
        const pointCloud = makePlyPointCloud(geometry, config.pointSize);
        plyPointClouds.set(name, pointCloud);
        resolve(pointCloud.clone());
      },
      undefined,
      reject
    );
  });
}

function addPoint(points, colors, x, y, z, color) {
  points.push(x, y, z);
  colors.push(color.r, color.g, color.b);
}

async function generatePlyScene(name) {
  const config = getSceneConfig(name);
  const group = new THREE.Group();
  const pointCloud = await loadPlyPointCloud(name);
  group.add(pointCloud);

  const label = makeLabelPlane(config.label, config.labelColor);
  label.position.set(0.2, 2.8, 0);
  group.add(label);

  return group;
}

function getSceneKey(project = activeProject, method = activeMethod) {
  return `${project}-${method}`;
}

function getSceneConfig(name = getSceneKey()) {
  const [project, method] = name.split('-');
  return sceneConfig[project][method];
}

function addCylinderCloud(points, colors, start, end, radius, count, color, seedStart) {
  const direction = new THREE.Vector3(
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2]
  );
  const length = direction.length();
  const axis = direction.clone().normalize();
  const helper = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const normalA = new THREE.Vector3().crossVectors(axis, helper).normalize();
  const normalB = new THREE.Vector3().crossVectors(axis, normalA).normalize();

  let seed = seedStart;
  for (let i = 0; i < count; i += 1) {
    const t = pseudoRandom(seed++);
    const angle = pseudoRandom(seed++) * Math.PI * 2;
    const jitter = (pseudoRandom(seed++) - 0.5) * 0.025;
    const r = radius + jitter;
    const center = new THREE.Vector3(...start).add(axis.clone().multiplyScalar(length * t));
    const offset = normalA
      .clone()
      .multiplyScalar(Math.cos(angle) * r)
      .add(normalB.clone().multiplyScalar(Math.sin(angle) * r));
    const p = center.add(offset);
    addPoint(points, colors, p.x, p.y, p.z, color);
  }
}

function addInsulator(points, colors, center, color, seedStart) {
  let seed = seedStart;
  for (let ring = 0; ring < 7; ring += 1) {
    const x = center[0] + (ring - 3) * 0.18;
    const radius = ring % 2 === 0 ? 0.34 : 0.22;
    for (let i = 0; i < 260; i += 1) {
      const angle = pseudoRandom(seed++) * Math.PI * 2;
      const radialNoise = (pseudoRandom(seed++) - 0.5) * 0.025;
      const y = center[1] + Math.cos(angle) * (radius + radialNoise);
      const z = center[2] + Math.sin(angle) * (radius + radialNoise);
      addPoint(points, colors, x, y, z, color);
    }
  }
}

function addSmallParts(points, colors, boltColor, capColor) {
  const parts = [
    [-4.95, 0.03, 0],
    [-3.05, -1.12, 0],
    [2.18, 2.08, 0],
    [5.18, 0.9, 0],
  ];

  parts.forEach((part, index) => {
    const color = index === 3 ? capColor : boltColor;
    let seed = 700 + index * 50;
    for (let i = 0; i < 360; i += 1) {
      const theta = pseudoRandom(seed++) * Math.PI * 2;
      const phi = pseudoRandom(seed++) * Math.PI;
      const r = 0.22 + (pseudoRandom(seed++) - 0.5) * 0.02;
      const x = part[0] + Math.sin(phi) * Math.cos(theta) * r;
      const y = part[1] + Math.cos(phi) * r;
      const z = part[2] + Math.sin(phi) * Math.sin(theta) * r;
      addPoint(points, colors, x, y, z, color);
    }
  });
}

function makeLabelPlane(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(7, 19, 31, 0.72)';
  roundRect(ctx, 16, 18, 480, 92, 18);
  ctx.fill();
  ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 4;
  roundRect(ctx, 16, 18, 480, 92, 18);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px Microsoft YaHei, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.8, 0.95, 1);
  return sprite;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function makeLoadingScene(text) {
  const group = new THREE.Group();
  const label = makeLabelPlane(text, 0x8bd6ff);
  group.add(label);
  return group;
}

async function setScene(project = activeProject, method = activeMethod) {
  const requestId = ++sceneRequestId;
  activeProject = project;
  activeMethod = method;
  const sceneKey = getSceneKey(project, method);
  root.clear();
  root.rotation.y = 0;

  const config = getSceneConfig(sceneKey);
  root.add(makeLoadingScene(config.loadingText));
  try {
    const plyScene = await generatePlyScene(sceneKey);
    if (requestId !== sceneRequestId) {
      return;
    }
    root.clear();
    root.add(plyScene);
  } catch (error) {
    if (requestId !== sceneRequestId) {
      return;
    }
    root.clear();
    root.add(makeLoadingScene(config.errorText));
    console.error(`Failed to load ${sceneKey} PLY point cloud:`, error);
  }

  metricTarget.textContent = config.target;
  metricParams.textContent = config.params;
  metricFlow.textContent = config.flow;
  metricSummary.textContent = config.summary;

  projectButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.project === project);
  });
  methodButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.method === method);
  });
  resetView();
}

function resetView() {
  if (activeProject === 'tunnel') {
    camera.position.set(7.5, 5.5, 10);
    controls.target.set(0, 0.2, 0);
  } else {
    camera.position.set(7.2, 4.2, 8.2);
    controls.target.set(0, 0.35, 0);
  }
  controls.update();
}

function resize() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);
  if (autoSpin) {
    root.rotation.y += 0.0026;
  }
  controls.update();
  renderer.render(scene, camera);
}

projectButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setScene(button.dataset.project, activeMethod);
  });
});

methodButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setScene(activeProject, button.dataset.method);
  });
});

resetButton.addEventListener('click', resetView);

toggleSpinButton.addEventListener('click', () => {
  autoSpin = !autoSpin;
  toggleSpinButton.textContent = autoSpin ? '暂停旋转' : '开启旋转';
});

window.addEventListener('resize', resize);

setScene('tunnel');
resize();
animate();
