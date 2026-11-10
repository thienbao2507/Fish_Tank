import { describe, expect, it } from 'vitest';
import type { DropRules, FoodRules, ZoneDef } from '../content/schemas';
import { createRng } from '../rng';
import { DropField } from './drops';
import { fishGrowthScale } from './fish';
import { FoodField } from './food';
import { blockedBy } from './obstacles';
import { School } from './school';
import { testRules, testSpecies } from './testFixtures';

const zone = {
  id: 'z',
  width: 600,
  height: 300,
  surfaceY: 20,
  floorY: 280,
  wallWidth: 6,
} as ZoneDef;
const foodRules: FoodRules = {
  price: 5,
  pellets: 1,
  nutrition: 30,
  sinkSpeed: 1,
  dissolveSeconds: 1e9,
  pollution: 2,
  spread: 0,
};
const dropRules: DropRules = {
  sinkSpeed: 20,
  pickupMargin: 3,
  autoCollectSeconds: 1e9,
  autoCollectRatio: 0.5,
};
const DT = 1 / 60;
const FOOD_FALL_SECONDS = 1_000;
const DROP_FALL_SECONDS = 0.8;

function setup(seed = 1) {
  const rng = createRng(seed);
  const school = new School(zone, testRules, foodRules.nutrition, rng);
  const food = new FoodField(zone, foodRules, rng, FOOD_FALL_SECONDS);
  const drops = new DropField(zone, dropRules, DROP_FALL_SECONDS);
  const run = (seconds: number, water = 100, timeScale = 1) => {
    const result = { becameSick: 0, startedLeaving: 0 };
    for (let t = 0; t < seconds - 1e-9; t += DT) {
      const r = school.update(DT, DT * timeScale, water, food, drops);
      result.becameSick += r.becameSick.length;
      result.startedLeaving += r.startedLeaving.length;
    }
    return result;
  };
  return { school, food, drops, run };
}

