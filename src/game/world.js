import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG, seededRandom } from './engine.js';

const UP = new THREE.Vector3(0, 1, 0);
const CHUNK_LENGTH = 16;
const CHUNK_COUNT = 12;
const TRACK_LENGTH = CHUNK_LENGTH * CHUNK_COUNT;
const GROUND = 0.18;

const cylinder = new THREE.CylinderGeometry(1, 1, 1, 7);
const rock = new THREE.DodecahedronGeometry(1, 0);
const ball = new THREE.IcosahedronGeometry(1, 1);
const box = new THREE.BoxGeometry(1, 1, 1);

function leafGeometry(serrated = false) {
  const positions = [];
  const indices = [];
  const segments = 9;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const width = Math.sin(Math.PI * t) * (serrated && i % 2 ? 0.17 : 0.245);
    const bend = Math.sin(t * Math.PI) * 0.16 - t * t * 0.16;
    positions.push(-width, t, bend, 0, t, bend + Math.sin(Math.PI * t) * 0.065, width, t, bend);
    if (i < segments) {
      const a = i * 3;
      indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
const broadLeaf = leafGeometry();
const palmLeaf = leafGeometry(true);

/** Bake the jungle into one vertex-colored draw call per track chunk. */
class Batch {
  constructor() { this.parts = []; }
  add(geometry, color, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], quaternion = null) {
    let part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    part.deleteAttribute('uv');
    part.deleteAttribute('uv1');
    part.deleteAttribute('tangent');
    const q = quaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    part.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), q, new THREE.Vector3(...scale)));
    const c = new THREE.Color(color);
    const colors = new Float32Array(part.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push(part);
    return this;
  }
  branch(from, to, radius, color) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    return this.add(cylinder, color, a.add(b).multiplyScalar(0.5).toArray(), [radius, direction.length(), radius], [0, 0, 0], new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()));
  }
  leaf(position, direction, length, color, narrow = false) {
    const q = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...direction).normalize());
    return this.add(narrow ? palmLeaf : broadLeaf, color, position, [length, length, length], [0, 0, 0], q);
  }
  mesh(shadows = true) {
    const geometry = mergeGeometries(this.parts, false);
    this.parts.forEach((part) => part.dispose());
    this.parts = [];
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }));
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    return mesh;
  }
}

function addPalm(batch, x, z, height, random) {
  const lean = (random() - 0.5) * 1.8;
  for (let i = 0; i < 6; i++) {
    const a = i / 6, b = (i + 1) / 6;
    batch.branch([x + lean * a * a, height * a, z], [x + lean * b * b, height * b, z], 0.24 - a * 0.09, i % 2 ? 0x8c7850 : 0xa18a5b);
  }
  const top = [x + lean, height, z];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + random() * 0.3;
    batch.leaf(top, [Math.cos(angle), 0.12 - random() * 0.5, Math.sin(angle)], 3.5 + random() * 1.7, [0x4b9b3e, 0x65ad43, 0x7ab84a, 0x36853a][i % 4], true);
  }
  for (let i = 0; i < 3; i++) batch.add(ball, 0x776333, [x + lean + Math.cos(i * 2.1) * 0.25, height - 0.2, z + Math.sin(i * 2.1) * 0.25], [0.24, 0.28, 0.24]);
}

function addPlant(batch, x, z, size, random, fern = false) {
  const count = fern ? 7 : 5;
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2 + random() * 0.4;
    batch.leaf([x, 0.05, z], [Math.cos(angle) * 0.85, 0.45 + random() * 0.8, Math.sin(angle) * 0.85], size * (0.75 + random() * 0.4), [0x3e8737, 0x65a83e, 0x83bb49, 0x4d983b][i % 4], fern);
  }
}

