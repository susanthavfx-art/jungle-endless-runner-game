import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG, seededRandom } from './engine.js';

export const GROUND = 0.18;
export const WATER_Y = -1.55;
const UP = new THREE.Vector3(0, 1, 0);

export const cylinder = new THREE.CylinderGeometry(1, 1, 1, 7);
export const rock = new THREE.DodecahedronGeometry(1, 0);
export const ball = new THREE.IcosahedronGeometry(1, 1);
export const box = new THREE.BoxGeometry(1, 1, 1);
const cone = new THREE.ConeGeometry(1, 1, 5);

function leafGeometry(serrated = false) {
  const positions = [], indices = [], segments = 9;
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

/** Merge vertex-colored scenery into a single draw call. */
export class Batch {
  constructor() { this.parts = []; }
  add(geometry, color, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], quaternion = null) {
    const part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    part.deleteAttribute('uv'); part.deleteAttribute('uv1'); part.deleteAttribute('tangent');
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

export function addPalm(batch, x, z, height, random) {
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

export function addPlant(batch, x, z, size, random, fern = false) {
  const count = fern ? 7 : 5;
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2 + random() * 0.4;
    batch.leaf([x, 0.05, z], [Math.cos(angle) * 0.85, 0.45 + random() * 0.8, Math.sin(angle) * 0.85], size * (0.75 + random() * 0.4), [0x3e8737, 0x65a83e, 0x83bb49, 0x4d983b][i % 4], fern);
  }
}

export function addFlowers(batch, x, z, random, count = 5) {
  for (let i = 0; i < count; i++) {
    const fx = x + (random() - 0.5) * 1.4, fz = z + (random() - 0.5) * 1.4;
    const h = 0.35 + random() * 0.35;
    batch.branch([fx, 0, fz], [fx, h, fz], 0.025, 0x4d8a35);
    for (let p = 0; p < 5; p++) {
      const a = p * 1.256;
      batch.add(ball, i % 2 ? 0xe86fae : 0xff8fc6, [fx + Math.cos(a) * 0.1, h, fz + Math.sin(a) * 0.1], [0.09, 0.05, 0.09]);
    }
    batch.add(ball, 0xffe07a, [fx, h + 0.02, fz], [0.05, 0.04, 0.05]);
  }
}

function addVine(batch, x, y, z, length, random) {
  const sway = (random() - 0.5) * 0.5;
  batch.branch([x, y, z], [x + sway, y - length, z + sway * 0.5], 0.025, 0x5c7a3a);
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 5;
    batch.leaf([x + sway * t, y - length * t, z + sway * 0.5 * t], [random() - 0.5, -0.4, random() - 0.5], 0.35 + random() * 0.25, 0x6a9a44);
  }
}

export function addMoai(batch, x, z, height = 2.6, lean = 0) {
  const w = height * 0.38;
  batch.add(box, 0x7f8f86, [x, height * 0.42, z], [w, height * 0.84, w * 0.8], [0, 0, lean]);
  batch.add(box, 0x9aa79b, [x, height * 0.86, z], [w * 1.18, height * 0.12, w * 0.95], [0, 0, lean]);
  batch.add(box, 0x6a7a70, [x, height * 0.12, z], [w * 1.3, height * 0.16, w]);
  // heavy brow, deep eyes, long nose and stern mouth
  batch.add(box, 0x8b9a90, [x, height * 0.68, z + w * 0.42], [w * 0.95, height * 0.1, w * 0.18]);
  for (const s of [-1, 1]) batch.add(box, 0x33463c, [x + s * w * 0.24, height * 0.61, z + w * 0.43], [w * 0.2, height * 0.08, w * 0.08]);
  batch.add(box, 0x93a296, [x, height * 0.48, z + w * 0.48], [w * 0.22, height * 0.26, w * 0.18]);
  batch.add(box, 0x405348, [x, height * 0.3, z + w * 0.44], [w * 0.5, height * 0.055, w * 0.08]);
  batch.add(ball, 0x6f9440, [x, height * 0.93, z], [w * 0.7, height * 0.06, w * 0.6]);
  batch.leaf([x + w * 0.4, height * 0.9, z + w * 0.3], [-0.2, -1, 0.15], height * 0.55, 0x568b3c);
}

export function addTempleRuin(batch, x, z, random, scale = 1) {
  const s = scale;
  // stepped platform
  for (let i = 0; i < 3; i++) batch.add(box, i % 2 ? 0x87958a : 0x75857b, [x, 0.15 * s + i * 0.28 * s, z], [(5.4 - i * 0.7) * s, 0.28 * s, (3.6 - i * 0.5) * s]);
  // two pillars and a broken lintel
  for (const side of [-1, 1]) {
    const px = x + side * 1.7 * s;
    batch.add(box, 0x8e9c91, [px, 2.1 * s, z], [0.85 * s, 3.2 * s, 0.85 * s]);
    batch.add(box, 0xa4b1a4, [px, 3.75 * s, z], [1.15 * s, 0.25 * s, 1.1 * s]);
    batch.add(box, 0x6f7f74, [px, 0.65 * s, z], [1.15 * s, 0.3 * s, 1.1 * s]);
    addVine(batch, px + side * 0.3 * s, 3.7 * s, z + 0.4 * s, 2.2 * s, random);
  }
  batch.add(box, 0x93a196, [x - 0.3 * s, 4.05 * s, z], [4.4 * s, 0.45 * s, 1.1 * s], [0, 0, 0.03]);
  batch.add(box, 0x7b8b80, [x + 1.8 * s, 4.2 * s, z], [1.1 * s, 0.35 * s, 1.05 * s], [0, 0, -0.18]);
  // dark doorway suggestion
  batch.add(box, 0x2f4238, [x, 1.9 * s, z - 0.2 * s], [1.6 * s, 2.4 * s, 0.1 * s]);
  addMoai(batch, x - 2.6 * s, z + 1.2 * s, 2.2 * s, 0.06);
  addMoai(batch, x + 2.5 * s, z + 1.4 * s, 1.8 * s, -0.1);
  addFlowers(batch, x - 2.6 * s, z + 1.2 * s, random, 4);
  addFlowers(batch, x + 2.5 * s, z + 1.4 * s, random, 4);
  for (let i = 0; i < 5; i++) {
    batch.add(box, 0x7d8d82, [x + (random() - 0.5) * 5 * s, 0.2 * s, z + (random() - 0.5) * 3 * s], [0.6 * s, 0.4 * s, 0.5 * s], [0, random() * 3, (random() - 0.5) * 0.4]);
  }
  addPlant(batch, x - 3 * s, z + 1.8 * s, 1.6 * s, random, true);
  addPlant(batch, x + 3 * s, z + 1.6 * s, 1.8 * s, random, true);
}

export function addRopeBridge(batch, random) {
  const half = CONFIG.laneWidth * 1.5 + 0.25;
  for (const side of [-1, 1]) {
    const x = side * half;
    for (const z of [-7.5, 0.5, 7.5]) {
      batch.branch([x, -0.35, z], [x + side * 0.08, 1.75, z], 0.11, 0x8a6b3f);
      batch.add(ball, 0x6f9440, [x, 1.7, z], [0.16, 0.07, 0.16]);
    }
    // sagging hand ropes + lower rail
    for (let i = 0; i < 16; i++) {
      const z0 = -8 + i, z1 = z0 + 1;
      const sag0 = Math.sin(((z0 + 8) % 8) / 8 * Math.PI) * 0.28;
      const sag1 = Math.sin(((z1 + 8) % 8) / 8 * Math.PI) * 0.28;
      batch.branch([x, 1.45 - sag0, z0], [x, 1.45 - sag1, z1], 0.035, 0xb7a06a);
      batch.branch([x, 0.62 - sag0 * 0.5, z0], [x, 0.62 - sag1 * 0.5, z1], 0.03, 0xa89160);
      if (i % 2 === 0 && random() > 0.18) batch.branch([x, 0.18, z0], [x, 1.4 - sag0, z0], 0.022, 0xb7a06a);
    }
    for (let i = 0; i < 4; i++) addVine(batch, x, 1.35, -7 + random() * 14, 0.8 + random() * 1.1, random);
  }
  for (let z = -7; z <= 7; z += 4) {
    batch.add(box, 0x6e5534, [0, -0.12, z], [half * 2 + 0.3, 0.16, 0.22]);
    batch.branch([-half, -0.2, z], [half, -0.2, z], 0.05, 0x8a6b3f);
  }
}

export function addStoneBridge(batch, random, temple = false) {
  const half = CONFIG.laneWidth * 1.5 + 0.3;
  const stoneColors = temple ? [0x89978c, 0x75857b, 0x9aa79b] : [0x8d9a86, 0x7b8975, 0xa0ac96];
  for (const side of [-1, 1]) {
    const x = side * half;
    // piers
    for (const z of [-7.6, 0, 7.6]) batch.add(box, stoneColors[1], [x, -0.75, z], [0.75, 1.7, 0.9]);
    // two low arches per side
    for (const center of [-3.8, 3.8]) {
      for (let i = 0; i < 9; i++) {
        const a0 = (i / 9) * Math.PI, a1 = ((i + 1) / 9) * Math.PI;
        const p0 = [x, -1.35 + Math.sin(a0) * 1.05, center + Math.cos(a0) * 3.3];
        const p1 = [x, -1.35 + Math.sin(a1) * 1.05, center + Math.cos(a1) * 3.3];
        batch.branch(p0, p1, 0.28, stoneColors[i % 3]);
      }
    }
    // broken parapet blocks
    for (let z = -7.5; z <= 7.5; z += 1.5) {
      if (random() < 0.22) continue;
      const h = 0.35 + random() * 0.3;
      batch.add(box, stoneColors[Math.floor(random() * 3)], [x, GROUND + h / 2, z], [0.55, h, 1.25], [0, 0, (random() - 0.5) * 0.08]);
      if (random() < 0.4) batch.add(ball, 0x6f9440, [x, GROUND + h + 0.03, z], [0.3, 0.05, 0.5]);
    }
    for (let i = 0; i < 3; i++) addVine(batch, x, GROUND + 0.4, -6 + random() * 12, 1 + random() * 1.2, random);
    // hanging ropes from the ruined bridge reference
    for (let i = 0; i < 2; i++) {
      const z = -5 + random() * 10;
      batch.branch([x, GROUND + 0.4, z], [x + side * 0.15, WATER_Y + 0.3, z + 0.3], 0.025, 0xb7a06a);
    }
  }
}

export function makeDeck(style) {
  const rope = style === 'rope';
  const spacing = rope ? 0.5 : 1.6;
  const length = rope ? 0.42 : 1.48;
  const width = CONFIG.laneWidth - 0.05;
  const rows = Math.round(16 / spacing);
  const planks = [];
  for (let lane = -1; lane <= 1; lane++) {
    for (let i = 0; i < rows; i++) {
      planks.push({ lane, x: lane * CONFIG.laneWidth, z: -8 + spacing * (i + 0.5), length, width });
    }
  }
  const material = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  const mesh = new THREE.InstancedMesh(box, material, planks.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  const random = seededRandom(rope ? 17 : 29);
  const palette = rope ? [0x9a7a4a, 0x86683e, 0xb08d57, 0x755a36] : [0x93a08c, 0x82907c, 0xa4b09a, 0x768572];
  const base = [];
  planks.forEach((p, i) => {
    dummy.position.set(p.x, GROUND - (rope ? 0.06 : 0.11), p.z);
    dummy.rotation.set(0, (random() - 0.5) * (rope ? 0.05 : 0.02), (random() - 0.5) * (rope ? 0.04 : 0.01));
    dummy.scale.set(p.width, rope ? 0.12 : 0.22, p.length);
    dummy.updateMatrix();
    base.push(dummy.matrix.clone());
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.setHex(palette[Math.floor(random() * palette.length)]));
  });
  mesh.instanceColor.needsUpdate = true;
  return { mesh, planks, base, hidden: new Array(planks.length).fill(false), dummy };
}

export function makeGap(depth, style) {
  const batch = new Batch();
  const random = seededRandom(Math.floor(depth * 100));
  const half = depth / 2;
  const width = CONFIG.laneWidth - 0.1;
  if (style === 'rope') {
    for (const edge of [-1, 1]) {
      const z = edge * half;
      for (let i = 0; i < 4; i++) {
        const x = -width / 2 + 0.3 + i * 0.5;
        batch.add(box, 0x8a6b3f, [x, GROUND - 0.05, z + edge * 0.12], [0.4, 0.1, 0.5 + random() * 0.3], [(random() - 0.5) * 0.5, 0, (random() - 0.5) * 0.3]);
      }
      for (const side of [-1, 1]) {
        batch.branch([side * width / 2, GROUND, z], [side * width / 2 + (random() - 0.5) * 0.3, GROUND - 0.9, z + edge * 0.2], 0.025, 0xb7a06a);
      }
    }
  } else {
    for (const edge of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        batch.add(box, 0x87958a, [-width / 2 + 0.4 + i * 0.7, GROUND - 0.1, edge * half], [0.6, 0.22, 0.45], [0, (random() - 0.5) * 0.3, (random() - 0.5) * 0.2]);
      }
    }
  }
  const group = new THREE.Group();
  group.add(batch.mesh());
  return group;
}

