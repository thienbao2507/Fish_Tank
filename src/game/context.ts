import type Phaser from 'phaser';
import type { Content } from '../core/content/loader';
import type { Rng } from '../core/rng';
import type { ScaledClock } from '../core/time/clock';

/** Các dịch vụ dùng chung cho mọi scene. Tạo một lần trong main.ts. */
export interface GameContext {
  readonly content: Content;
  readonly clock: ScaledClock;
  readonly rng: Rng;
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
