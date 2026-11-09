import type { FishRules, FishSpeciesDef, ZoneDef } from '../content/schemas';
import type { Rng } from '../rng';
import type { DropField } from './drops';
import { Fish, isSick, moodOf, stepNeeds, type Mood } from './fish';
import type { FoodField } from './food';
import { LANE_COUNT, nearestLane, stepLane } from './lanes';
import { stepMotion, type Bounds } from './movement';
import { blockedBy, resolveMove } from './obstacles';

export interface SchoolUpdateResult {
  /** Cá vừa chuyển sang Ốm trong khung hình này. */
  readonly becameSick: readonly Fish[];
  /** Cá vừa bắt đầu nhảy khỏi bể. */
  readonly startedLeaving: readonly Fish[];
}

const WANDER_MIN_SECONDS = 3;
const WANDER_EXTRA_SECONDS = 4;
/** Điểm lang thang mới cách vị trí hiện tại tối đa chừng này theo chiều ngang (px). */
const WANDER_RANGE_X = 220;
const ARRIVE_DISTANCE = 4;
/** Gần đích hơn khoảng này thì bơi chậm lại. */
const SLOW_DISTANCE = 12;
const SEEK_FOOD_SPEED = 1.4;
const SICK_SPEED = 0.5;
/** Cá vượt quá tầng Mặt chừng này thì biến mất. */
const GONE_ABOVE_SURFACE = 2.6;

/** Đàn cá trong một khu: bơi, ăn, nhu cầu, sinh xu, bỏ đi. */
export class School {
  private readonly list: Fish[] = [];
  private nextId = 1;

  constructor(
    private readonly zone: ZoneDef,
    private readonly rules: FishRules,
    private readonly nutrition: number,
    private readonly rng: Rng,
  ) {}

  get fish(): readonly Fish[] {
    return this.list;
  }

  /** Thả một con cá; không cho vị trí thì đặt ngẫu nhiên trong nước. */
  add(species: FishSpeciesDef, x?: number, y?: number, lane?: number): Fish {
    const bounds = this.bounds(species);
    let fishX = x ?? bounds.minX + this.rng.next() * (bounds.maxX - bounds.minX);
    let fishY = Math.min(
      bounds.maxY,
      Math.max(bounds.minY, y ?? bounds.minY + this.rng.next() * (bounds.maxY - bounds.minY)),
    );
    let attempts = 0;
    while (blockedBy(this.zone.obstacles ?? [], fishX, fishY, species.radius, species.radius)) {
      fishX = bounds.minX + this.rng.next() * (bounds.maxX - bounds.minX);
      fishY = bounds.minY + this.rng.next() * (bounds.maxY - bounds.minY);
      attempts++;
      if (attempts >= 1_000) {
        throw new Error(`Không tìm được vị trí thả cá ngoài vật cản trong khu "${this.zone.id}"`);
      }
    }
    const fish = new Fish(
      this.nextId++,
      species,
      fishX,
      fishY,
      this.rules.startFullness,
      lane ?? this.rng.int(0, LANE_COUNT - 1),
    );
    this.list.push(fish);
    return fish;
  }

  moodOf(fish: Fish, water: number): Mood {
    return moodOf(fish.fullness, fish.health, water, this.rules);
  }

  /** Cá ốm (chưa bỏ đi) gần (x, y) nhất trong bán kính. */
  nearestSick(x: number, y: number, radius: number, lane = 0): Fish | undefined {
    let best: Fish | undefined;
    let bestDistance = radius;
    for (const fish of this.list) {
      if (fish.leaving || !isSick(fish.health, this.rules) || nearestLane(fish.z) !== lane)
        continue;
      const distance = Math.hypot(fish.x - x, fish.y - y);
      if (distance <= bestDistance) {
        best = fish;
        bestDistance = distance;
      }
    }
    return best;
  }

  /**
   * `dt`: giây thực (bơi, nhảy). `needsDt`: giây game (nhu cầu, sinh xu — chạy nhanh hơn khi tua debug).
   */
  update(
    dt: number,
    needsDt: number,
    water: number,
    food: FoodField,
    drops: DropField,
  ): SchoolUpdateResult {
    const becameSick: Fish[] = [];
    const startedLeaving: Fish[] = [];

    for (let i = this.list.length - 1; i >= 0; i--) {
      const fish = this.list[i] as Fish;

      if (fish.leaving) {
        fish.z += dt / this.rules.leaveRiseSeconds;
        if (fish.z > GONE_ABOVE_SURFACE) this.list.splice(i, 1);
        continue;
      }

      const wasSick = isSick(fish.health, this.rules);
      const mustLeave = stepNeeds(fish, water, this.rules, needsDt);
      if (!wasSick && isSick(fish.health, this.rules)) becameSick.push(fish);
      if (mustLeave) {
        fish.leaving = true;
        fish.vx = 0;
        fish.vy = 0;
        startedLeaving.push(fish);
        continue;
      }

      this.swim(fish, dt, food);
      this.produce(fish, water, needsDt, drops);
    }

    return { becameSick, startedLeaving };
  }