export function makeCrocodile() {
  const group = new THREE.Group();
  const body = new Batch();
  const green = 0x4c7a3a, dark = 0x385c2c, belly = 0x8fa363;
  body.add(ball, green, [0, 0.28, -0.15], [0.42, 0.24, 0.85]);
  body.add(ball, belly, [0, 0.18, -0.1], [0.36, 0.12, 0.75]);
  // tail
  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    body.add(ball, i % 2 ? green : dark, [0, 0.24 - t * 0.06, -0.95 - i * 0.32], [0.3 * (1 - t * 0.7), 0.16 * (1 - t * 0.6), 0.28]);
  }
  // legs
  for (const sx of [-1, 1]) for (const sz of [-0.5, 0.35]) {
    body.add(box, dark, [sx * 0.4, 0.12, sz], [0.28, 0.1, 0.16], [0, sx * 0.3, 0]);
  }
  // back scutes
  for (let i = 0; i < 6; i++) body.add(cone, dark, [0, 0.5, -0.7 + i * 0.22], [0.08, 0.14, 0.08]);
  // upper head / snout
  body.add(box, green, [0, 0.34, 0.72], [0.42, 0.2, 0.75]);
  body.add(box, green, [0, 0.3, 1.15], [0.32, 0.14, 0.3]);
  for (const s of [-1, 1]) {
    body.add(ball, 0x6f9440, [s * 0.22, 0.48, 0.55], [0.12, 0.1, 0.12]);
    body.add(ball, 0xffd34d, [s * 0.23, 0.5, 0.62], [0.06, 0.06, 0.06]);
    body.add(ball, 0x1c2a16, [s * 0.23, 0.5, 0.67], [0.025, 0.04, 0.025]);
    body.add(ball, dark, [s * 0.1, 0.38, 1.28], [0.03, 0.03, 0.03]);
    for (let i = 0; i < 4; i++) body.add(cone, 0xf2ecd2, [s * 0.17, 0.22, 0.7 + i * 0.14], [0.025, 0.08, 0.025], [Math.PI, 0, 0]);
  }
  group.add(body.mesh());
  const jaw = new THREE.Group();
  jaw.name = 'jaw';
  jaw.position.set(0, 0.22, 0.45);
  const jawBatch = new Batch();
  jawBatch.add(box, belly, [0, -0.04, 0.38], [0.34, 0.1, 0.8]);
  jawBatch.add(box, 0x7e2f2f, [0, 0.01, 0.38], [0.28, 0.02, 0.7]);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) jawBatch.add(cone, 0xf2ecd2, [s * 0.15, 0.05, 0.2 + i * 0.16], [0.022, 0.07, 0.022]);
  jaw.add(jawBatch.mesh());
  group.add(jaw);
  return group;
}

