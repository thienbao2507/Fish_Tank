import type { FishRules, FishSpeciesDef } from '../content/schemas';

// Dữ liệu cố định cho unit test (không dùng trong game).

export const testRules: FishRules = {
  startFullness: 80,
  hungryBelow: 40,
  seekFoodBelow: 90,
  sadWaterBelow: 60,
  dirtyWaterBelow: 40,
  sickHealthBelow: 40,
  healthLossPerMinute: 20,
  starvationLossPerMinute: 15,
  recoveryPerMinute: 10,
  leaveAfterSeconds: 90,
  senseFoodRadius: 140,
  eatRadius: 6,
  jumpSpeed: 120,
};

export const testSpecies: FishSpeciesDef = {
  id: 'guppy',
  name: 'fish.guppy',
  texture: 'fish.guppy',
  price: 30,
  radius: 5,
  speed: 30,
  hungerPerMinute: 10,
  waterSensitivity: 1,
  coinIntervalSeconds: 20,
  coinValue: 4,
  pearlChance: 0,
  growSeconds: 120,
};
