import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG, seededRandom } from './engine.js';
import {
  GROUND, WATER_Y, Batch, box, ball, rock, cylinder,
  addPalm, addPlant, addFlowers, addTempleRuin, addRopeBridge, addStoneBridge,
  makeDeck, makeGap, makeCrocodile, makeLogObstacle, makeRuinsObstacle, makeProceduralRock,
  extractTemplates, addImportedVegetation,
} from './scenery.js';

const CHUNK_LENGTH = 16;
const CHUNK_COUNT = 12;
const TRACK_LENGTH = CHUNK_LENGTH * CHUNK_COUNT;
// Gameplay view: keep Kai smaller and lower in frame so the trail ahead stays readable.
const PLAY_RUNNER_SCALE = 0.82;
const PLAY_CAMERA = {
  desktop: { position: [0, 10.5, 24], target: [0, 3.2, -17] },
  mobile: { position: [0, 10.8, 24.5], target: [0, 3.2, -17] },
};

const padShape = new THREE.Shape();
padShape.moveTo(0, 0);
padShape.absarc(0, 0, 1, 0.16, Math.PI * 2 - 0.16, false);
padShape.lineTo(0, 0);
const padGeometry = new THREE.ShapeGeometry(padShape, 12);

function chunkStyle(index) {
  return index < 4 ? 'rope' : index < 8 ? 'stone' : 'temple';
}

function makeChunk(index, crocTemplate) {
  const random = seededRandom(700 + index * 93);
  const style = chunkStyle(index);
  const batch = new Batch();
  const group = new THREE.Group();

  // River banks
  for (const side of [-1, 1]) {
    const bankX = side * (13 + random() * 2);
    batch.add(rock, 0x7d8970, [bankX, -1.25, 0], [7.4, 2.1, 9.4], [0, random(), 0]);
    batch.add(ball, 0xb8b77b, [bankX, -0.45, 0], [7, 0.65, 9]);
    batch.add(ball, 0x639447, [bankX + side * 0.7, -0.1, 0], [6.1, 0.35, 8.1]);
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
      batch.add(padGeometry, i % 2 ? 0x68a64b : 0x83b653, [x, WATER_Y + 0.03, z], [r, r, r], [-Math.PI / 2, 0, random() * 6]);
      if (i === 1) {
        for (let p = 0; p < 5; p++) batch.add(ball, 0xffedd3, [x + Math.cos(p * 1.256) * 0.1, WATER_Y + 0.1, z + Math.sin(p * 1.256) * 0.1], [0.08, 0.11, 0.16], [0, -p * 1.256, 0]);
      }
    }
  }

  if (style === 'rope') addRopeBridge(batch, random);
  else addStoneBridge(batch, random, style === 'temple');

  if (style === 'temple') {
    addTempleRuin(batch, -10.5, -2 + random() * 4, random, 1.1);
    addTempleRuin(batch, 10.5, -4 + random() * 4, random, 0.9);
    addFlowers(batch, -6.5, 3, random, 6);
    addFlowers(batch, 6.5, -3, random, 6);
  }

  group.add(batch.mesh());
  const deck = makeDeck(style === 'rope' ? 'rope' : 'stone');
  group.add(deck.mesh);
  group.userData.deck = deck;
  group.userData.style = style;

  // Ambient crocodiles drifting in the river beside the bridge
  group.userData.crocs = [];
  if (crocTemplate) {
    for (let i = 0; i < 1; i++) {
      const croc = crocTemplate.clone();
      const side = index % 2 === 0 ? -1 : 1;
      croc.scale.setScalar(0.75 + random() * 0.3);
      croc.position.set(side * (4.7 + random() * 0.7), WATER_Y + 0.12, -6 + random() * 12);
      croc.rotation.y = (random() - 0.5) * 0.6 + (side > 0 ? Math.PI : 0);
      croc.userData.phase = random() * Math.PI * 2;
      group.add(croc);
      group.userData.crocs.push(croc);
    }
  }

  group.position.z = 12 - index * CHUNK_LENGTH;
  group.userData.initialZ = group.position.z;
  group.userData.index = index;
  return group;
}

function waterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2fa9b8';
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

function makeImportedRockObstacle(template) {
  const group = new THREE.Group();
  const clone = template.clone();
  clone.scale.set(0.9, 3.1, 0.9);
  group.add(clone);
  return group;
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
    this.crocTemplate = makeCrocodile();
    this.obstacleTemplates = { log: makeLogObstacle(), rock: makeProceduralRock(), ruins: makeRuinsObstacle() };
    this.gapTemplates = new Map();
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
      if (event.total) this.onProgress(20 + Math.round(event.loaded / event.total * 55), 'Meet Kai, your jungle explorer…');
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
    await this.loadEnvironmentAssets(loader);
    this.onProgress(100, 'The trail is ready.');
    return [...gltf.animations.map((clip) => clip.name)];
  }

  async loadEnvironmentAssets(loader) {
    this.onProgress(80, 'Growing the forest…');
    const forestUrl = new URL('../../assets/forest_pack.glb', import.meta.url).href;
    const rockUrl = new URL('../../assets/stylized_rock.glb', import.meta.url).href;
    const [forest, rocks] = await Promise.all([loader.loadAsync(forestUrl), loader.loadAsync(rockUrl)]);
    this.onProgress(92, 'Scattering rocks and ruins…');
    this.forestTemplates = extractTemplates(forest, [
      { key: 'oak', name: 'oak_Tree_Trunk_1', height: 9 },
      { key: 'birch', name: 'birch_Tree_Trunk.012_32', height: 10 },
      { key: 'fern', name: 'fern_5', height: 1.2 },
      { key: 'lightBush', name: 'light_bush.001_54', height: 2 },
      { key: 'darkBush', name: 'dark_bush_68', height: 2.2 },
      { key: 'grass', name: 'grassblade_59', height: 1.1 },
      { key: 'flowers', name: 'dandelion_flowers_64', height: 0.5 },
      { key: 'mossedStone', name: 'mossed_stone_63', height: 0.8 },
    ]);
    const rockTemplates = extractTemplates(rocks, [{ key: 'rock', name: 'Object_4', width: 2 }]);
    this.rockTemplate = rockTemplates.rock;
    if (this.rockTemplate) this.obstacleTemplates.rock = makeImportedRockObstacle(this.rockTemplate);
    for (const chunk of this.chunks) {
      addImportedVegetation(chunk, this.forestTemplates, seededRandom(1200 + chunk.userData.index * 71), this.rockTemplate);
    }
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
    water.position.set(0, WATER_Y, -100);
    water.receiveShadow = true;
    this.scene.add(water);
    this.chunks = Array.from({ length: CHUNK_COUNT }, (_, i) => makeChunk(i, this.crocTemplate));
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
    const view = this.mobile ? PLAY_CAMERA.mobile : PLAY_CAMERA.desktop;
    const play = view.position;
    const homeTarget = this.mobile ? [-0.6, 0.4, -2] : [2.2, 1.1, -6];
    const playTarget = [engine.x * 0.12, view.target[1], view.target[2]];
    this.camera.position.set(...home.map((value, i) => THREE.MathUtils.lerp(play[i], value, t)));
    this.lookTarget.set(...homeTarget.map((value, i) => THREE.MathUtils.lerp(playTarget[i], value, t)));
    this.camera.lookAt(this.lookTarget);
  }

  updateDeck(deck, chunkZ, gaps) {
    let changed = false;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < deck.planks.length; i++) {
      const p = deck.planks[i];
      const worldZ = chunkZ + p.z;
      let hidden = false;
      for (const gap of gaps) {
        if (gap.lane !== p.lane) continue;
        const gapZ = CONFIG.playerZ + gap.distance - gap.at;
        if (Math.abs(worldZ - gapZ) < gap.depth / 2 + p.length * 0.35) { hidden = true; break; }
      }
      if (hidden !== deck.hidden[i]) {
        deck.hidden[i] = hidden;
        deck.mesh.setMatrixAt(i, hidden ? zero : deck.base[i]);
        changed = true;
      }
    }
    if (changed) deck.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt, engine, active = true) {
    this.time += dt;
    this.waterMap.offset.x = this.time * 0.007;
    this.waterMap.offset.y = this.time * 0.012;
    const gaps = engine.entities.filter((e) => e.kind === 'gap').map((e) => ({ ...e, distance: engine.distance }));
    for (const chunk of this.chunks) {
      chunk.position.z = chunk.userData.initialZ + (engine.distance % TRACK_LENGTH);
      if (chunk.position.z > 28) chunk.position.z -= TRACK_LENGTH;
      this.updateDeck(chunk.userData.deck, chunk.position.z, gaps);
      for (const croc of chunk.userData.crocs) {
        const jaw = croc.getObjectByName('jaw');
        if (jaw) jaw.rotation.x = Math.max(0, Math.sin(this.time * 1.5 + croc.userData.phase)) * 0.25;
        croc.position.y = WATER_Y + 0.12 + Math.sin(this.time * 1.2 + croc.userData.phase) * 0.03;
      }
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
      const scale = home ? (this.mobile ? 0.86 : 1.05) : PLAY_RUNNER_SCALE;
      this.runner.scale.lerp(new THREE.Vector3(scale, scale, scale), 1 - Math.exp(-5 * dt));
      if (active && (engine.state === 'running' || engine.state === 'ready')) this.mixer.update(dt);
      this.shadow.position.x = this.runner.position.x;
      this.shadow.material.opacity = Math.max(0.12, 0.7 - engine.y * 0.2);
      this.shadow.scale.setScalar(this.runner.scale.x * (1 + engine.y * 0.15));
    }
    const visible = new Set();
    for (const entity of engine.entities) {
      const z = CONFIG.playerZ + engine.distance - entity.at;
      if (z < -155 || z > 12 || entity.collected) continue;
      visible.add(entity.id);
      let mesh = this.entityMeshes.get(entity.id);
      if (!mesh) {
        if (entity.kind === 'coin') mesh = this.coinTemplate.clone();
        else if (entity.kind === 'croc') mesh = this.crocTemplate.clone();
        else if (entity.kind === 'gap') {
          const host = this.chunks.find((c) => Math.abs(z - c.position.z) <= CHUNK_LENGTH / 2 + 0.01);
          const style = host ? host.userData.style : 'rope';
          const key = `${style}:${entity.depth.toFixed(2)}`;
          if (!this.gapTemplates.has(key)) this.gapTemplates.set(key, makeGap(entity.depth, style));
          mesh = this.gapTemplates.get(key).clone();
        } else mesh = this.obstacleTemplates[entity.type].clone();
        mesh.position.x = entity.lane * CONFIG.laneWidth;
        this.entityMeshes.set(entity.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.z = z;
      if (entity.kind === 'coin') {
        mesh.position.y = entity.height + GROUND + Math.sin(this.time * 3 + entity.id * 0.5) * 0.065;
        mesh.rotation.y = this.time * 1.8 + entity.id * 0.22;
      } else if (entity.kind === 'croc') {
        mesh.position.y = GROUND;
        mesh.rotation.y = 0;
        const jaw = mesh.getObjectByName('jaw');
        if (jaw) {
          const near = Math.max(0, 1 - Math.abs(z - CONFIG.playerZ) / 10);
          jaw.rotation.x = Math.max(0, Math.sin(this.time * 7 + entity.id)) * 0.55 * near;
        }
      } else if (entity.kind === 'gap') mesh.position.y = 0;
      else mesh.position.y = GROUND;
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
