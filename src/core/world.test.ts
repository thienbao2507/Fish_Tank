import { describe, expect, it } from 'vitest';
import { loadContent, type Content } from './content/loader';
import { rawContent } from './content/raw';
import type { Balance, TrashTypeDef, ZoneDef } from './content/schemas';
import { EventBus, type GameEvents } from './events';
import { createRng } from './rng';
import { World } from './world';

const STILL = { moveX: 0, moveY: 0 };
const DT = 1 / 60;

/**
 * World dùng dữ liệu thật nhưng không có rác ngẫu nhiên, để test chủ động đặt rác.
 * `balance` ghi đè một phần balance.json (vd. bỏ cá có sẵn).
 */
function setup(balance: Partial<Balance> = {}) {
  const base = loadContent(rawContent);
  const startZone = base.zones.find((zone) => zone.id === base.balance.startZone) as ZoneDef;
  const zone: ZoneDef = {
    ...startZone,
    trash: { ...startZone.trash, initialCount: 0, spawnIntervalSeconds: 1e9 },
  };
  const content: Content = { ...base, zones: [zone], balance: { ...base.balance, ...balance } };
  const bus = new EventBus<GameEvents>();
  const toasts: string[] = [];
  const sold: number[] = [];
  const collected: GameEvents['drop:collected'][] = [];
  bus.on('toast', (event) => toasts.push(event.key));
  bus.on('station:sold', (event) => sold.push(event.coins));
  bus.on('drop:collected', (event) => collected.push(event));
  const world = new World({ content, rng: createRng(1), bus });
  const trashType = (id: string) =>
    content.trash.types.find((type) => type.id === id) as TrashTypeDef;
  return { world, content, zone, toasts, sold, collected, trashType };
}

function run(world: World, seconds: number, input = STILL, timeScale = 1): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) world.update(DT, input, timeScale);
}

/** Đưa robot ra giữa bể (xa trạm) để pin không được sạc. */
function moveAway(world: World): void {
  world.robot.x = world.zone.width / 2;
  world.robot.y = (world.zone.surfaceY + world.zone.floorY) / 2;
  world.update(DT, STILL);
}

function dock(world: World): void {
  const { station } = world.zone;
  world.robot.x = station.x + station.width / 2;
  world.robot.y = station.y + station.height / 2;
}

