import { describe, expect, it } from 'vitest';
import { loadContent, type Content } from './content/loader';
import { rawContent } from './content/raw';
import type { Balance, TrashTypeDef, ZoneDef } from './content/schemas';
import { EventBus, type GameEvents } from './events';
import { createRng } from './rng';
import type { OrderItem } from './sim/items';
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

function deliverItem(world: World, item: OrderItem, now = 0): void {
  if (!world.orderItem(item, now)) throw new Error(`Không đặt được ${JSON.stringify(item)}`);
  const order = world.orders[world.orders.length - 1];
  if (!order) throw new Error('Đơn vật phẩm không được tạo');
  world.collectDeliveries(order.timer.startedAt + order.timer.durationMs);
}

function deliverAndInstall(world: World, item: OrderItem): void {
  deliverItem(world, item);
  if (!world.installItem(item)) throw new Error(`Không lắp được ${JSON.stringify(item)}`);
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

describe('World.orderFish', () => {
  it('đủ xu thì trừ đúng giá, thêm đúng loài và cấp id tăng dần', () => {
    const { world, content } = setup({ startingCoins: 1_000 });
    const guppy = content.fish.species.find((species) => species.id === 'guppy');
    const neon = content.fish.species.find((species) => species.id === 'neon');
    if (!guppy || !neon) throw new Error('Thiếu dữ liệu cá kiểm thử');

    expect(world.orderFish(guppy.id, 1_000)).toBe(true);
    expect(world.orderFish(neon.id, 1_000)).toBe(true);
    expect(world.wallet.get('coins')).toBe(1_000 - guppy.price - neon.price);
    expect(world.orders).toEqual([
      {
        id: 1,
        speciesId: guppy.id,
        timer: { startedAt: 1_000, durationMs: guppy.deliverySeconds * 1_000 },
        notified: false,
      },
      {
        id: 2,
        speciesId: neon.id,
        timer: { startedAt: 1_000, durationMs: neon.deliverySeconds * 1_000 },
        notified: false,
      },
    ]);
  });

  it('không đủ xu thì không đổi ví hay đơn và phát toast', () => {
    const { world, content, toasts } = setup({ startingCoins: 0 });
    const species = content.fish.species[0];
    if (!species) throw new Error('Thiếu dữ liệu cá kiểm thử');
    const coins = world.wallet.get('coins');

    expect(world.orderFish(species.id, 1_000)).toBe(false);
    expect(world.wallet.get('coins')).toBe(coins);
    expect(world.orders).toEqual([]);
    expect(toasts).toContain('toast.notEnoughCoins');
  });

  it('loài không tồn tại thì trả false và không đổi ví hay đơn', () => {
    const { world } = setup({ startingCoins: 1_000 });
    const coins = world.wallet.get('coins');

    expect(world.orderFish('missing-species', 1_000)).toBe(false);
    expect(world.wallet.get('coins')).toBe(coins);
    expect(world.orders).toEqual([]);
  });
});

describe('World — giao hàng và Kho', () => {
  it('đơn chưa tới thì collectDeliveries trả 0 và giữ nguyên đơn', () => {
    const { world, content } = setup({ startingCoins: 1_000 });
    const species = content.fish.species[0];
    if (!species) throw new Error('Thiếu dữ liệu cá kiểm thử');
    world.orderFish(species.id, 1_000);

    expect(world.collectDeliveries(1_000 + species.deliverySeconds * 1_000 - 1)).toBe(0);
    expect(world.orders).toHaveLength(1);
    expect(world.inventory).toEqual([]);
  });

  it('mỗi đơn tới nơi chỉ phát thông báo một lần', () => {
    const { world, content, toasts } = setup({ startingCoins: 1_000 });
    const species = content.fish.species[0];
    if (!species) throw new Error('Thiếu dữ liệu cá kiểm thử');
    const arrivedAt = 1_000 + species.deliverySeconds * 1_000;
    world.orderFish(species.id, 1_000);

    world.checkDeliveries(arrivedAt - 1);
    world.checkDeliveries(arrivedAt);
    world.checkDeliveries(arrivedAt + 60_000);

    expect(toasts.filter((key) => key === 'toast.deliveryArrived')).toHaveLength(1);
  });

  it('nhận hàng vào Kho đúng số lượng và xoá các đơn đã tới', () => {
    const { world, content, toasts } = setup({ startingCoins: 1_000 });
    const species = content.fish.species[0];
    if (!species) throw new Error('Thiếu dữ liệu cá kiểm thử');
    world.orderFish(species.id, 1_000);
    world.orderFish(species.id, 2_000);

    expect(world.collectDeliveries(2_000 + species.deliverySeconds * 1_000)).toBe(2);
    expect(world.inventory).toEqual([{ speciesId: species.id, count: 2 }]);
    expect(world.orders).toEqual([]);
    expect(toasts.filter((key) => key === 'toast.collected')).toHaveLength(1);
  });

  it('thả cá trừ Kho, thêm cá con tại robot; loài không có trong Kho trả false', () => {
    const { world, content } = setup({ startingCoins: 1_000, startingFish: [] });
    const species = content.fish.species[0];
    if (!species) throw new Error('Thiếu dữ liệu cá kiểm thử');
    world.orderFish(species.id, 1_000);
    world.collectDeliveries(1_000 + species.deliverySeconds * 1_000);
    const beforeFish = world.fish.length;

    expect(world.releaseFish(species.id)).toBe(true);
    expect(world.inventory).toEqual([]);
    expect(world.fish).toHaveLength(beforeFish + 1);
    expect(world.fish.at(-1)).toMatchObject({
      x: world.robot.x,
      y: world.robot.y,
      ageSeconds: 0,
    });
    expect(world.releaseFish(species.id)).toBe(false);
    expect(world.releaseFish('missing-species')).toBe(false);
  });

  it('khu đủ 20 cá thì không thả thêm, có toast và Kho giữ nguyên', () => {
    const { world, content, toasts } = setup({ startingCoins: 100_000, startingFish: [] });
    const species = content.fish.species[0];
    if (!species) throw new Error('Thiếu dữ liệu cá kiểm thử');
    for (let i = 0; i < 21; i++) world.orderFish(species.id, 0);
    world.collectDeliveries(species.deliverySeconds * 1_000);
    for (let i = 0; i < 20; i++) expect(world.releaseFish(species.id)).toBe(true);
    const inventoryBefore = world.inventory;

    expect(world.fish.filter((fish) => !fish.leaving)).toHaveLength(20);
    expect(world.releaseFish(species.id)).toBe(false);
    expect(toasts).toContain('toast.zoneFull');
    expect(world.inventory).toEqual(inventoryBefore);
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

  describe('xu khi rời bể', () => {
    it('cộng đúng xu, phát toast và không đổi trạng thái cá hay nước', () => {
      const { world, toasts } = setup();
      const beforeCoins = world.wallet.get('coins');
      const beforeFish = world.fish.map(({ fullness, health }) => ({ fullness, health }));
      const beforeWater = world.water;

      world.leaveTank(1_000);
      expect(world.returnToTank(21_000)).toBe(12);

      expect(world.wallet.get('coins')).toBe(beforeCoins + 12);
      expect(toasts).toContain('toast.absenceCoins');
      expect(world.fish.map(({ fullness, health }) => ({ fullness, health }))).toEqual(beforeFish);
      expect(world.water).toBe(beforeWater);
    });

    it('gọi returnToTank lần hai trả 0', () => {
      const { world } = setup();
      world.leaveTank(1_000);
      expect(world.returnToTank(21_000)).toBe(12);
      expect(world.returnToTank(41_000)).toBe(0);
    });

    it('chưa leaveTank thì returnToTank trả 0', () => {
      const { world } = setup();
      expect(world.returnToTank(21_000)).toBe(0);
    });
  });
});

describe('World — vật phẩm, nâng cấp và ngọc (P3 ST1)', () => {
  describe('đặt và giao hàng tổng quát', () => {
    it('từ chối khi thiếu xu, sai cấp hoặc trùng tuyến', () => {
      const poor = setup({ startingCoins: 40, startingFish: [] });
      const speed2: OrderItem = { kind: 'upgrade', track: 'speed', level: 2 };
      expect(poor.world.orderItem(speed2, 0)).toBe(false);
      expect(poor.world.wallet.get('coins')).toBe(40);
      expect(poor.world.orders).toHaveLength(0);

      const { world } = setup({ startingCoins: 100_000, startingFish: [] });
      expect(world.orderItem({ kind: 'upgrade', track: 'speed', level: 3 }, 0)).toBe(false);
      expect(world.orderItem(speed2, 0)).toBe(true);
      expect(world.orderItem(speed2, 1)).toBe(false);
      expect(world.orderItem({ kind: 'upgrade', track: 'speed', level: 3 }, 1)).toBe(false);
    });

    it('giao đúng thời lượng và đưa item vào Kho qua luồng nhận hàng hiện có', () => {
      const { world } = setup({ startingCoins: 100_000, startingFish: [] });
      const item: OrderItem = { kind: 'upgrade', track: 'cargo', level: 2 };
      expect(world.orderItem(item, 1_000)).toBe(true);
      const order = world.orders[0];
      if (!order) throw new Error('Thiếu đơn kiểm thử');
      expect(order.timer.durationMs).toBe(60_000);
      expect(world.collectDeliveries(60_999)).toBe(0);
      expect(world.collectDeliveries(61_000)).toBe(1);
      expect(world.items).toEqual([{ item, count: 1 }]);
    });

    it('pin/bộ sạc chặn đúng loại đang dùng hoặc đã có; sạc dự phòng không giới hạn', () => {
      const { world } = setup({ startingCoins: 100_000, startingFish: [] });
      expect(world.orderItem({ kind: 'battery', id: 'S' }, 0)).toBe(false);
      expect(world.orderItem({ kind: 'charger', id: 'basic' }, 0)).toBe(false);
      expect(world.orderItem({ kind: 'battery', id: 'M' }, 0)).toBe(true);
      expect(world.orderItem({ kind: 'battery', id: 'M' }, 0)).toBe(false);
      expect(world.orderItem({ kind: 'powerBank', id: 'small' }, 0)).toBe(true);
      expect(world.orderItem({ kind: 'powerBank', id: 'small' }, 0)).toBe(true);
    });
  });

  describe('nâng cấp robot', () => {
    it('mọi cấp khoang tăng đúng sức chứa và giữ nguyên rác', () => {
      const { world, content, trashType } = setup({ startingCoins: 100_000, startingFish: [] });
      const bottle = trashType('bottle');
      expect(world.robot.cargo.add(bottle.id, bottle.slots)).toBe(true);
      const used = world.robot.cargo.used;
      for (let level = 2; level <= 5; level++) {
        deliverAndInstall(world, { kind: 'upgrade', track: 'cargo', level });
        expect(world.robot.cargo.capacity).toBe(content.upgrades.cargo.levels[level - 1]?.capacity);
        expect(world.robot.cargo.used).toBe(used);
        expect(world.robot.cargo.contents.get(bottle.id)).toBe(1);
      }
    });

    it('mọi cấp tốc độ dùng maxSpeed của cấp hiện tại', () => {
      const { world, content } = setup({ startingCoins: 100_000, startingFish: [] });
      for (let level = 2; level <= 5; level++) {
        deliverAndInstall(world, { kind: 'upgrade', track: 'speed', level });
        world.robot.x = 512;
        world.robot.y = 512;
        world.robot.vx = 0;
        world.robot.vy = 0;
        run(world, 1, { moveX: 1, moveY: 0 });
        expect(world.robot.vx).toBeCloseTo(
          content.upgrades.speed.levels[level - 1]?.maxSpeed ?? 0,
          5,
        );
      }
    });

    it('mọi cấp máy hút dùng đúng bán kính hiện tại', () => {
      const { world, content, trashType } = setup({ startingCoins: 100_000, startingFish: [] });
      const tire = trashType('tire');
      world.robot.x = 512;
      world.robot.y = 512;
      for (let level = 2; level <= 5; level++) {
        deliverAndInstall(world, { kind: 'upgrade', track: 'vacuum', level });
        const radius = content.upgrades.vacuum.levels[level - 1]?.radius ?? 0;
        const near = world.trash.add(tire, world.robot.x + radius - 1, world.robot.y, 0, 0);
        const far = world.trash.add(tire, world.robot.x + radius + 1, world.robot.y, 0, 0);
        const nearBefore = near.x;
        const farBefore = far.x;
        expect(world.toggleVacuum()).toBe(true);
        world.update(DT, STILL);
        expect(near.x).toBeLessThan(nearBefore);
        expect(far.x).toBe(farBefore);
        expect(world.toggleVacuum()).toBe(false);
      }
    });
  });

  describe('pin, bộ sạc và sạc theo giờ thực', () => {
    it('đổi pin giữ điện tuyệt đối và cắt theo dung lượng mới', () => {
      const { world } = setup({ startingCoins: 100_000, startingFish: [] });
      world.robot.battery.drain(60);
      deliverAndInstall(world, { kind: 'battery', id: 'M' });
      expect(world.robot.battery.capacity).toBe(150);
      expect(world.robot.battery.charge).toBe(40);

      world.robot.battery.recharge(1_000);
      deliverAndInstall(world, { kind: 'battery', id: 'S' });
      expect(world.robot.battery.capacity).toBe(100);
      expect(world.robot.battery.charge).toBe(100);
    });

    it('bộ sạc đã lắp đổi tốc độ sạc tại trạm', () => {
      const { world } = setup({ startingCoins: 100_000, startingFish: [] });
      deliverAndInstall(world, { kind: 'charger', id: 'fast' });
      world.robot.battery.drain(100);
      dock(world);
      world.update(1, STILL);
      expect(world.robot.battery.charge).toBeCloseTo(40, 5);
    });

    it('catchUpCharging lần đầu chỉ ghi mốc, sau đó bù khi đậu và không bù khi rời trạm', () => {
      const docked = setup({ startingFish: [] }).world;
      docked.robot.battery.drain(100);
      dock(docked);
      docked.update(DT, STILL);
      const before = docked.robot.battery.charge;
      docked.catchUpCharging(1_000);
      expect(docked.robot.battery.charge).toBe(before);
      docked.catchUpCharging(3_000);
      expect(docked.robot.battery.charge).toBeCloseTo(before + 50, 5);

      const away = setup({ startingFish: [] }).world;
      away.robot.battery.drain(100);
      moveAway(away);
      const awayBefore = away.robot.battery.charge;
      away.catchUpCharging(1_000);
      away.catchUpCharging(3_000);
      expect(away.robot.battery.charge).toBe(awayBefore);
    });

    it('sạc chính vẫn bù khi vắng mặt còn trạm sạc phụ thì không chạy', () => {
      const main = setup({ startingFish: [] }).world;
      main.robot.battery.drain(100);
      dock(main);
      main.update(DT, STILL);
      main.catchUpCharging(0);
      const mainBefore = main.robot.battery.charge;
      main.leaveTank(0);
      main.returnToTank(2_000);
      expect(main.robot.battery.charge).toBeCloseTo(mainBefore + 50, 5);

      const aux = setup({ startingCoins: 100_000, startingFish: [] }).world;
      deliverItem(aux, { kind: 'device', type: 'auxCharger', level: 1 });
      expect(aux.placeDevice('auxCharger', 0)).toBe(true);
      const slot = aux.devices[0];
      if (!slot) throw new Error('Thiếu trạm sạc phụ kiểm thử');
      aux.robot.battery.drain(100);
      aux.robot.x = slot.x;
      aux.robot.y = slot.y - 23;
      aux.update(DT, STILL);
      aux.catchUpCharging(0);
      const auxBefore = aux.robot.battery.charge;
      aux.leaveTank(0);
      aux.returnToTank(2_000);
      expect(aux.robot.battery.charge).toBe(auxBefore);
    });

    it('pin đầy thì không dùng và không trừ sạc dự phòng trong Kho', () => {
      const { world } = setup({ startingCoins: 100_000, startingFish: [] });
      const item: OrderItem = { kind: 'powerBank', id: 'small' };
      deliverItem(world, item);
      expect(world.usePowerBank('small')).toBe(false);
      expect(world.items).toEqual([{ item, count: 1 }]);
      world.robot.battery.drain(10);
      expect(world.usePowerBank('small')).toBe(true);
      expect(world.robot.battery.isFull).toBe(true);
      expect(world.items).toEqual([]);
    });
  });

  describe('thiết bị trong khu', () => {
    it('không đặt vào slot đã có và giữ item thất bại trong Kho', () => {
      const { world } = setup({ startingCoins: 100_000, startingFish: [] });
      deliverItem(world, { kind: 'device', type: 'filter', level: 1 });
      deliverItem(world, { kind: 'device', type: 'feeder', level: 1 });
      expect(world.placeDevice('filter', 0)).toBe(true);
      expect(world.placeDevice('feeder', 0)).toBe(false);
      expect(world.items).toContainEqual({
        item: { kind: 'device', type: 'feeder', level: 1 },
        count: 1,
      });
      deliverItem(world, { kind: 'device', type: 'filter', level: 2 });
      expect(world.installItem({ kind: 'device', type: 'filter', level: 2 })).toBe(true);
      expect(world.devices).toContainEqual({
        type: 'filter',
        level: 2,
        slotIndex: 0,
        x: 230,
        y: 600,
      });
    });

    it('máy lọc giảm phần ô nhiễm dùng làm mục tiêu nước', () => {
      const plain = setup({ startingCoins: 100_000, startingFish: [] });
      const filtered = setup({ startingCoins: 100_000, startingFish: [] });
      deliverItem(filtered.world, { kind: 'device', type: 'filter', level: 1 });
      expect(filtered.world.placeDevice('filter', 0)).toBe(true);
      for (let i = 0; i < 10; i++) {
        plain.world.trash.add(plain.trashType('tire'), 300 + i, 400, 0, 0);
        filtered.world.trash.add(filtered.trashType('tire'), 300 + i, 400, 0, 0);
      }
      run(plain.world, 10, STILL, 60);
      run(filtered.world, 10, STILL, 60);
      expect(plain.world.water).toBe(50);
      expect(filtered.world.water).toBe(55);
    });

    it('máy cho ăn chạy theo dt × timeScale, trừ xu và thả tại máy', () => {
      const { world, content } = setup({ startingCoins: 100_000, startingFish: [] });
      deliverItem(world, { kind: 'device', type: 'feeder', level: 1 });
      expect(world.placeDevice('feeder', 0)).toBe(true);
      const before = world.wallet.get('coins');
      world.update(2, STILL, 60);
      expect(world.wallet.get('coins')).toBe(before - content.balance.food.price);
      expect(world.food.pellets).toHaveLength(content.balance.food.pellets);
      expect(world.food.pellets.every((pellet) => pellet.lane === 0)).toBe(true);
      world.wallet.spend('coins', world.wallet.get('coins'));
      world.update(2, STILL, 60);
      expect(world.food.pellets).toHaveLength(content.balance.food.pellets);
    });

    it('trạm sạc phụ sạc ở tầng đáy nhưng không bán rác', () => {
      const { world, trashType } = setup({ startingCoins: 100_000, startingFish: [] });
      deliverItem(world, { kind: 'device', type: 'auxCharger', level: 1 });
      expect(world.placeDevice('auxCharger', 0)).toBe(true);
      const slot = world.devices[0];
      if (!slot) throw new Error('Thiếu thiết bị kiểm thử');
      const bottle = trashType('bottle');
      world.robot.cargo.add(bottle.id, bottle.slots);
      world.robot.battery.drain(50);
      world.robot.x = slot.x;
      world.robot.y = slot.y - 23;
      world.update(1, STILL);
      expect(world.isCharging).toBe(true);
      expect(world.robot.battery.charge).toBeCloseTo(60, 5);
      expect(world.robot.cargo.isEmpty).toBe(false);
    });

    it('san hô hạ ngưỡng buồn nhưng giữ nguyên ngưỡng nước bẩn', () => {
      const plain = setup({ startingCoins: 100_000 });
      const coral = setup({ startingCoins: 100_000 });
      deliverItem(coral.world, { kind: 'device', type: 'coral', level: 1 });
      expect(coral.world.placeDevice('coral', 0)).toBe(true);
      for (const fixture of [plain, coral]) {
        for (let i = 0; i < 7; i++) {
          fixture.world.trash.add(fixture.trashType('tire'), 300 + i, 400, 0, 0);
        }
        for (let i = 0; i < 2; i++) {
          fixture.world.trash.add(fixture.trashType('bag'), 350 + i, 450, 0, 0);
        }
        run(fixture.world, 7, STILL, 60);
      }
      const plainFish = plain.world.fish[0];
      const coralFish = coral.world.fish[0];
      if (!plainFish || !coralFish) throw new Error('Thiếu cá kiểm thử');
      plainFish.fullness = 80;
      coralFish.fullness = 80;
      expect(plain.world.water).toBe(59);
      expect(coral.world.water).toBe(59);
      expect(plain.world.moodOf(plainFish)).toBe('sad');
      expect(coral.world.moodOf(coralFish)).toBe('happy');
      expect(coralFish.health).toBe(plainFish.health);
    });
  });

  describe('đổi và tua bằng ngọc', () => {
    it('skipCost đúng ở các biên', () => {
      const { world } = setup();
      expect([-1, 0, 1, 300, 300.1, 600].map((seconds) => world.skipCost(seconds))).toEqual([
        0, 0, 1, 1, 2, 2,
      ]);
    });

    it('thiếu ngọc thì đổi thất bại và không thay đổi ví', () => {
      const { world } = setup({ startingCoins: 10, startingPearls: 1, startingFish: [] });
      expect(world.exchangePearls(2)).toBe(false);
      expect(world.wallet.get('pearls')).toBe(1);
      expect(world.wallet.get('coins')).toBe(10);
      expect(world.exchangePearls(1)).toBe(true);
      expect(world.wallet.get('pearls')).toBe(0);
      expect(world.wallet.get('coins')).toBe(1_010);
    });

    it('tua được cả đơn giao và quá trình lớn của cá con', () => {
      const { world, content } = setup({
        startingCoins: 100_000,
        startingPearls: 10,
        startingFish: [],
      });
      const species = content.fish.species[0];
      if (!species) throw new Error('Thiếu loài cá kiểm thử');
      expect(world.orderFish(species.id, 0)).toBe(true);
      const order = world.orders[0];
      if (!order) throw new Error('Thiếu đơn cá kiểm thử');
      expect(world.skipOrder(order.id, 0)).toBe(true);
      expect(world.collectDeliveries(0)).toBe(1);
      expect(world.releaseFish(species.id)).toBe(true);
      const juvenile = world.fish[0];
      if (!juvenile) throw new Error('Thiếu cá con kiểm thử');
      expect(juvenile.isGrown).toBe(false);
      expect(world.skipFishGrowth(juvenile.id)).toBe(true);
      expect(juvenile.isGrown).toBe(true);

      const item: OrderItem = { kind: 'upgrade', track: 'speed', level: 2 };
      expect(world.orderItem(item, 0)).toBe(true);
      const itemOrder = world.orders[0];
      if (!itemOrder) throw new Error('Thiếu đơn item kiểm thử');
      expect(world.skipOrder(itemOrder.id, 0)).toBe(true);
      expect(world.collectDeliveries(0)).toBe(1);
      expect(world.items).toContainEqual({ item, count: 1 });
    });
  });
});