function makeChunk(index) {
  const random = seededRandom(700 + index * 93);
  const batch = new Batch();
  const logColors = [0xaa8952, 0xb89a60, 0x967746, 0xc0a16a, 0xa58b55];
  for (let lane = -1; lane <= 1; lane++) {
    for (let log = 0; log < 5; log++) {
      const x = lane * CONFIG.laneWidth + (log - 2) * 0.43;
      const length = 15.85 + random() * 0.15;
      batch.add(cylinder, logColors[(log + index) % 5], [x, -0.105, (random() - 0.5) * 0.12], [0.225, length, 0.225], [Math.PI / 2, 0, 0]);
      if (log % 2 === 0) batch.add(ball, 0x759344, [x, 0.105, (random() > 0.5 ? 1 : -1) * 7.4], [0.2, 0.045, 0.45 + random() * 0.3]);
    }
    for (const z of [-5.7, 5.7]) {
      batch.add(box, 0x71603d, [lane * CONFIG.laneWidth, 0.145, z], [2.13, 0.055, 0.1]);
      batch.add(box, 0xc3ae76, [lane * CONFIG.laneWidth, 0.15, z + 0.1], [2.13, 0.04, 0.045]);
    }
  }
  for (const side of [-1, 1]) {
    const bankX = side * (13 + random() * 2);
    batch.add(rock, 0x7d8970, [bankX, -1.1, 0], [7.4, 1.8, 9.4], [0, random(), 0]);
    batch.add(ball, 0xb8b77b, [bankX, -0.4, 0], [7, 0.65, 9]);
    batch.add(ball, 0x639447, [bankX + side * 0.7, -0.08, 0], [6.1, 0.35, 8.1]);
    addPalm(batch, side * (9.5 + random() * 4), -4 + random() * 8, 6 + random() * 3.5, random);
    addPalm(batch, side * (15 + random() * 4), -6 + random() * 12, 8 + random() * 3, random);
    for (let i = 0; i < 4; i++) addPlant(batch, side * (6.8 + random() * 4), -7 + random() * 14, 1.5 + random() * 1.7, random, i % 2 === 0);
    for (let i = 0; i < 3; i++) {
      const x = side * (5.5 + random() * 3), z = -7 + random() * 14, s = 0.5 + random() * 0.8;
      batch.add(rock, i % 2 ? 0x9aab91 : 0x879785, [x, -0.05, z], [s, s * 0.75, s * 1.2], [0, random() * 3, 0]);
      batch.add(ball, 0x7d9d48, [x, s * 0.53, z], [s * 0.6, 0.09, s * 0.65]);
    }
    for (let i = 0; i < 6; i++) {
      const x = side * (4.4 + random() * 5), z = -7 + random() * 14, r = 0.25 + random() * 0.4;
      batch.add(padGeometry, i % 2 ? 0x68a64b : 0x83b653, [x, -0.285, z], [r, r, r], [-Math.PI / 2, 0, random() * 6]);
      if (i === 1) {
        for (let p = 0; p < 5; p++) batch.add(ball, 0xffedd3, [x + Math.cos(p * 1.256) * 0.1, -0.2, z + Math.sin(p * 1.256) * 0.1], [0.08, 0.11, 0.16], [0, -p * 1.256, 0]);
      }
    }
  }
  const group = new THREE.Group();
  group.add(batch.mesh());
  group.position.z = 12 - index * CHUNK_LENGTH;
  group.userData.initialZ = group.position.z;
  return group;
}

const padShape = new THREE.Shape();
padShape.moveTo(0, 0);
padShape.absarc(0, 0, 1, 0.16, Math.PI * 2 - 0.16, false);
padShape.lineTo(0, 0);
const padGeometry = new THREE.ShapeGeometry(padShape, 12);

function waterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#36b7c5';
  ctx.fillRect(0, 0, 512, 512);
  const random = seededRandom(91);
  for (let i = 0; i < 95; i++) {
    const x = random() * 512, y = random() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 25, y - 14, x + 42, y + 17, x + 75, y + 2);
    ctx.strokeStyle = `rgba(207,255,241,${0.07 + random() * 0.2})`;
    ctx.lineWidth = 1 + random() * 2;
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(24, 30);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function radialTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(16,35,20,.65)');
  gradient.addColorStop(0.5, 'rgba(16,35,20,.3)');
  gradient.addColorStop(1, 'rgba(16,35,20,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function makeCoin() {
  const disk = new THREE.CylinderGeometry(0.3, 0.3, 0.105, 20).rotateX(Math.PI / 2);
  const rim = new THREE.TorusGeometry(0.295, 0.047, 6, 20);
  const inner = new THREE.TorusGeometry(0.225, 0.014, 4, 18).translate(0, 0, 0.061);
  const shape = new THREE.Shape();
  shape.moveTo(0.08, 0.14); shape.quadraticCurveTo(-0.17, 0.12, -0.065, -0.08); shape.lineTo(-0.1, -0.14); shape.lineTo(-0.055, -0.155); shape.lineTo(-0.015, -0.075); shape.quadraticCurveTo(0.14, -0.05, 0.08, 0.14);
  const emblem = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: false, curveSegments: 5 }).translate(0, 0, 0.06);
  const geometry = mergeGeometries([disk.toNonIndexed(), rim.toNonIndexed(), inner.toNonIndexed(), emblem], false);
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffcc38, metalness: 0.58, roughness: 0.28, emissive: 0xe89108, emissiveIntensity: 0.16 }));
}

