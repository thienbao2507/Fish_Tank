import type { FoodRules, ZoneDef } from '../content/schemas';
import type { Rng } from '../rng';
import { nearestLane } from './lanes';

export interface FoodPellet {
  readonly id: number;
  x: number;
  y: number;
  /** Tầng nước hiện tại, làm tròn từ z. */
  lane: number;
  /** Vị trí liên tục giữa các tầng nước. */
  z: number;
  /** Đã chìm tới tầng Đáy (thành thức ăn thừa, gây ô nhiễm). */
  settled: boolean;
  /** Số giây đã nằm dưới đáy. */
  age: number;
}

/** Thức ăn trong khu: thả ra, chìm dần, nằm dưới đáy làm bẩn nước rồi tan. */
export class FoodField {
  private readonly list: FoodPellet[] = [];
  private nextId = 1;

  constructor(
    private readonly zone: ZoneDef,
    private readonly rules: FoodRules,
    private readonly rng: Rng,
    private readonly fallSeconds: number,
  ) {}

  get pellets(): readonly FoodPellet[] {
    return this.list;
  }

  /** Mức ô nhiễm do thức ăn thừa dưới đáy. */
  get pollution(): number {
    return this.list.reduce((sum, pellet) => sum + (pellet.settled ? this.rules.pollution : 0), 0);
  }

  /** Thả một mẻ thức ăn quanh (x, y) tại đúng độ sâu z. */
  drop(x: number, y: number, z = 0): void {
    const { zone, rules } = this;
    const minX = zone.wallWidth + 2;
    const maxX = zone.width - zone.wallWidth - 2;
    for (let i = 0; i < rules.pellets; i++) {
      const offset = (this.rng.next() * 2 - 1) * rules.spread;
      const pelletX = Math.min(maxX, Math.max(minX, x + offset));
      this.list.push({
        id: this.nextId++,
        x: pelletX,
        y,
        lane: nearestLane(z),
        z,
        settled: z === 0,
        age: 0,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const pellet = this.list[i] as FoodPellet;
      if (!pellet.settled) {
        pellet.z = Math.max(0, pellet.z - dt / this.fallSeconds);
        pellet.lane = nearestLane(pellet.z);
        if (pellet.z === 0) {
          pellet.settled = true;
        }
      } else {
        pellet.age += dt;
        if (pellet.age >= this.rules.dissolveSeconds) {
          this.list.splice(i, 1);
        }
      }
    }
  }

  /** Viên gần (x, y) nhất trong bán kính, nếu có. */
  nearest(x: number, y: number, radius: number): FoodPellet | undefined {
    let best: FoodPellet | undefined;
    let bestDistance = radius;
    for (const pellet of this.list) {
      const distance = Math.hypot(pellet.x - x, pellet.y - y);
      if (distance <= bestDistance) {
        best = pellet;
        bestDistance = distance;
      }
    }
    return best;
  }

  remove(pellet: FoodPellet): void {
    const index = this.list.indexOf(pellet);
    if (index >= 0) this.list.splice(index, 1);
  }
}