export function makeLogObstacle() {
  const batch = new Batch();
  batch.add(cylinder, 0x86603a, [0, 0.39, 0], [0.38, 1.9, 0.38], [0, 0, Math.PI / 2]);
  for (const side of [-1, 1]) {
    batch.add(cylinder, 0xd2b47a, [side * 0.96, 0.39, 0], [0.32, 0.025, 0.32], [0, 0, Math.PI / 2]);
    batch.add(cylinder, 0xa78550, [side * 0.977, 0.39, 0], [0.17, 0.026, 0.17], [0, 0, Math.PI / 2]);
  }
  for (let i = 0; i < 4; i++) batch.add(box, 0x654a2e, [0, 0.22 + i * 0.11, 0.33], [1.75, 0.035, 0.04]);
  batch.add(ball, 0x6d913d, [-0.4, 0.72, 0], [0.45, 0.09, 0.25]);
  return batch.mesh();
}

export function makeRuinsObstacle() {
  const batch = new Batch();
  addMoai(batch, 0, 0, 2.6, 0);
  return batch.mesh();
}

export function makeProceduralRock() {
  const batch = new Batch();
  batch.add(rock, 0x87958b, [0, 0.55, 0], [0.82, 0.69, 0.67], [0.1, 0.45, 0.1]);
  batch.add(rock, 0xa3afa0, [-0.3, 0.35, 0.25], [0.45, 0.4, 0.4]);
  batch.add(ball, 0x719344, [0.15, 1.08, 0], [0.4, 0.08, 0.35]);
  return batch.mesh();
}

