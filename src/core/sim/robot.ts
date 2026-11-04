import { Battery } from './battery';
import { Cargo } from './cargo';
import type { MotionState } from './movement';

/** Trạng thái robot. Luật chơi (di chuyển, hút, sạc) nằm ở World. */
export class Robot implements MotionState {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** Hướng sprite: 1 = quay phải, -1 = quay trái. */
  facingX: 1 | -1 = 1;
  /** Hướng điều khiển gần nhất (8 hướng) — súng bong bóng (P4) bắn theo hướng này. */
  aimX = 1;
  aimY = 0;
  vacuumOn = false;
  readonly battery: Battery;
  readonly cargo: Cargo;

  constructor(x: number, y: number, batteryCapacity: number, cargoCapacity: number) {
    this.x = x;
    this.y = y;
    this.battery = new Battery(batteryCapacity);
    this.cargo = new Cargo(cargoCapacity);
  }
}