function makeObstacle(type) {
  const batch = new Batch();
  if (type === 'log') {
    batch.add(cylinder, 0x86603a, [0, 0.39, 0], [0.38, 1.9, 0.38], [0, 0, Math.PI / 2]);
    for (const side of [-1, 1]) {
      batch.add(cylinder, 0xd2b47a, [side * 0.96, 0.39, 0], [0.32, 0.025, 0.32], [0, 0, Math.PI / 2]);
      batch.add(cylinder, 0xa78550, [side * 0.977, 0.39, 0], [0.17, 0.026, 0.17], [0, 0, Math.PI / 2]);
    }
    for (let i = 0; i < 4; i++) batch.add(box, 0x654a2e, [0, 0.22 + i * 0.11, 0.33], [1.75, 0.035, 0.04]);
    batch.add(ball, 0x6d913d, [-0.4, 0.72, 0], [0.45, 0.09, 0.25]);
  } else if (type === 'rock') {
    batch.add(rock, 0x87958b, [0, 0.55, 0], [0.82, 0.69, 0.67], [0.1, 0.45, 0.1]);
    batch.add(rock, 0xa3afa0, [-0.3, 0.35, 0.25], [0.45, 0.4, 0.4]);
    batch.add(ball, 0x719344, [0.15, 1.08, 0], [0.4, 0.08, 0.35]);
  } else {
    batch.add(box, 0x829486, [0, 1.2, 0], [0.94, 2.4, 0.82]);
    batch.add(box, 0xa6b29b, [0, 2.45, 0], [1.22, 0.25, 1.04]);
    batch.add(box, 0x6a8072, [0, 0.13, 0], [1.2, 0.26, 1.05]);
    batch.add(box, 0xc5b477, [0, 1.75, 0.425], [0.8, 0.12, 0.04]);
    for (const x of [-0.22, 0.22]) batch.add(box, 0x344f43, [x, 1.48, 0.425], [0.16, 0.2, 0.045]);
    batch.add(box, 0x455f4c, [0, 1.08, 0.425], [0.36, 0.08, 0.045]);
    batch.leaf([0.4, 2.5, 0.35], [-0.2, -1, 0.15], 1.8, 0x568b3c);
  }
  return batch.mesh();
}

