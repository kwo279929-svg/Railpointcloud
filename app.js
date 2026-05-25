import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

function addPoint(points, colors, x, y, z, color) {
  points.push(x, y, z);
  colors.push(color.r, color.g, color.b);
}

function generateTunnelScene() {
  const group = new THREE.Group();
  const points = [];
  const colors = [];
  const wallColor = new THREE.Color(0x78c7d8);
  const slotColor = new THREE.Color(0xff9b55);
  const markerColor = new THREE.Color(0xf8e16c);

  let seed = 1;
  for (let i = 0; i < 9800; i += 1) {
    const theta = Math.PI * (0.08 + pseudoRandom(seed++) * 0.84);
    const z = -7.4 + pseudoRandom(seed++) * 14.8;
    const radiusNoise = (pseudoRandom(seed++) - 0.5) * 0.08;
    const slotCenter = Math.abs(theta - Math.PI / 2) < 0.1 && z > -3.6 && z < 3.8;
    const radius = 4.05 + radiusNoise - (slotCenter ? 0.45 : 0);
    const x = Math.cos(theta) * radius;
    const y = Math.sin(theta) * radius - 2.1;
    const color = slotCenter ? slotColor : wallColor;
    addPoint(points, colors, x, y, z, color);
  }

  for (let k = 0; k < 5; k += 1) {
    const z = -4.8 + k * 2.4;
    const geometry = new THREE.TorusGeometry(0.24, 0.016, 8, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xf8e16c });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(0, 1.5, z);
    marker.rotation.x = Math.PI / 2;
    group.add(marker);
  }

  const pointCloud = makePointCloud(points, colors, 0.036);
  group.add(pointCloud);

  const label = makeLabelPlane('滑槽凹陷区域', 0xff9b55);
  label.position.set(0, 2.6, -1.6);
  group.add(label);

  return group;
}

function generateOcsScene() {
  const group = new THREE.Group();
  const points = [];
  const colors = [];
  const armColor = new THREE.Color(0x8bd6ff);
  const insulatorColor = new THREE.Color(0xffc766);
  const boltColor = new THREE.Color(0xf2f7ff);
  const capColor = new THREE.Color(0xff7f50);

  addCylinderCloud(points, colors, [-5, 0, 0], [5.2, 0.9, 0], 0.12, 2200, armColor, 101);
  addCylinderCloud(points, colors, [-3.2, -1.2, 0], [2.2, 2.1, 0], 0.1, 1700, armColor, 211);
  addCylinderCloud(points, colors, [-1.2, 0.3, -1.7], [2.4, 0.8, 1.7], 0.09, 1300, armColor, 321);
  addInsulator(points, colors, [-3.9, 0.1, 0], insulatorColor, 420);
  addInsulator(points, colors, [2.9, 0.72, 0], insulatorColor, 520);
  addSmallParts(points, colors, boltColor, capColor);

  const pointCloud = makePointCloud(points, colors, 0.045);
  group.add(pointCloud);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 4.8, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x2c4658, roughness: 0.7 })
  );
  base.position.set(-5.4, -1.0, 0);
  group.add(base);

  const label = makeLabelPlane('腕臂部件识别与测距', 0x8bd6ff);
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

function setScene(name) {
  activeScene = name;
  root.clear();
  root.add(name === 'tunnel' ? generateTunnelScene() : generateOcsScene());

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
  button.addEventListener('click', () => setScene(button.dataset.scene));
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