describe('World', () => {
  it('bắt đầu đúng điểm xuất phát với pin đầy, khoang rỗng, số xu ban đầu', () => {
    const { world, content, zone } = setup();
    world.update(DT, STILL);
    expect(world.robot.x).toBe(zone.robotSpawn.x);
    expect(world.robot.y).toBe(zone.robotSpawn.y);
    expect(world.robot.battery.isFull).toBe(true);
    expect(world.robot.cargo.isEmpty).toBe(true);
    expect(world.wallet.get('coins')).toBe(content.balance.startingCoins);
  });

  it('đổi làn trong biên 0..2 và z trượt hết một làn sau khoảng 0,35 giây', () => {
    const { world, content } = setup();
    expect(world.robot.lane).toBe(0);
    expect(world.robot.z).toBe(0);
    expect(world.changeLane(-1)).toBe(false);
    expect(world.changeLane(1)).toBe(true);
    expect(world.robot.lane).toBe(1);

    run(world, content.balance.robot.laneSwitchSeconds);
    expect(world.robot.z).toBeCloseTo(1);

    expect(world.changeLane(1)).toBe(true);
    expect(world.changeLane(1)).toBe(false);
    run(world, content.balance.robot.laneSwitchSeconds);
    expect(world.robot.z).toBeCloseTo(2);
  });

  it('không đậu và không sạc ở làn khác làn Gần', () => {
    const { world, trashType } = setup();
    moveAway(world);
    world.robot.battery.drain(50);
    const can = trashType('can');
    world.robot.cargo.add(can.id, can.slots);
    const coins = world.wallet.get('coins');
    world.changeLane(1);
    run(world, 0.35);
    const charge = world.robot.battery.charge;

    dock(world);
    run(world, 1);

    expect(world.isDocked).toBe(false);
    expect(world.isCharging).toBe(false);
    expect(world.robot.battery.charge).toBe(charge);
    expect(world.robot.cargo.isEmpty).toBe(false);
    expect(world.wallet.get('coins')).toBe(coins);
  });

  it('pin chỉ giảm khi máy hút đang bật', () => {
    const { world, content } = setup();
    moveAway(world);
    run(world, 1);
    expect(world.robot.battery.charge).toBe(content.balance.robot.batteryCapacity);

    world.toggleVacuum();
    run(world, 1);
    const expected =
      content.balance.robot.batteryCapacity - content.balance.robot.vacuum.drainPerSecond;
    expect(world.robot.battery.charge).toBeCloseTo(expected, 1);
  });

  it('hết pin → máy hút tự tắt và báo cho người chơi', () => {
    const { world, toasts } = setup();
    moveAway(world);
    world.robot.battery.drain(world.robot.battery.charge - 0.01);
    world.toggleVacuum();
    run(world, 1);
    expect(world.robot.vacuumOn).toBe(false);
    expect(toasts).toContain('toast.batteryEmpty');
  });

  it('hết pin thì không bật được máy hút', () => {
    const { world, toasts } = setup();
    moveAway(world);
    world.robot.battery.drain(world.robot.battery.capacity);
    expect(world.toggleVacuum()).toBe(false);
    expect(world.robot.vacuumOn).toBe(false);
    expect(toasts).toContain('toast.noBattery');
  });

  it('hút rác ở gần vào khoang', () => {
    const { world, trashType } = setup();
    moveAway(world);
    world.trash.add(trashType('can'), world.robot.x + 15, world.robot.y, 0);
    world.toggleVacuum();
    run(world, 1);
    expect(world.trash.items).toHaveLength(0);
    expect(world.robot.cargo.contents.get('can')).toBe(1);
  });

  it('máy hút bỏ qua rác khác làn và hút rác cùng làn', () => {
    const { world, trashType } = setup();
    moveAway(world);
    const can = trashType('can');
    const otherLane = world.trash.add(can, world.robot.x + 5, world.robot.y, 1);
    world.trash.add(can, world.robot.x + 5, world.robot.y, 0);
    world.toggleVacuum();

    run(world, 0.2);

    expect(world.trash.items).toEqual([otherLane]);
    expect(world.robot.cargo.contents.get('can')).toBe(1);
  });

  it('máy hút tắt thì không hút rác', () => {
    const { world, trashType } = setup();
    moveAway(world);
    world.trash.add(trashType('can'), world.robot.x + 15, world.robot.y, 0);
    run(world, 1);
    expect(world.trash.items).toHaveLength(1);
    expect(world.robot.cargo.isEmpty).toBe(true);
  });

  it('về trạm: đổi toàn bộ rác thành đúng số xu, khoang rỗng', () => {
    const { world, sold, trashType } = setup();
    moveAway(world);
    const can = trashType('can');
    const tire = trashType('tire');
    world.robot.cargo.add(can.id, can.slots);
    world.robot.cargo.add(can.id, can.slots);
    world.robot.cargo.add(tire.id, tire.slots);
    const expected = can.value * 2 + tire.value;
    const before = world.wallet.get('coins');

    dock(world);
    world.update(DT, STILL);
    expect(world.wallet.get('coins')).toBe(before + expected);
    expect(sold).toEqual([expected]);
    expect(world.robot.cargo.isEmpty).toBe(true);
  });

  it('đậu ở trạm thì sạc pin', () => {
    const { world, content } = setup();
    moveAway(world);
    world.robot.battery.drain(50);
    dock(world);
    run(world, 1);
    expect(world.isCharging).toBe(true);
    expect(world.robot.battery.charge).toBeCloseTo(50 + content.balance.station.chargePerSecond, 0);
  });

  it('khoang đầy → rác không bị hút và chỉ báo một lần', () => {
    const { world, toasts, trashType } = setup();
    moveAway(world);
    const can = trashType('can');
    while (world.robot.cargo.add(can.id, can.slots));
    world.trash.add(can, world.robot.x + 15, world.robot.y, 0);
    world.toggleVacuum();
    run(world, 2);
    expect(world.trash.items).toHaveLength(1);
    expect(toasts.filter((key) => key === 'toast.cargoFull')).toHaveLength(1);
  });

  it('robot không ra khỏi nước và không xuyên thành bể', () => {
    const { world, zone, content } = setup();
    const { halfWidth, halfHeight } = content.balance.robot;
    world.robot.x = zone.wallWidth + halfWidth;
    world.robot.y = 200;
    run(world, 10, { moveX: 0, moveY: -1 });
    expect(world.robot.y).toBe(zone.surfaceY + halfHeight);
    world.robot.x = zone.width / 2;
    world.robot.y = 550;
    world.robot.vx = 0;
    world.robot.vy = 0;
    run(world, 30, { moveX: 1, moveY: 0 });
    expect(world.robot.x).toBe(zone.width - zone.wallWidth - halfWidth);
    expect(world.robot.facingX).toBe(1);
    run(world, 30, { moveX: -1, moveY: 0 });
    expect(world.robot.facingX).toBe(-1);
  });

  it('robot bị vách chặn và vận tốc trên trục va chạm về 0', () => {
    const { world, zone, content } = setup({ startingFish: [] });
    const obstacle = zone.obstacles?.[0];
    expect(obstacle).toBeDefined();
    if (!obstacle) return;
    world.robot.x = obstacle.x - obstacle.width / 2 - content.balance.robot.halfWidth - 20;
    world.robot.y = obstacle.y;

    run(world, 3, { moveX: 1, moveY: 0 });

    expect(world.robot.x).toBe(obstacle.x - obstacle.width / 2 - content.balance.robot.halfWidth);
    expect(world.robot.vx).toBe(0);
  });
});

