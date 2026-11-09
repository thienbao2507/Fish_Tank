import type { TrashCatalog, TrashTypeDef, ZoneDef } from '../content/schemas';
import { pickWeighted, type Rng, type Weighted } from '../rng';
import { nearestLane } from './lanes';
import { blockedBy, resolveMove } from './obstacles';

export interface TrashItem {
  readonly id: number;
  readonly type: TrashTypeDef;
  x: number;
  y: number;
  /** Tầng nước đích: float = 2, mid = 1, sink = 0. */
  readonly lane: number;
  /** Vị trí liên tục giữa các tầng nước. */
  z: number;
  /** Vận tốc trôi ngang (rác nổi và lơ lửng); rác chìm = 0. */
  vx: number;
}

export interface PullParams {
  readonly radius: number;
  readonly pullSpeed: number;
  readonly collectRadius: number;
}

/** Nơi nhận rác khi hút (khoang chứa của robot). */
export interface TrashCollector {
  /** Có còn chỗ cho món này không — không thì món đó không bị hút. */
  canFit(item: TrashItem): boolean;
  /** Nhận món rác; false = không nhận được, rác ở lại. */
  collect(item: TrashItem): boolean;
}

export interface PullResult {
  readonly collected: readonly TrashItem[];
  /** Có món rác trong tầm hút nhưng khoang không đủ chỗ. */
  readonly blocked: boolean;
}

/** Khoảng cách tối thiểu từ rác tới thành bể (px). */
const WALL_MARGIN = 4;
function laneFor(type: TrashTypeDef): number {
  if (type.layer === 'float') return 2;
  if (type.layer === 'mid') return 1;
  return 0;
}

/** Toàn bộ rác trong một khu: sinh rác, rác trôi/chìm/nổi, và bị máy hút kéo. */
export class TrashField {
  private readonly list: TrashItem[] = [];
  private readonly spawnTable: Weighted<TrashTypeDef>[];
  private nextId = 1;
  private spawnTimer = 0;

  constructor(
    private readonly zone: ZoneDef,
    private readonly catalog: TrashCatalog,
    private readonly rng: Rng,
    private readonly fallSeconds: number,
  ) {
    const byId = new Map(catalog.types.map((type) => [type.id, type]));
    this.spawnTable = Object.entries(zone.trash.weights).map(([id, weight]) => {
      const type = byId.get(id);
      if (!type) throw new Error(`Không có loại rác "${id}"`);
      return { item: type, weight };
    });
  }

  get items(): readonly TrashItem[] {
    return this.list;
  }

  /** Tổng mức ô nhiễm nước do rác còn trong khu. */
  get pollution(): number {
    return this.list.reduce((sum, item) => sum + item.type.pollution, 0);
  }

  /** Rải rác lúc bắt đầu game mới; rác chìm nằm sẵn dưới đáy. */
  fillInitial(): void {
    for (let i = 0; i < this.zone.trash.initialCount; i++) {
      this.spawnRandom(true);
    }
  }

  /** Đặt một món rác tại vị trí cho trước (dùng cho test và các đợt rác tràn ở P4). */
  add(type: TrashTypeDef, x: number, y: number, lane = laneFor(type), z = lane): TrashItem {
    const item: TrashItem = {
      id: this.nextId++,
      type,
      x,
      y,
      lane,
      z,
      vx: this.randomDrift(type),
    };
    this.list.push(item);
    return item;
  }

  update(dt: number): void {
    for (const item of this.list) {
      this.moveItem(item, dt);
    }

    const { maxCount, spawnIntervalSeconds } = this.zone.trash;
    if (this.list.length >= maxCount) {
      this.spawnTimer = 0;
      return;
    }
    this.spawnTimer += dt;
    while (this.spawnTimer >= spawnIntervalSeconds && this.list.length < maxCount) {
      this.spawnTimer -= spawnIntervalSeconds;
      this.spawnRandom(false);
    }
  }

  /**
   * Hút rác trong bán kính về phía (x, y). Món nào tới đủ gần thì chuyển cho `collector`.
   * Món không vừa khoang thì đứng yên và đánh dấu `blocked`.
   */
  pull(
    x: number,
    y: number,
    params: PullParams,
    dt: number,
    collector: TrashCollector,
    lane = 0,
  ): PullResult {
    const collected: TrashItem[] = [];
    let blocked = false;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const item = this.list[i] as TrashItem;
      if (nearestLane(item.z) !== lane) continue;
      const dx = x - item.x;
      const dy = y - item.y;
      const distance = Math.hypot(dx, dy);
      if (distance > params.radius) continue;

      if (!collector.canFit(item)) {
        blocked = true;
        continue;
      }
      if (distance <= params.collectRadius) {
        if (collector.collect(item)) {
          this.list.splice(i, 1);
          collected.push(item);
        } else {
          blocked = true;
        }
        continue;
      }
      const step = Math.min(distance, params.pullSpeed * dt);
      const move = resolveMove(
        this.zone.obstacles ?? [],
        item.x,
        item.y,
        item.x + (dx / distance) * step,
        item.y + (dy / distance) * step,
        item.type.radius,
        item.type.radius,
      );
      item.x = move.x;
      item.y = move.y;
    }

    return { collected, blocked };
  }

  private xRange(type: TrashTypeDef): { min: number; max: number } {
    const inset = this.zone.wallWidth + type.radius + WALL_MARGIN;
    return { min: inset, max: this.zone.width - inset };
  }

  private moveItem(item: TrashItem, dt: number): void {
    switch (item.type.layer) {
      case 'float':
        this.drift(item, dt);
        break;
      case 'mid':
        this.drift(item, dt);
        break;
      case 'sink':
        item.z = Math.max(0, item.z - dt / this.fallSeconds);
        break;
    }
  }

  private drift(item: TrashItem, dt: number): void {
    const { min, max } = this.xRange(item.type);
    const move = resolveMove(
      this.zone.obstacles ?? [],
      item.x,
      item.y,
      item.x + item.vx * dt,
      item.y,
      item.type.radius,
      item.type.radius,
    );
    item.x = move.x;
    if (move.hitX) item.vx = -item.vx;
    if (item.x < min) {
      item.x = min;
      item.vx = Math.abs(item.vx);
    } else if (item.x > max) {
      item.x = max;
      item.vx = -Math.abs(item.vx);
    }
  }

  private randomDrift(type: TrashTypeDef): number {
    if (type.layer === 'sink') return 0;
    const speed = this.catalog.driftSpeed * (0.5 + this.rng.next() * 0.5);
    return this.rng.chance(0.5) ? speed : -speed;
  }

  private spawnRandom(initial: boolean): void {
    const { zone, rng } = this;
    const type = pickWeighted(rng, this.spawnTable);
    const { radius } = type;
    const { min, max } = this.xRange(type);
    const minY = zone.surfaceY + radius;
    const maxY = zone.floorY - radius;
    let x: number;
    let y: number;
    let attempts = 0;
    do {
      x = min + rng.next() * (max - min);
      y = minY + rng.next() * (maxY - minY);
      attempts++;
      if (attempts >= 1_000) {
        throw new Error(`Không tìm được vị trí sinh rác ngoài vật cản trong khu "${zone.id}"`);
      }
    } while (blockedBy(zone.obstacles ?? [], x, y, radius, radius));

    const lane = laneFor(type);
    let z = lane;
    if (type.layer === 'sink') {
      // Rác chìm đầu game nằm sẵn ở tầng Đáy; rác sinh sau bắt đầu từ tầng Mặt.
      z = initial ? 0 : 2;
    }
    this.add(type, x, y, lane, z);
  }
}
