import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

const container = document.querySelector('#point-cloud-viewer');
const buttons = document.querySelectorAll('[data-scene]');
const resetButton = document.querySelector('#reset-view');
const toggleSpinButton = document.querySelector('#toggle-spin');

const metricTarget = document.querySelector('#metric-target');
const metricParams = document.querySelector('#metric-params');
const metricFlow = document.querySelector('#metric-flow');

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

let activeScene = 'tunnel';
let autoSpin = true;
let sceneRequestId = 0;
const plyPointClouds = new Map();

const sceneConfig = {
  tunnel: {
    path: './data/tunnel2.ply',
    loadingText: '正在加载隧道滑槽点云',
    errorText: '隧道滑槽点云加载失败',
    label: '隧道滑槽检测点云',
    labelColor: 0xff9b55,
    pointSize: 0.018,
  },
  ocs: {
    path: './data/ocs.ply',
    loadingText: '正在加载 OCS 点云',
    errorText: 'OCS 点云加载失败',
    label: '腕臂部件识别与测距',
    labelColor: 0x8bd6ff,
    pointSize: 0.018,
  },
};

const sceneMeta = {
  tunnel: {
    target: '隧道顶部滑槽',
    params: '深度、长度、间距',
    flow: 'ROI 提取、截面分析、凹陷定位',
  },
  ocs: {
    target: '绝缘子、螺栓、管帽、腕臂杆件',
    params: '空间位置、相对距离、结构关系',
    flow: '部件分割、杆件拟合、小零件定位',
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
  const config = sceneConfig[name];
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
  const config = sceneConfig[name];
  const group = new THREE.Group();
  const pointCloud = await loadPlyPointCloud(name);
  group.add(pointCloud);

  const label = makeLabelPlane(config.label, config.labelColor);
  label.position.set(0.2, 2.8, 0);
  group.add(label);

  return group;
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

async function setScene(name) {
  const requestId = ++sceneRequestId;
  activeScene = name;
  root.clear();
  root.rotation.y = 0;

  const config = sceneConfig[name];
  root.add(makeLoadingScene(config.loadingText));
  try {
    const plyScene = await generatePlyScene(name);
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
    console.error(`Failed to load ${name} PLY point cloud:`, error);
  }

  const meta = sceneMeta[name];
  metricTarget.textContent = meta.target;
  metricParams.textContent = meta.params;
  metricFlow.textContent = meta.flow;

  buttons.forEach((button) => {
    button.classList.toggle('active', button.dataset.scene === name);
  });
  resetView();
}

function resetView() {
  if (activeScene === 'tunnel') {
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

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    setScene(button.dataset.scene);
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
