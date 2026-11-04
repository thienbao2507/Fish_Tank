import type Phaser from 'phaser';
import type { Content } from '../core/content/loader';
import type { EventBus, GameEvents } from '../core/events';
import type { PlayerInput } from '../core/input';
import type { Rng } from '../core/rng';
import type { ScaledClock } from '../core/time/clock';
import type { World } from '../core/world';

/** Các dịch vụ dùng chung cho mọi scene. Tạo một lần trong main.ts. */
export interface GameContext {
  readonly content: Content;
  readonly clock: ScaledClock;
  readonly rng: Rng;
  readonly bus: EventBus<GameEvents>;
  readonly world: World;
  /** UIScene ghi (joystick/bàn phím), GameScene đọc mỗi khung hình. */
  readonly input: PlayerInput;
}

const REGISTRY_KEY = 'ctx';

export function setContext(game: Phaser.Game, ctx: GameContext): void {
  game.registry.set(REGISTRY_KEY, ctx);
}

export function getContext(scene: Phaser.Scene): GameContext {
  const ctx: unknown = scene.registry.get(REGISTRY_KEY);
  if (!ctx) {
    throw new Error('GameContext chưa được khởi tạo (setContext phải chạy ở preBoot).');
  }
  return ctx as GameContext;
}