describe('School', () => {
  it('cá bơi lang thang, không đứng yên và không ra khỏi nước', () => {
    const { school, run } = setup();
    const fish = school.add(testSpecies, 300, 150);
    fish.fullness = 100;
    let minX = fish.x;
    let maxX = fish.x;
    for (let i = 0; i < 120; i++) {
      run(0.5);
      minX = Math.min(minX, fish.x);
      maxX = Math.max(maxX, fish.x);
      expect(fish.x).toBeGreaterThan(zone.wallWidth);
      expect(fish.x).toBeLessThan(zone.width - zone.wallWidth);
      expect(fish.y).toBeGreaterThan(zone.surfaceY);
      expect(fish.y).toBeLessThan(zone.floorY);
    }
    expect(maxX - minX).toBeGreaterThan(40);
  });

  it('cá đói bơi tới thức ăn và ăn', () => {
    const { school, food, run } = setup();
    const fish = school.add(testSpecies, 100, 150, 0);
    fish.fullness = 50;
    food.drop(160, 150);
    run(5);
    expect(food.pellets).toHaveLength(0);
    expect(fish.fullness).toBeGreaterThan(70);
  });

  it('cá đói chuyển sang làn của thức ăn và chỉ ăn khi đã tới đúng làn', () => {
    const { school, food, run } = setup();
    const fish = school.add(testSpecies, 100, 150, 0);
    fish.fullness = 50;
    food.drop(100, 150, 2);

    run(0.1);
    expect(fish.lane).toBe(2);
    expect(fish.z).toBeGreaterThan(0);
    expect(food.pellets).toHaveLength(1);

    run(1);
    expect(food.pellets).toHaveLength(1);
    run(0.2);
    expect(food.pellets).toHaveLength(0);
    expect(fish.fullness).toBeGreaterThan(70);
  });

  it('cá no không đi tìm thức ăn', () => {
    const { school, food, run } = setup();
    const fish = school.add(testSpecies, 100, 150);
    fish.fullness = 100;
    food.drop(105, 150);
    run(0.1);
    expect(food.pellets).toHaveLength(1);
  });

  it('cá Vui sinh xu theo chu kỳ; cá Buồn thì không', () => {
    const happy = setup();
    happy.school.add(testSpecies).fullness = 100;
    happy.run(1.1, 100, testSpecies.coinIntervalSeconds); // hơn 1 chu kỳ một chút
    expect(happy.drops.items.map((drop) => drop.kind)).toEqual(['coin']);
    expect(happy.drops.items[0]?.value).toBe(testSpecies.coinValue);

    const sad = setup();
    sad.school.add(testSpecies).fullness = 100;
    sad.run(1.1, 50, testSpecies.coinIntervalSeconds); // nước dưới ngưỡng Buồn
    expect(sad.drops.items).toHaveLength(0);
  });

  it('cá con chưa đủ tuổi không tăng coinTimer và không sinh xu', () => {
    const { school, drops, run } = setup();
    const fish = school.add(testSpecies, { juvenile: true });
    fish.fullness = 100;

    run(1.1, 100, testSpecies.coinIntervalSeconds);

    expect(fish.isGrown).toBe(false);
    expect(fish.coinTimer).toBe(0);
    expect(drops.items).toHaveLength(0);
  });

  it('cá con đủ tuổi rồi mới sinh xu', () => {
    const { school, food, drops, run } = setup();
    const fish = school.add(testSpecies, { juvenile: true });
    fish.fullness = 100;
    school.update(0, testSpecies.growSeconds, 100, food, drops);

    expect(fish.isGrown).toBe(true);
    expect(drops.items).toHaveLength(0);
    run(1.1, 100, testSpecies.coinIntervalSeconds);
    expect(drops.items.map((drop) => drop.kind)).toEqual(['coin']);
  });

  it('pearlChance quyết định ra ngọc', () => {
    const { school, drops, run } = setup();
    school.add({ ...testSpecies, pearlChance: 1 }).fullness = 100;
    run(1.1, 100, testSpecies.coinIntervalSeconds);
    expect(drops.items.map((drop) => drop.kind)).toEqual(['pearl']);
  });

  it('ốm đủ lâu → báo một lần, nhảy khỏi bể rồi biến mất', () => {
    const { school, run } = setup();
    const fish = school.add(testSpecies);
    fish.health = 45;
    fish.fullness = 100;
    const result = run(2, 0, 60); // nước bẩn hoàn toàn, tua ×60
    expect(result.becameSick).toBe(1);
    expect(result.startedLeaving).toBe(1);
    expect(fish.leaving).toBe(true);
    const y = fish.y;
    const z = fish.z;
    run(0.2);
    expect(fish.y).toBe(y);
    expect(fish.z).toBeGreaterThan(z);
    run(10);
    expect(school.fish).toHaveLength(0);
  });

  it('tìm cá ốm gần nhất trong bán kính', () => {
    const { school } = setup();
    const near = school.add(testSpecies, 100, 100, 0);
    const far = school.add(testSpecies, 300, 100, 0);
    near.health = 10;
    far.health = 10;
    expect(school.nearestSick(90, 100, 50, 0, 1)).toBe(near);
    expect(school.nearestSick(200, 200, 20, 0, 1)).toBeUndefined();
  });

  it('cá sinh ở một trong ba làn và z bắt đầu đúng tại làn đó', () => {
    const { school } = setup(7);
    for (let i = 0; i < 30; i++) school.add(testSpecies, 100, 100);
    expect(new Set(school.fish.map((fish) => fish.lane))).toEqual(new Set([0, 1, 2]));
    expect(school.fish.every((fish) => fish.z === fish.lane)).toBe(true);
  });

  it('cá có thể chọn một làn khác khi đổi điểm lang thang', () => {
    const { school, run } = setup(13);
    const fish = school.add(testSpecies, 300, 150, 0);
    fish.fullness = 100;
    const visited = new Set([fish.lane]);
    for (let i = 0; i < 120; i++) {
      run(0.5);
      visited.add(fish.lane);
    }
    expect(visited.size).toBeGreaterThan(1);
  });

  it('cá và điểm đến không đi vào vật cản', () => {
    const rng = createRng(8);
    const obstacleZone: ZoneDef = {
      ...zone,
      obstacles: [{ x: 300, y: 150, width: 40, height: 200 }],
    };
    const school = new School(obstacleZone, testRules, foodRules.nutrition, rng);
    const food = new FoodField(obstacleZone, foodRules, rng, FOOD_FALL_SECONDS);
    const drops = new DropField(obstacleZone, dropRules, DROP_FALL_SECONDS);
    const fish = school.add(testSpecies, 220, 150, 0);
    fish.fullness = 100;
    fish.wanderX = 380;
    fish.wanderY = 150;
    fish.wanderTimer = 10;

    for (let i = 0; i < 600; i++) {
      school.update(DT, DT, 100, food, drops);
      expect(
        blockedBy(
          obstacleZone.obstacles ?? [],
          fish.x,
          fish.y,
          fish.species.radius,
          fish.species.radius,
        ),
      ).toBe(false);
      expect(
        blockedBy(
          obstacleZone.obstacles ?? [],
          fish.wanderX,
          fish.wanderY,
          fish.species.radius,
          fish.species.radius,
        ),
      ).toBe(false);
    }
  });
});

describe('fishGrowthScale', () => {
  it('bằng 0.6 lúc mới thả, 0.8 giữa kỳ và 1 khi đủ tuổi', () => {
    expect(fishGrowthScale(0, 120)).toBe(0.6);
    expect(fishGrowthScale(60, 120)).toBe(0.8);
    expect(fishGrowthScale(120, 120)).toBe(1);
    expect(fishGrowthScale(240, 120)).toBe(1);
  });
});
