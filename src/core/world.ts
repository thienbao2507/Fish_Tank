import type { Content } from './content/loader';
import type { Balance, TrashTypeDef, ZoneDef } from './content/schemas';
import { Wallet } from './economy/wallet';
import type { EventBus, GameEvents } from './events';
import type { PlayerInput } from './input';
import type { Rng } from './rng';
import { stepMotion, type Bounds } from './sim/movement';
import { Robot } from './sim/robot';
import { TrashField } from './sim/trash';

export interface WorldDeps {
  readonly content: Content;
  readonly rng: Rng;
  readonly bus: EventBus<GameEvents>;
}

/**
 * Trạng thái một ván chơi và luật chơi chạy theo từng khung hình (di chuyển, hút, đổi rác, sạc).
 * Không phụ thuộc Phaser: GameScene gọi `update` mỗi khung hình rồi vẽ theo trạng thái này.
 */
export class World {
  readonly zone: ZoneDef;
  readonly wallet: Wallet;
  readonly robot: Robot;
  readonly trash: TrashField;
  private readonly balance: Balance;
  private readonly bus: EventBus<GameEvents>;
  private readonly trashTypes: ReadonlyMap<string, TrashTypeDef>;
  private readonly robotBounds: Bounds;
  private docked = false;
  private cargoFullWarned = false;

  constructor({ content, rng, bus }: WorldDeps) {
    const { balance } = content;
    const zone = content.zones.find((candidate) => candidate.id === balance.startZone);
    if (!zone) {
      throw new Error(`Không có khu "${balance.startZone}"`);
    }
    this.zone = zone;
    this.balance = balance;
    this.bus = bus;
    this.trashTypes = new Map(content.trash.types.map((type) => [type.id, type]));
    this.wallet = new Wallet({ coins: balance.startingCoins, pearls: balance.startingPearls });
    this.robot = new Robot(
      zone.robotSpawn.x,
      zone.robotSpawn.y,
      balance.robot.batteryCapacity,
      balance.robot.cargoCapacity,
    );
    this.trash = new TrashField(zone, content.trash, rng);
    this.trash.fillInitial();

    const { halfWidth, halfHeight } = balance.robot;
    this.robotBounds = {
      minX: zone.wallWidth + halfWidth,
      maxX: zone.width - zone.wallWidth - halfWidth,
      minY: zone.surfaceY + halfHeight,
      maxY: zone.floorY - halfHeight,
    };
  }

  /** Robot đang đậu trong vùng trạm. */
  get isDocked(): boolean {
    return this.docked;
  }

  /** Đang sạc: đậu ở trạm và pin chưa đầy. */
  get isCharging(): boolean {
    return this.docked && !this.robot.battery.isFull;
  }

  /** Bật/tắt máy hút; hết pin thì không bật được. Trả về trạng thái sau khi bấm. */
  toggleVacuum(): boolean {
    const { robot } = this;
    if (robot.vacuumOn) {
      robot.vacuumOn = false;
      return false;
    }
    if (robot.battery.isEmpty) {
      this.bus.emit('toast', { key: 'toast.noBattery' });
      return false;
    }
    robot.vacuumOn = true;
    return true;
  }

  /** Chạy một khung hình. `dt` tính bằng giây. */
  update(dt: number, input: PlayerInput): void {
    this.moveRobot(dt, input);
    this.updateStation(dt);
    this.trash.update(dt);
    this.runVacuum(dt);
  }

  private moveRobot(dt: number, input: PlayerInput): void {
    const { robot } = this;
    stepMotion(robot, input.moveX, input.moveY, dt, this.balance.robot, this.robotBounds);
    if (input.moveX !== 0 || input.moveY !== 0) {
      robot.aimX = input.moveX;
      robot.aimY = input.moveY;
    }
    if (input.moveX !== 0) {
      robot.facingX = input.moveX > 0 ? 1 : -1;
    }
  }

  private updateStation(dt: number): void {
    const { robot } = this;
    const { station } = this.zone;
    this.docked =
      robot.x >= station.x &&
      robot.x <= station.x + station.width &&
      robot.y >= station.y &&
      robot.y <= station.y + station.height;
    if (!this.docked) return;

    if (!robot.cargo.isEmpty) {
      this.sellCargo();
    }
    robot.battery.recharge(this.balance.station.chargePerSecond * dt);
  }

  private sellCargo(): void {
    let coins = 0;
    for (const [typeId, count] of this.robot.cargo.unload()) {
      coins += (this.trashTypes.get(typeId)?.value ?? 0) * count;
    }
    this.wallet.add('coins', coins);
    this.cargoFullWarned = false;
    const { station } = this.zone;
    this.bus.emit('station:sold', { coins, x: station.x + station.width / 2, y: station.y });
  }

  private runVacuum(dt: number): void {
    const { robot } = this;
    if (!robot.vacuumOn) return;

    robot.battery.drain(this.balance.robot.vacuum.drainPerSecond * dt);
    if (robot.battery.isEmpty) {
      robot.vacuumOn = false;
      this.bus.emit('toast', { key: 'toast.batteryEmpty' });
      return;
    }

    const { blocked } = this.trash.pull(robot.x, robot.y, this.balance.robot.vacuum, dt, {
      canFit: (item) => robot.cargo.canFit(item.type.slots),
      collect: (item) => robot.cargo.add(item.type.id, item.type.slots),
    });
    if (blocked && !this.cargoFullWarned) {
      this.cargoFullWarned = true;
      this.bus.emit('toast', { key: 'toast.cargoFull' });
    }
  }
}
