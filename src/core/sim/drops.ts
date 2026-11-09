import type { DropRules, ZoneDef } from '../content/schemas';
import { floorAt } from './terrain';

export type DropKind = 'coin' | 'pearl';

/** Xu hoặc ngọc cá sinh ra, rơi xuống đáy chờ robot nhặt. */
export interface Drop {
  readonly id: number;
  readonly kind: DropKind;
  readonly value: number;
  x: number;
  y: number;
  /** Làn sâu nơi cá sinh ra xu/ngọc. */
  readonly lane: number;
  /** Số giây kể từ khi rơi ra. */
  age: number;
}

export class DropField {
  private readonly list: Drop[] = [];
  private nextId = 1;

  constructor(
    private readonly zone: ZoneDef,
    private readonly rules: DropRules,
  ) {}

  get items(): readonly Drop[] {
    return this.list;
  }

  spawn(kind: DropKind, value: number, x: number, y: number, lane = 0): Drop {
    const drop: Drop = { id: this.nextId++, kind, value, x, y, lane, age: 0 };
    this.list.push(drop);
    return drop;
  }

  /** Rơi xuống đáy và tăng tuổi. Trả về các món quá hạn (đã xoá khỏi bể) để tự cộng. */
  update(dt: number): Drop[] {
    const expired: Drop[] = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const drop = this.list[i] as Drop;
      const restY = floorAt(this.zone, drop.x) - 3;
      drop.y = Math.min(restY, drop.y + this.rules.sinkSpeed * dt);
      drop.age += dt;
      if (drop.age >= this.rules.autoCollectSeconds) {
        this.list.splice(i, 1);
        expired.push(drop);
      }
    }
    return expired;
  }

  /** Nhặt (và xoá) mọi món nằm trong hộp tâm (x, y) với nửa rộng/nửa cao cho trước. */
  pickup(x: number, y: number, halfWidth: number, halfHeight: number, lane = 0): Drop[] {
    const picked: Drop[] = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const drop = this.list[i] as Drop;
      if (drop.lane !== lane) continue;
      if (Math.abs(drop.x - x) <= halfWidth && Math.abs(drop.y - y) <= halfHeight) {
        this.list.splice(i, 1);
        picked.push(drop);
      }
    }
    return picked;
  }
}