/** Extract named GLB nodes into normalized, reusable template groups. */
export function extractTemplates(gltf, specs) {
  const templates = {};
  gltf.scene.updateMatrixWorld(true);
  for (const spec of specs) {
    const node = gltf.scene.getObjectByName(spec.name);
    if (!node) continue;
    const parts = [];
    const bounds = new THREE.Box3();
    node.traverse((object) => {
      if (!object.isMesh) return;
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      for (const attr of Object.keys(geometry.attributes)) {
        if (!['position', 'normal', 'uv'].includes(attr)) geometry.deleteAttribute(attr);
      }
      geometry.computeBoundingBox();
      bounds.union(geometry.boundingBox);
      parts.push({ geometry, material: Array.isArray(object.material) ? object.material[0] : object.material });
    });
    if (!parts.length) continue;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = spec.height ? spec.height / Math.max(size.y, 0.001) : spec.width / Math.max(size.x, size.z, 0.001);
    const normalizer = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
    const byMaterial = new Map();
    for (const part of parts) {
      part.geometry.applyMatrix4(normalizer);
      const key = part.material.uuid;
      if (!byMaterial.has(key)) byMaterial.set(key, { material: part.material, geometries: [] });
      byMaterial.get(key).geometries.push(part.geometry);
    }
    const template = new THREE.Group();
    for (const { material, geometries } of byMaterial.values()) {
      const merged = mergeGeometries(geometries, false);
      geometries.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      template.add(mesh);
    }
    template.userData.size = size.multiplyScalar(scale);
    templates[spec.key] = template;
  }
  return templates;
}