describe('World — cá và nước (P2)', () => {
  it('game mới có sẵn cá theo balance.json', () => {
    const { world, content } = setup();
    const expected = content.balance.startingFish.reduce((sum, entry) => sum + entry.count, 0);
    expect(world.fish).toHaveLength(expected);
  });

  it('nhiều rác → nước bẩn dần; dọn sạch → nước trong lại', () => {
    const { world, trashType } = setup({ startingFish: [] });
    expect(world.water).toBe(100);
    const tire = trashType('tire');
    for (let i = 0; i < 10; i++) world.trash.add(tire, 300 + i * 20, 400, 0);
    run(world, 2, STILL, 60); // ~2 phút game
    const dirty = world.water;
    expect(dirty).toBeLessThan(100);
    expect(dirty).toBeGreaterThanOrEqual(100 - world.pollution);

    for (const item of [...world.trash.items]) {
      world.trash.pull(item.x, item.y, { radius: 1, pullSpeed: 1, collectRadius: 1 }, DT, {
        canFit: () => true,
        collect: () => true,
      });
    }
    run(world, 2, STILL, 60);
    expect(world.water).toBeGreaterThan(dirty);
  });

  it('tua thời gian làm cá đói nhanh hơn', () => {
    const normal = setup();
    const fast = setup();
    run(normal.world, 1);
    run(fast.world, 1, STILL, 60);
    const fullness = (w: World) => (w.fish[0] as World['fish'][number]).fullness;
    expect(fullness(fast.world)).toBeLessThan(fullness(normal.world));
  });

  describe('cho ăn', () => {
    it('tốn xu và thả thức ăn tại robot', () => {
      const { world, content } = setup();
      const before = world.wallet.get('coins');
      expect(world.feed()).toBe(true);
      expect(world.wallet.get('coins')).toBe(before - content.balance.food.price);
      expect(world.food.pellets).toHaveLength(content.balance.food.pellets);
    });

    it('không đủ xu → báo và không thả', () => {
      const { world, toasts } = setup({ startingCoins: 0 });
      expect(world.feed()).toBe(false);
      expect(world.food.pellets).toHaveLength(0);
      expect(toasts).toContain('toast.notEnoughCoins');
    });

    it('thức ăn thừa dưới đáy làm bẩn nước', () => {
      const { world } = setup({ startingFish: [] });
      world.wallet.add('coins', 1000);
      for (let i = 0; i < 10; i++) world.feed();
      run(world, 30); // chìm tới đáy
      expect(world.food.pollution).toBeGreaterThan(0);
      run(world, 1, STILL, 60);
      expect(world.water).toBeLessThan(100);
    });
  });

  describe('chữa bệnh', () => {
    it('không có cá ốm trong tầm → không làm gì, không trừ xu', () => {
      const { world } = setup();
      const before = world.wallet.get('coins');
      expect(world.canGiveMedicine()).toBe(false);
      expect(world.giveMedicine()).toBe(false);
      expect(world.wallet.get('coins')).toBe(before);
    });

    it('có cá ốm gần robot → chữa khỏi và trừ xu', () => {
      const { world, content } = setup();
      const fish = world.fish[0] as World['fish'][number];
      fish.health = 10;
      fish.lane = 0;
      fish.z = 0;
      fish.x = world.robot.x + 10;
      fish.y = world.robot.y;
      expect(world.canGiveMedicine()).toBe(true);
      const before = world.wallet.get('coins');
      expect(world.giveMedicine()).toBe(true);
      expect(fish.health).toBe(content.balance.medicine.healTo);
      expect(world.wallet.get('coins')).toBe(before - content.balance.medicine.price);
    });

    it('thuốc chỉ chữa cá ốm cùng làn với robot', () => {
      const { world } = setup();
      const fish = world.fish[0] as World['fish'][number];
      fish.health = 10;
      fish.x = world.robot.x;
      fish.y = world.robot.y;
      fish.lane = 1;
      fish.z = 1;
      expect(world.canGiveMedicine()).toBe(false);
      expect(world.giveMedicine()).toBe(false);

      world.robot.lane = 1;
      world.robot.z = 1;
      expect(world.canGiveMedicine()).toBe(true);
      expect(world.giveMedicine()).toBe(true);
      expect(fish.health).toBeGreaterThan(10);
    });
  });

  describe('xu và ngọc cá sinh ra', () => {
    it('robot chạm vào là nhặt đủ giá trị', () => {
      const { world, collected } = setup({ startingFish: [] });
      moveAway(world);
      const before = world.wallet.get('coins');
      world.drops.spawn('coin', 4, world.robot.x, world.robot.y);
      world.update(DT, STILL);
      expect(world.wallet.get('coins')).toBe(before + 4);
      expect(collected[0]).toMatchObject({ currency: 'coins', amount: 4, auto: false });
    });

    it('robot chỉ nhặt xu khi cùng làn', () => {
      const { world, collected } = setup({ startingFish: [] });
      moveAway(world);
      const before = world.wallet.get('coins');
      world.drops.spawn('coin', 4, world.robot.x, world.robot.y, 1);
      world.update(DT, STILL);
      expect(world.wallet.get('coins')).toBe(before);
      expect(world.drops.items).toHaveLength(1);

      world.robot.lane = 1;
      world.robot.z = 1;
      world.update(DT, STILL);
      expect(world.wallet.get('coins')).toBe(before + 4);
      expect(world.drops.items).toHaveLength(0);
      expect(collected[0]?.z).toBe(1);
    });

    it('nhặt ngọc → cộng ngọc', () => {
      const { world } = setup({ startingFish: [] });
      moveAway(world);
      world.drops.spawn('pearl', 1, world.robot.x, world.robot.y);
      world.update(DT, STILL);
      expect(world.wallet.get('pearls')).toBe(1);
    });

    it('để quá hạn → tự cộng 50%; ngọc quy ra xu', () => {
      const { world, content, collected } = setup({ startingFish: [] });
      moveAway(world);
      const before = world.wallet.get('coins');
      world.drops.spawn('coin', 4, 200, 100);
      world.drops.spawn('pearl', 1, 260, 100);
      run(world, content.balance.drops.autoCollectSeconds + 0.1);
      const pearlAsCoins = content.balance.economy.pearlValueInCoins * 0.5;
      expect(world.wallet.get('coins')).toBe(before + 2 + pearlAsCoins);
      expect(world.wallet.get('pearls')).toBe(0);
      expect(collected.every((event) => event.auto)).toBe(true);
      expect(world.drops.items).toHaveLength(0);
    });
  });
});
