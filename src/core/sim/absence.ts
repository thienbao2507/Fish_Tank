import type { FishRules } from '../content/schemas';
import { moodOf, type Fish } from './fish';

/** Tính số xu cá vui sinh trong lúc người chơi rời bể; không mô phỏng nhu cầu hay ngọc. */
export function absenceCoins(
  fish: readonly Fish[],
  seconds: number,
  maxSeconds: number,
  water: number,
  rules: FishRules,
): number {
  const elapsed = Math.max(0, Math.min(seconds, maxSeconds));
  let coins = 0;
  for (const item of fish) {
    if (
      !item.isGrown ||
      item.leaving ||
      moodOf(item.fullness, item.health, water, rules) !== 'happy'
    )
      continue;
    coins += (item.species.coinValue / item.species.coinIntervalSeconds) * elapsed;
  }
  return Math.floor(coins);
}
