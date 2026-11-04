import { describe, expect, it } from 'vitest';
import { loadContent, type Content } from './content/loader';
import { rawContent } from './content/raw';
import type { TrashTypeDef, ZoneDef } from './content/schemas';
import { EventBus, type GameEvents } from './events';
import { createRng } from './rng';
import { World } from './world';

const STILL = { moveX: 0, moveY: 0 };
const DT = 1 / 60;

/** World dùng dữ liệu thật nhưng không có rác ngẫu nhiên, để test chủ động đặt rác. */
function setup() {
  const base = loadContent(rawContent);
  const startZone = base.zones.find((zone) => zone.id === base.balance.startZone) as ZoneDef;
  const zone: ZoneDef = {
    ...startZone,
    trash: { ...startZone.trash, initialCount: 0, spawnIntervalSeconds: 1e9 },
  };
  const content: Content = { ...base, zones: [zone] };
  const bus = new EventBus<GameEvents>();
  const toasts: string[] = [];
  const sold: number[] = [];
  bus.on('toast', (event) => toasts.push(event.key));
  bus.on('station:sold', (event) => sold.push(event.coins));
  const world = new World({ content, rng: createRng(1), bus });
  const trashType = (id: string) =>
    content.trash.types.find((type) => type.id === id) as TrashTypeDef;
  return { world, content, zone, toasts, sold, trashType };
}

function run(world: World, seconds: number, input = STILL): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) world.update(DT, input);
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
  it('bắt đầu ở trạm với pin đầy, khoang rỗng, 0 xu', () => {
    const { world } = setup();
    world.update(DT, STILL);
    expect(world.isDocked).toBe(true);
    expect(world.robot.battery.isFull).toBe(true);
    expect(world.robot.cargo.isEmpty).toBe(true);
    expect(world.wallet.get('coins')).toBe(0);
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
    world.trash.add(trashType('can'), world.robot.x + 15, world.robot.y);
    world.toggleVacuum();
    run(world, 1);
    expect(world.trash.items).toHaveLength(0);
    expect(world.robot.cargo.contents.get('can')).toBe(1);
  });

  it('máy hút tắt thì không hút rác', () => {
    const { world, trashType } = setup();
    moveAway(world);
    world.trash.add(trashType('can'), world.robot.x + 15, world.robot.y);
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

    dock(world);
    world.update(DT, STILL);
    expect(world.wallet.get('coins')).toBe(expected);
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
    world.trash.add(can, world.robot.x + 15, world.robot.y);
    world.toggleVacuum();
    run(world, 2);
    expect(world.trash.items).toHaveLength(1);
    expect(toasts.filter((key) => key === 'toast.cargoFull')).toHaveLength(1);
  });

  it('robot không ra khỏi nước và không xuyên thành bể', () => {
    const { world, zone, content } = setup();
    const { halfWidth, halfHeight } = content.balance.robot;
    run(world, 10, { moveX: 0, moveY: -1 });
    expect(world.robot.y).toBe(zone.surfaceY + halfHeight);
    run(world, 30, { moveX: 1, moveY: 0 });
    expect(world.robot.x).toBe(zone.width - zone.wallWidth - halfWidth);
    expect(world.robot.facingX).toBe(1);
    run(world, 30, { moveX: -1, moveY: 0 });
    expect(world.robot.facingX).toBe(-1);
  });
});
