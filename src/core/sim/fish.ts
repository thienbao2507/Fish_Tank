import type { FishRules, FishSpeciesDef } from '../content/schemas';
import type { MotionState } from './movement';

/** Tâm trạng cá (spec 4.2): Vui → Buồn → Ốm. */
export type Mood = 'happy' | 'sad' | 'sick';

export class Fish implements MotionState {
  x: number;
  y: number;
  /** Làn sâu đích: 0 Gần, 1 Giữa, 2 Xa. */
  lane: number;
  /** Vị trí sâu liên tục khi đang trượt giữa các làn. */
  z: number;
  vx = 0;
  vy = 0;
  facingX: 1 | -1 = 1;
  /** No, 0–100. */
  fullness: number;
  /** Máu, 0–100; dưới ngưỡng thì Ốm. */
  health = 100;
  /** Số giây game đã ốm liên tục. */
  sickSeconds = 0;
  /** Tích luỹ giây game để sinh xu. */
  coinTimer = 0;
  /** Đang nhảy khỏi bể (không cứu được nữa). */
  leaving = false;
  wanderX: number;
  wanderY: number;
  wanderTimer = 0;

  constructor(
    readonly id: number,
    readonly species: FishSpeciesDef,
    x: number,
    y: number,
    fullness: number,
    lane = 0,
  ) {
    this.x = x;
    this.y = y;
    this.lane = lane;
    this.z = lane;
    this.wanderX = x;
    this.wanderY = y;
    this.fullness = fullness;
  }
}

export function isSick(health: number, rules: FishRules): boolean {
  return health < rules.sickHealthBelow;
}

export function moodOf(fullness: number, health: number, water: number, rules: FishRules): Mood {
  if (isSick(health, rules)) return 'sick';
  if (fullness < rules.hungryBelow || water < rules.sadWaterBelow) return 'sad';
  return 'happy';
}

/**
 * Cập nhật No, máu và thời gian ốm trong `dt` giây game.
 * Máu giảm khi nước bẩn (theo độ nhạy của loài) hoặc khi đói lả; hồi lại khi không có nguyên nhân nào.
 * Trả về true khi cá đã ốm đủ lâu và phải bỏ đi.
 */
export function stepNeeds(fish: Fish, water: number, rules: FishRules, dt: number): boolean {
  const minutes = dt / 60;
  fish.fullness = Math.max(0, fish.fullness - fish.species.hungerPerMinute * minutes);

  let healthChange = 0;
  if (water < rules.dirtyWaterBelow) {
    const dirtiness = (rules.dirtyWaterBelow - water) / rules.dirtyWaterBelow;
    healthChange -= rules.healthLossPerMinute * fish.species.waterSensitivity * dirtiness;
  }
  if (fish.fullness <= 0) {
    healthChange -= rules.starvationLossPerMinute;
  }
  if (healthChange === 0) {
    healthChange = rules.recoveryPerMinute;
  }
  fish.health = Math.min(100, Math.max(0, fish.health + healthChange * minutes));

  if (isSick(fish.health, rules)) {
    fish.sickSeconds += dt;
  } else {
    fish.sickSeconds = 0;
  }
  return fish.sickSeconds >= rules.leaveAfterSeconds;
}