  private swim(fish: Fish, dt: number, food: FoodField): void {
    const { rules } = this;
    let speed = fish.species.speed;
    let targetX: number;
    let targetY: number;

    const pellet =
      fish.fullness < rules.seekFoodBelow
        ? food.nearest(fish.x, fish.y, rules.senseFoodRadius)
        : undefined;
    if (pellet) {
      targetX = pellet.x;
      targetY = pellet.y;
      fish.lane = pellet.lane;
      speed *= SEEK_FOOD_SPEED;
    } else {
      fish.wanderTimer -= dt;
      const distance = Math.hypot(fish.wanderX - fish.x, fish.wanderY - fish.y);
      if (fish.wanderTimer <= 0 || distance < ARRIVE_DISTANCE) this.pickWanderTarget(fish);
      targetX = fish.wanderX;
      targetY = fish.wanderY;
    }
    fish.z = stepLane(fish.z, fish.lane, dt / rules.laneSwitchSeconds);
    if (
      pellet &&
      nearestLane(fish.z) === pellet.lane &&
      Math.hypot(pellet.x - fish.x, pellet.y - fish.y) <= rules.eatRadius + fish.species.radius
    ) {
      food.remove(pellet);
      fish.fullness = Math.min(100, fish.fullness + this.nutrition);
    }
    if (isSick(fish.health, rules)) speed *= SICK_SPEED;

    const dx = targetX - fish.x;
    const dy = targetY - fish.y;
    const distance = Math.hypot(dx, dy);
    let dirX = 0;
    let dirY = 0;
    if (distance > 0.5) {
      const k = Math.min(1, distance / SLOW_DISTANCE) / distance;
      dirX = dx * k;
      dirY = dy * k;
    }
    const fromX = fish.x;
    const fromY = fish.y;
    stepMotion(
      fish,
      dirX,
      dirY,
      dt,
      { maxSpeed: speed, acceleration: speed * 2, deceleration: speed },
      this.bounds(fish.species),
    );
    const move = resolveMove(
      this.zone.obstacles ?? [],
      fromX,
      fromY,
      fish.x,
      fish.y,
      fish.species.radius,
      fish.species.radius,
    );
    fish.x = move.x;
    fish.y = move.y;
    if (move.hitX || move.hitY) {
      if (move.hitX) fish.vx = 0;
      if (move.hitY) fish.vy = 0;
      this.pickWanderTarget(fish);
    }
    if (Math.abs(fish.vx) > 2) fish.facingX = fish.vx > 0 ? 1 : -1;
  }

  /** Cá Vui sinh xu theo chu kỳ; mỗi lần có xác suất nhỏ ra ngọc trai. */
  private produce(fish: Fish, water: number, needsDt: number, drops: DropField): void {
    if (this.moodOf(fish, water) !== 'happy') return;
    const { species } = fish;
    fish.coinTimer += needsDt;
    while (fish.coinTimer >= species.coinIntervalSeconds) {
      fish.coinTimer -= species.coinIntervalSeconds;
      const pearl = this.rng.chance(species.pearlChance);
      drops.spawn(
        pearl ? 'pearl' : 'coin',
        pearl ? 1 : species.coinValue,
        fish.x,
        fish.y,
        nearestLane(fish.z),
      );
    }
  }

  private pickWanderTarget(fish: Fish): void {
    const bounds = this.bounds(fish.species);
    const minX = Math.max(bounds.minX, fish.x - WANDER_RANGE_X);
    const maxX = Math.min(bounds.maxX, fish.x + WANDER_RANGE_X);
    let attempts = 0;
    do {
      fish.wanderX = minX + this.rng.next() * (maxX - minX);
      fish.wanderY = bounds.minY + this.rng.next() * (bounds.maxY - bounds.minY);
      attempts++;
      if (attempts >= 1_000) {
        throw new Error(`Không tìm được điểm bơi ngoài vật cản trong khu "${this.zone.id}"`);
      }
    } while (
      blockedBy(
        this.zone.obstacles ?? [],
        fish.wanderX,
        fish.wanderY,
        fish.species.radius,
        fish.species.radius,
      )
    );
    fish.wanderTimer = WANDER_MIN_SECONDS + this.rng.next() * WANDER_EXTRA_SECONDS;
    if (this.rng.chance(0.25)) {
      let lane = this.rng.int(0, LANE_COUNT - 2);
      if (lane >= fish.lane) lane++;
      fish.lane = lane;
    }
  }

  private bounds(species: FishSpeciesDef): Bounds {
    const { zone } = this;
    const r = species.radius;
    return {
      minX: zone.wallWidth + r + 4,
      maxX: zone.width - zone.wallWidth - r - 4,
      minY: zone.surfaceY + r + 6,
      maxY: zone.floorY - r - 2,
    };
  }
}
