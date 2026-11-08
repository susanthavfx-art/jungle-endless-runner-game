import test from 'node:test';
import assert from 'node:assert/strict';
import { RunnerEngine, CONFIG, seededRandom } from '../src/game/engine.js';

function running() {
  const engine = new RunnerEngine(42);
  engine.start();
  engine.drainEvents();
  return engine;
}

function advance(engine, seconds) {
  for (let i = 0; i < Math.round(seconds * 120); i++) engine.step(1 / 120);
}

test('start menu does not advance until Start Game', () => {
  const engine = new RunnerEngine(1);
  advance(engine, 2);
  assert.equal(engine.state, 'ready');
  assert.equal(engine.distance, 0);
  engine.start();
  advance(engine, 1);
  assert.equal(engine.state, 'running');
  assert.ok(engine.distance > 10);
});

test('lane switches are clamped to three lanes and smoothly approached', () => {
  const engine = running();
  assert.equal(engine.move(-1), true);
  assert.equal(engine.move(-1), false);
  assert.equal(engine.lane, -1);
  advance(engine, 0.4);
  assert.ok(Math.abs(engine.x + CONFIG.laneWidth) < 0.01);
  engine.move(1); engine.move(1); engine.move(1);
  assert.equal(engine.lane, 1);
});

test('jump rises, lands, and cannot double-jump in mid-air', () => {
  const engine = running();
  engine.entities = [];
  assert.equal(engine.jump(), true);
  advance(engine, 0.25);
  assert.ok(engine.y > 1);
  assert.equal(engine.jump(), false);
  advance(engine, 0.7);
  assert.equal(engine.y, 0);
  assert.equal(engine.velocityY, 0);
});

test('coins collect once and add 25 points each', () => {
  const engine = running();
  engine.entities = [];
  engine.addCoin(0, 1, 1.12);
  advance(engine, 0.2);
  assert.equal(engine.coins, 1);
  assert.equal(engine.score, Math.floor(engine.distance * 2) + 25);
  advance(engine, 0.2);
  assert.equal(engine.coins, 1);
  assert.ok(engine.drainEvents().some((event) => event.type === 'coin'));
});

test('a log collision ends the run, but a well-timed jump clears it', () => {
  const hit = running();
  hit.entities = [];
  hit.addObstacle(0, 6, 'log');
  advance(hit, 1);
  assert.equal(hit.state, 'over');
  assert.ok(hit.drainEvents().some((event) => event.type === 'hit'));

  const jumped = running();
  jumped.entities = [];
  jumped.addObstacle(0, 6, 'log');
  advance(jumped, 0.28);
  jumped.jump();
  advance(jumped, 0.5);
  assert.equal(jumped.state, 'running');
  assert.ok(jumped.distance > 8);
});

test('tall ruins cannot be jumped and require a lane change', () => {
  const hit = running();
  hit.entities = [];
  hit.addObstacle(0, 6, 'ruins');
  hit.jump();
  advance(hit, 1);
  assert.equal(hit.state, 'over');

  const dodged = running();
  dodged.entities = [];
  dodged.addObstacle(0, 6, 'ruins');
  dodged.move(1);
  advance(dodged, 1);
  assert.equal(dodged.state, 'running');
});

test('pause freezes distance, jump physics and input; resume continues', () => {
  const engine = running();
  engine.entities = [];
  engine.jump();
  advance(engine, 0.1);
  engine.pause();
  const snapshot = [engine.distance, engine.y, engine.score];
  advance(engine, 1);
  engine.move(1);
  engine.jump();
  assert.deepEqual([engine.distance, engine.y, engine.score], snapshot);
  assert.equal(engine.lane, 0);
  engine.resume();
  advance(engine, 0.1);
  assert.ok(engine.distance > snapshot[0]);
});

test('restart resets score, coins, position and obstacles', () => {
  const engine = running();
  advance(engine, 1);
  engine.move(1);
  engine.start();
  assert.equal(engine.distance, 0);
  assert.equal(engine.coins, 0);
  assert.equal(engine.score, 0);
  assert.equal(engine.lane, 0);
  assert.equal(engine.x, 0);
  assert.equal(engine.y, 0);
  assert.equal(engine.state, 'running');
  assert.ok(engine.entities.length > 0);
});

test('generated rows always leave a clear lane and stay bounded over a long run', () => {
  const engine = running();
  engine.entities = [];
  engine.nextRow = 32;
  engine.row = 0;
  let maxEntities = 0;
  for (let i = 0; i < 12000; i++) {
    engine.step(1 / 60);
    maxEntities = Math.max(maxEntities, engine.entities.length);
    if (engine.state === 'over') {
      const obstacle = engine.entities.find((entity) => entity.kind === 'obstacle' && Math.abs(entity.at - engine.distance) < 2);
      const safe = [-1, 0, 1].some((lane) => !engine.entities.some((entity) => entity.kind === 'obstacle' && entity.lane === lane && Math.abs(entity.at - engine.distance) < 2));
      assert.ok(safe, 'a clear lane must exist at the collision row');
      engine.start();
      engine.entities = [];
      engine.nextRow = 32;
      engine.row = 0;
    }
  }
  assert.ok(maxEntities < 120, `entity count stayed bounded (${maxEntities})`);
  assert.ok(engine.speed <= CONFIG.maxSpeed);
});

test('seeded generation is repeatable', () => {
  const a = new RunnerEngine(7), b = new RunnerEngine(7);
  assert.deepEqual(a.entities, b.entities);
  const r1 = seededRandom(9), r2 = seededRandom(9);
  assert.equal(r1(), r2());
});