export class JungleWorld {
  constructor(container, onProgress = () => {}) {
    this.container = container;
    this.onProgress = onProgress;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbfe8ef, 65, 170);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.35 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
    this.menuBlend = 1;
    this.lookTarget = new THREE.Vector3();
    this.entityMeshes = new Map();
    this.coinTemplate = makeCoin();
    this.obstacleTemplates = { log: makeObstacle('log'), rock: makeObstacle('rock'), ruins: makeObstacle('ruins') };
    this.time = 0;
    this.buildEnvironment();
    this.buildParticles();
    this.resizeHandler = () => this.resize();
    window.addEventListener('resize', this.resizeHandler);
    this.resize();
    this.updateCamera(1, { x: 0, y: 0, state: 'ready' });
  }

  async loadRunner() {
    this.onProgress(20, 'Waking up the jungle…');
    const loader = new GLTFLoader();
    const runnerUrl = new URL('../../jungleBoy.glb', import.meta.url).href;
    const gltf = await loader.loadAsync(runnerUrl, (event) => {
      if (event.total) this.onProgress(25 + Math.round(event.loaded / event.total * 65), 'Meet Kai, your jungle explorer…');
    });
    this.model = gltf.scene;
    this.model.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.frustumCulled = false;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => { material.roughness = 0.85; material.metalness = 0; if (material.map) material.map.anisotropy = 4; });
      }
    });
    const bounds = new THREE.Box3().setFromObject(this.model);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 2.15 / size.y;
    this.model.scale.multiplyScalar(scale);
    this.model.position.y -= bounds.min.y * scale;
    this.runner = new THREE.Group();
    this.runner.add(this.model);
    this.runner.position.set(0, GROUND, CONFIG.playerZ);
    this.scene.add(this.runner);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.activeAction = this.actions.Hello || this.actions.Run;
    if (this.activeAction) this.activeAction.play();
    this.runner.rotation.y = -0.55;
    this.runner.scale.setScalar(1.05);
    this.onProgress(100, 'The trail is ready.');
    return [...gltf.animations.map((clip) => clip.name)];
  }

  buildEnvironment() {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 20, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x3fa9e0) }, bottom: { value: new THREE.Color(0xbfe8ef) } },
      vertexShader: 'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform vec3 top;uniform vec3 bottom;varying vec3 vPosition;void main(){float h=pow(max(normalize(vPosition).y,0.0),0.55);gl_FragColor=vec4(mix(bottom,top,h),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    }));
    this.scene.add(sky);
    this.scene.add(new THREE.HemisphereLight(0xd8f6ff, 0x647b38, 2.1));
    const sun = new THREE.DirectionalLight(0xfff0cf, 2.7);
    sun.position.set(-18, 32, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 28, bottom: -28, near: 1, far: 90 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.035;
    sun.target.position.set(0, 0, -12);
    this.scene.add(sun, sun.target);
    this.waterMap = waterTexture();
    const water = new THREE.Mesh(new THREE.PlaneGeometry(360, 420), new THREE.MeshStandardMaterial({ color: 0x83dce0, map: this.waterMap, roughness: 0.36, metalness: 0.08 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.32, -100);
    water.receiveShadow = true;
    this.scene.add(water);
    this.chunks = Array.from({ length: CHUNK_COUNT }, (_, i) => makeChunk(i));
    this.chunks.forEach((chunk) => this.scene.add(chunk));

    const beach = new Batch();
    beach.add(ball, 0xc9b780, [0, -0.35, 22], [28, 0.55, 18]);
    beach.add(ball, 0xd4c18b, [0, -0.37, 24], [24, 0.5, 17]);
    const random = seededRandom(88);
    for (const side of [-1, 1]) {
      addPlant(beach, side * 7.5, 9, 3.5, random);
      addPlant(beach, side * 9, 5, 2.8, random);
      beach.add(rock, 0x9ba58a, [side * 7, 0.1, 12], [1.4, 0.8, 1.1]);
    }
    this.beach = beach.mesh();
    this.scene.add(this.beach);

    const mountains = new Batch();
    for (let i = 0; i < 19; i++) {
      const x = -125 + i * 14, h = 18 + random() * 32;
      mountains.add(new THREE.ConeGeometry(1, 1, 5), i % 2 ? 0x74a99a : 0x88b8a6, [x, h / 2 - 2, -160 - random() * 20], [14 + random() * 10, h, 15], [0, random() * 3, 0]);
    }
    this.scene.add(mountains.mesh(false));

    const sign = new Batch();
    sign.branch([5.1, 0, 1], [5.1, 2.2, 1], 0.1, 0x79613d);
    sign.add(box, 0x947344, [5.1, 1.9, 1], [2.1, 0.68, 0.14], [0, -0.18, -0.07]);
    this.beach.add(sign.mesh());
    const signCanvas = document.createElement('canvas'); signCanvas.width = 256; signCanvas.height = 80;
    const ctx = signCanvas.getContext('2d'); ctx.fillStyle = '#fff0bd'; ctx.font = 'bold 27px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('LOST RIVER', 128, 48);
    const signText = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.59), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(signCanvas), transparent: true, depthWrite: false }));
    signText.position.set(5.1, 1.9, 1.09); signText.rotation.set(0, -0.18, -0.07); this.beach.add(signText);

    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, opacity: 0.7 }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(0, GROUND + 0.005, CONFIG.playerZ);
    this.scene.add(this.shadow);
  }

  buildParticles() {
    this.particleMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.065, 0), new THREE.MeshBasicMaterial({ color: 0xffdf70 }), 72);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.particles = Array.from({ length: 72 }, () => ({ life: 0, position: new THREE.Vector3(), velocity: new THREE.Vector3() }));
    this.dummy = new THREE.Object3D();
    this.dummy.scale.setScalar(0); this.dummy.updateMatrix();
    for (let i = 0; i < 72; i++) this.particleMesh.setMatrixAt(i, this.dummy.matrix);
    this.scene.add(this.particleMesh);
    this.particleCursor = 0;
  }

  burst(lane, at, height, distance) {
    for (let i = 0; i < 9; i++) {
      const p = this.particles[this.particleCursor++ % this.particles.length];
      p.life = 0.5 + Math.random() * 0.25;
      p.position.set(lane * CONFIG.laneWidth, height + GROUND, CONFIG.playerZ + distance - at);
      p.velocity.set((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4);
    }
  }

  setMode(mode) {
    if (!this.mixer) return;
    const name = mode === 'home' ? 'Hello' : 'Run';
    const next = this.actions[name] || this.actions.Run;
    if (next && next !== this.activeAction) {
      next.reset().setEffectiveTimeScale(name === 'Hello' ? 0.6 : 1.12).setEffectiveWeight(1).play();
      if (this.activeAction) this.activeAction.crossFadeTo(next, 0.22, true);
      this.activeAction = next;
    }
    if (next) next.paused = false;
  }

  resize() {
    const width = this.container.clientWidth, height = this.container.clientHeight;
    this.mobile = width <= 760;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.fov = this.mobile ? 64 : 55;
    this.camera.updateProjectionMatrix();
  }

  updateCamera(dt, engine) {
    const target = engine.state === 'ready' ? 1 : 0;
    this.menuBlend += (target - this.menuBlend) * (1 - Math.exp(-4 * dt));
    const t = this.menuBlend;
    const home = this.mobile ? [-4.2, 4, 17.5] : [-5.5, 3.8, 14.5];
    const play = this.mobile ? [0, 8.2, 19.5] : [0, 7.4, 17.5];
    const homeTarget = this.mobile ? [-0.6, 0.4, -2] : [2.2, 1.1, -6];
    const playTarget = [engine.x * 0.12, 1, -14];
    this.camera.position.set(...home.map((value, i) => THREE.MathUtils.lerp(play[i], value, t)));
    this.lookTarget.set(...homeTarget.map((value, i) => THREE.MathUtils.lerp(playTarget[i], value, t)));
    this.camera.lookAt(this.lookTarget);
  }

  update(dt, engine, active = true) {
    this.time += dt;
    this.waterMap.offset.x = this.time * 0.007;
    this.waterMap.offset.y = this.time * 0.012;
    for (const chunk of this.chunks) {
      chunk.position.z = chunk.userData.initialZ + (engine.distance % TRACK_LENGTH);
      if (chunk.position.z > 28) chunk.position.z -= TRACK_LENGTH;
    }
    this.beach.position.z = engine.distance;
    this.beach.visible = engine.distance < 35;
    this.updateCamera(dt, engine);
    if (this.runner) {
      const home = engine.state === 'ready';
      this.runner.position.x = home ? 0 : engine.x;
      this.runner.position.y = GROUND + engine.y;
      const targetRotation = home ? -0.55 : Math.PI + (engine.lane * CONFIG.laneWidth - engine.x) * -0.1;
      this.runner.rotation.y += (targetRotation - this.runner.rotation.y) * (1 - Math.exp(-9 * dt));
      const scale = home ? (this.mobile ? 0.86 : 1.05) : 1;
      this.runner.scale.lerp(new THREE.Vector3(scale, scale, scale), 1 - Math.exp(-5 * dt));
      if (active && (engine.state === 'running' || engine.state === 'ready')) this.mixer.update(dt);
      this.shadow.position.x = this.runner.position.x;
      this.shadow.material.opacity = Math.max(0.12, 0.7 - engine.y * 0.2);
      this.shadow.scale.setScalar(1 + engine.y * 0.15);
    }
    const visible = new Set();
    for (const entity of engine.entities) {
      const z = CONFIG.playerZ + engine.distance - entity.at;
      if (z < -155 || z > 12 || entity.collected) continue;
      visible.add(entity.id);
      let mesh = this.entityMeshes.get(entity.id);
      if (!mesh) {
        mesh = (entity.kind === 'coin' ? this.coinTemplate : this.obstacleTemplates[entity.type]).clone();
        mesh.position.x = entity.lane * CONFIG.laneWidth;
        this.entityMeshes.set(entity.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.z = z;
      if (entity.kind === 'coin') {
        mesh.position.y = entity.height + GROUND + Math.sin(this.time * 3 + entity.id * 0.5) * 0.065;
        mesh.rotation.y = this.time * 1.8 + entity.id * 0.22;
      } else mesh.position.y = GROUND;
    }
    for (const [id, mesh] of this.entityMeshes) {
      if (!visible.has(id)) { this.scene.remove(mesh); this.entityMeshes.delete(id); }
    }
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life > 0) {
        p.life -= dt; p.velocity.y -= dt * 7; p.position.addScaledVector(p.velocity, dt);
        this.dummy.position.copy(p.position); this.dummy.scale.setScalar(Math.max(0, Math.min(1, p.life * 3)));
      } else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix(); this.particleMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  clearEntities() {
    for (const mesh of this.entityMeshes.values()) this.scene.remove(mesh);
    this.entityMeshes.clear();
    this.particles.forEach((p) => { p.life = 0; });
  }
}
