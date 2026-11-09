export const CONFIG = Object.freeze({
  laneWidth: 2.35,
  playerZ: 5.5,
  baseSpeed: 12,
  maxSpeed: 23,
  gravity: 26,
  jumpVelocity: 10.2,
  lookAhead: 165,
  fixedStep: 1 / 60,
});

export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pure game simulation. Rendering, input devices and audio live outside this file. */
export class RunnerEngine {
  constructor(seed = 2026) {
    this.seed = seed;
    this.reset();
  }

  reset(state = 'ready') {
    this.state = state;
    this.random = seededRandom(this.seed);
    this.distance = 0;
    this.coins = 0;
    this.score = 0;
    this.elapsed = 0;
    this.speed = CONFIG.baseSpeed;
    this.lane = 0;
    this.x = 0;
    this.y = 0;
    this.velocityY = 0;
    this.jumpBuffer = 0;
    this.entities = [];
    this.events = [];
    this.nextRow = 32;
    this.row = 0;
    this.nextId = 1;
    for (let i = 0; i < 6; i++) this.addCoin(0, 8 + i * 2.5, 1.12);
    this.populateAhead();
  }

  start() {
    this.reset('running');
    this.events.push({ type: 'start' });
  }

  pause() {
    if (this.state === 'running') this.state = 'paused';
  }

  resume() {
    if (this.state === 'paused') this.state = 'running';
  }

  move(direction) {
    if (this.state !== 'running') return false;
    const next = Math.max(-1, Math.min(1, this.lane + Math.sign(direction)));
    if (next === this.lane) return false;
    this.lane = next;
    this.events.push({ type: 'move', lane: next });
    return true;
  }

  jump() {
    if (this.state !== 'running') return false;
    if (this.y <= 0.001) {
      this.velocityY = CONFIG.jumpVelocity;
      this.y = 0.001;
      this.jumpBuffer = 0;
      this.events.push({ type: 'jump' });
      return true;
    }
    this.jumpBuffer = 0.13;
    return false;
  }

  addCoin(lane, at, height = 1.12) {
    this.entities.push({ id: this.nextId++, kind: 'coin', lane, at, height, collected: false });
  }

  addObstacle(lane, at, type = 'log') {
    const dimensions = {
      log: { clearance: 0.72, depth: 0.85 },
      rock: { clearance: 1.12, depth: 1.05 },
      ruins: { clearance: Infinity, depth: 0.95 },
    }[type];
    this.entities.push({ id: this.nextId++, kind: 'obstacle', type, lane, at, ...dimensions });
  }

  addGap(lane, at, depth = 3.4) {
    this.entities.push({ id: this.nextId++, kind: 'gap', lane, at, depth });
  }

  addCrocodile(lane, at) {
    this.entities.push({ id: this.nextId++, kind: 'croc', lane, at, depth: 1.7, clearance: 0.95 });
  }

  populateAhead() {
    while (this.nextRow < this.distance + CONFIG.lookAhead) {
      const safeLane = this.row === 2 ? 0 : Math.floor(this.random() * 3) - 1;
      const otherLanes = [-1, 0, 1].filter((lane) => lane !== safeLane);
      if (this.random() > 0.5) otherLanes.reverse();
      const count = this.row < 3 || this.random() < 0.48 ? 1 : 2;
      const rowKind = this.row < 3 ? 'obstacle' : this.row === 3 ? 'gap' : this.row === 4 ? 'croc' : (() => {
        const roll = this.random();
        return roll < 0.42 ? 'obstacle' : roll < 0.72 ? 'gap' : 'croc';
      })();
      for (let i = 0; i < count; i++) {
        if (rowKind === 'gap') {
          this.addGap(otherLanes[i], this.nextRow, 3.2 + Math.floor(this.random() * 5) * 0.2);
        } else if (rowKind === 'croc') {
          this.addCrocodile(otherLanes[i], this.nextRow);
        } else {
          const choice = this.random();
          const type = this.row < 3 ? 'log' : choice < 0.48 ? 'log' : choice < 0.8 ? 'rock' : 'ruins';
          this.addObstacle(otherLanes[i], this.nextRow, type);
        }
      }
      for (let i = 0; i < 5; i++) this.addCoin(safeLane, this.nextRow - 5 + i * 2.5);
      this.nextRow += 24 + Math.floor(this.random() * 8);
      this.row++;
    }
  }

  step(delta) {
    if (this.state !== 'running') return;
    const dt = Math.min(Math.max(delta, 0), 0.1);
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < steps && this.state === 'running'; i++) this.integrate(dt / steps);
  }

  integrate(dt) {
    this.elapsed += dt;
    this.speed = Math.min(CONFIG.maxSpeed, CONFIG.baseSpeed + this.distance / 160);
    this.distance += this.speed * dt;
    this.x += (this.lane * CONFIG.laneWidth - this.x) * (1 - Math.exp(-19 * dt));
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.y > 0 || this.velocityY > 0) {
      this.velocityY -= CONFIG.gravity * dt;
      this.y += this.velocityY * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.velocityY = 0;
        if (this.jumpBuffer > 0) this.jump();
      }
    }

    for (const entity of this.entities) {
      const forwardDistance = Math.abs(entity.at - this.distance);
      const lateralDistance = Math.abs(entity.lane * CONFIG.laneWidth - this.x);
      if (entity.kind === 'coin' && !entity.collected) {
        if (forwardDistance < 0.85 && lateralDistance < 0.78 && Math.abs(this.y + 1.05 - entity.height) < 1.15) {
          entity.collected = true;
          this.coins++;
          this.events.push({ type: 'coin', id: entity.id, lane: entity.lane, at: entity.at, height: entity.height });
        }
      } else if (entity.kind === 'obstacle' && !entity.passed) {
        if (forwardDistance < entity.depth / 2 + 0.34 && lateralDistance < 0.87 && this.y < entity.clearance) {
          this.state = 'over';
          this.events.push({ type: 'hit', obstacle: entity.type });
          break;
        }
        if (entity.at < this.distance - 1.5) entity.passed = true;
      } else if (entity.kind === 'croc' && !entity.passed) {
        if (forwardDistance < entity.depth / 2 + 0.34 && lateralDistance < 0.87 && this.y < entity.clearance) {
          this.state = 'over';
          this.events.push({ type: 'hit', obstacle: 'crocodile' });
          break;
        }
        if (entity.at < this.distance - 1.5) entity.passed = true;
      } else if (entity.kind === 'gap' && !entity.passed) {
        // Fall only while actually over the hole and too low to clear it.
        if (forwardDistance < entity.depth / 2 - 0.12 && lateralDistance < 0.92 && this.y < 0.45) {
          this.state = 'over';
          this.events.push({ type: 'hit', obstacle: 'gap' });
          break;
        }
        if (entity.at < this.distance - entity.depth / 2 - 1) entity.passed = true;
      }
    }
    this.score = Math.floor(this.distance * 2) + this.coins * 25;
    this.entities = this.entities.filter((entity) => entity.at > this.distance - 14 && !entity.collected);
    this.populateAhead();
  }

  drainEvents() {
    const result = this.events;
    this.events = [];
    return result;
  }
}