/** Bake imported forest/rock models into two textured meshes per chunk. */
export function addImportedVegetation(chunk, templates, random, rockTemplate) {
  const byMaterial = new Map();
  const dummy = new THREE.Object3D();
  const place = (template, x, y, z, scale, rotY = 0) => {
    if (!template) return;
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    template.updateMatrixWorld(true);
    template.traverse((object) => {
      if (!object.isMesh) return;
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(dummy.matrix);
      const key = object.material.uuid;
      if (!byMaterial.has(key)) byMaterial.set(key, { material: object.material, geometries: [] });
      byMaterial.get(key).geometries.push(geometry);
    });
  };
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const key = i % 2 ? 'birch' : 'oak';
      place(templates[key], side * (10 + random() * 6), -0.1, -7 + random() * 14, 0.8 + random() * 0.5, random() * 6);
    }
    for (let i = 0; i < 6; i++) place(templates.fern, side * (5 + random() * 3.5), 0, -7 + random() * 14, 0.7 + random() * 0.7, random() * 6);
    for (let i = 0; i < 4; i++) place(i % 2 ? templates.darkBush : templates.lightBush, side * (6 + random() * 4), -0.1, -7 + random() * 14, 0.7 + random() * 0.6, random() * 6);
    for (let i = 0; i < 10; i++) place(templates.grass, side * (4.6 + random() * 4), 0, -7.5 + random() * 15, 0.6 + random() * 0.7, random() * 6);
    for (let i = 0; i < 2; i++) place(templates.flowers, side * (5.5 + random() * 3), 0, -6 + random() * 12, 0.7 + random() * 0.5, random() * 6);
    for (let i = 0; i < 2; i++) place(templates.mossedStone, side * (5.5 + random() * 4), -0.15, -7 + random() * 14, 0.6 + random() * 0.7, random() * 6);
    if (rockTemplate) {
      place(rockTemplate, side * (7 + random() * 4), -0.45, -5 + random() * 10, 2.5 + random() * 2, random() * 6);
    }
  }
  for (const { material, geometries } of byMaterial.values()) {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    chunk.add(mesh);
  }
}
