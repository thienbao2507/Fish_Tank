import type { TrashCatalog, TrashTypeDef, ZoneDef } from '../content/schemas';
import { pickWeighted, type Rng, type Weighted } from '../rng';

export interface TrashItem {
  readonly id: number;
  readonly type: TrashTypeDef;
  x: number;
  y: number;
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
/** Rác lơ lửng sinh cách mặt nước và đáy ít nhất chừng này (px). */
const MID_MARGIN = 24;

function approach(current: number, target: number, maxStep: number): number {
  if (current < target) return Math.min(target, current + maxStep);
  return Math.max(target, current - maxStep);
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
  add(type: TrashTypeDef, x: number, y: number): TrashItem {
    const item: TrashItem = { id: this.nextId++, type, x, y, vx: this.randomDrift(type) };
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
  ): PullResult {
    const collected: TrashItem[] = [];
    let blocked = false;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const item = this.list[i] as TrashItem;
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
      item.x += (dx / distance) * step;
      item.y += (dy / distance) * step;
    }

    return { collected, blocked };
  }

  private xRange(type: TrashTypeDef): { min: number; max: number } {
    const inset = this.zone.wallWidth + type.radius + WALL_MARGIN;
    return { min: inset, max: this.zone.width - inset };
  }

  private moveItem(item: TrashItem, dt: number): void {
    const { zone } = this;
    const { radius } = item.type;
    const verticalStep = this.catalog.sinkSpeed * dt;

    switch (item.type.layer) {
      case 'float':
        // Bị hút xuống rồi thả ra thì nổi lên lại.
        item.y = approach(item.y, zone.surfaceY + radius, verticalStep);
        this.drift(item, dt);
        break;
      case 'mid':
        item.y = Math.min(zone.floorY - radius, Math.max(zone.surfaceY + radius, item.y));
        this.drift(item, dt);
        break;
      case 'sink':
        item.y = Math.min(zone.floorY - radius, item.y + verticalStep);
        break;
    }
  }

  private drift(item: TrashItem, dt: number): void {
    const { min, max } = this.xRange(item.type);
    item.x += item.vx * dt;
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
    const x = min + rng.next() * (max - min);

    let y: number;
    switch (type.layer) {
      case 'float':
        y = zone.surfaceY + radius;
        break;
      case 'mid': {
        const top = zone.surfaceY + radius + MID_MARGIN;
        const bottom = zone.floorY - radius - MID_MARGIN;
        y = top + rng.next() * Math.max(0, bottom - top);
        break;
      }
      case 'sink':
        // Lúc đầu game rác chìm nằm sẵn dưới đáy; rác mới rơi từ mặt nước xuống.
        y = initial ? zone.floorY - radius : zone.surfaceY + radius;
        break;
    }
    this.add(type, x, y);
  }
}
