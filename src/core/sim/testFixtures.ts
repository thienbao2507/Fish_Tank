import type { FishRules, FishSpeciesDef, ZoneDef } from '../content/schemas';

// Dữ liệu cố định cho unit test (không dùng trong game).

export const testRules: FishRules = {
  laneSwitchSeconds: 0.8,
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
  leaveRiseSeconds: 0.8,
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

/** Khu test có đúng một gò cao 36px ở giữa bể. */
export const testHillyZone: ZoneDef = {
  id: 'hilly-zone',
  width: 600,
  height: 300,
  surfaceY: 20,
  floorY: 280,
  terrain: [
    [0, 0],
    [250, 0],
    [300, 36],
    [350, 0],
    [600, 0],
  ],
  wallWidth: 6,
  station: { x: 10, y: 240, width: 40, height: 40 },
  robotSpawn: { x: 30, y: 250 },
  trash: {
    initialCount: 0,
    maxCount: 10,
    spawnIntervalSeconds: 1e9,
    weights: { bottle: 1, bag: 1, can: 1 },
  },
};
