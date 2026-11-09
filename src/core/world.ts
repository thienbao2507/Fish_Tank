import type { Content } from './content/loader';
import type { Balance, FishSpeciesDef, TrashTypeDef, ZoneDef } from './content/schemas';
import { Wallet, type Currency } from './economy/wallet';
import type { EventBus, GameEvents } from './events';
import { t, type StringKey } from './i18n';
import type { PlayerInput } from './input';
import type { Rng } from './rng';
import { absenceCoins } from './sim/absence';
import { DropField, type Drop } from './sim/drops';
import type { Fish, Mood } from './sim/fish';
import { FoodField } from './sim/food';
import { LANE_COUNT, nearestLane, stepLane } from './sim/lanes';
import { stepMotion, type Bounds } from './sim/movement';
import { resolveMove } from './sim/obstacles';
import { FishOrders, type FishOrder } from './sim/orders';
import { Robot } from './sim/robot';
import { School } from './sim/school';
import { TrashField } from './sim/trash';
import { stepCleanliness, waterTarget } from './sim/water';
import { createTimer, isDone } from './time/timers';

export interface WorldDeps {
  readonly content: Content;
  readonly rng: Rng;
  readonly bus: EventBus<GameEvents>;
}

export interface InventoryEntry {
  readonly speciesId: string;
  readonly count: number;
}

class WorldRobot extends Robot {
  /** Tầng nước đích: 0 Đáy, 1 Giữa, 2 Mặt. */
  lane = 0;
  /** Vị trí tầng nước liên tục khi đang chuyển tầng. */
  z = 0;
}

/**
 * Trạng thái một ván chơi và luật chơi chạy theo từng khung hình (di chuyển, hút, đổi rác, sạc).
 * Không phụ thuộc Phaser: GameScene gọi `update` mỗi khung hình rồi vẽ theo trạng thái này.
 */
export class World {
  readonly zone: ZoneDef;
  readonly wallet: Wallet;
  readonly robot: WorldRobot;
  readonly trash: TrashField;
  readonly food: FoodField;
  readonly drops: DropField;
  private readonly school: School;
  private readonly balance: Balance;
  private readonly bus: EventBus<GameEvents>;
  private readonly trashTypes: ReadonlyMap<string, TrashTypeDef>;
  private readonly speciesById: ReadonlyMap<string, FishSpeciesDef>;
  private readonly fishOrders = new FishOrders();
  private readonly inventoryCounts = new Map<string, number>();
  private readonly robotBounds: Bounds;
  private docked = false;
  private cargoFullWarned = false;
  private leftTankAt?: number;
  /** Độ sạch nước của khu, 0–100%. */
  private cleanliness: number;

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
    this.robot = new WorldRobot(
      zone.robotSpawn.x,
      zone.robotSpawn.y,
      balance.robot.batteryCapacity,
      balance.robot.cargoCapacity,
    );
    this.trash = new TrashField(zone, content.trash, rng, balance.lanes.trashFallSeconds);
    this.trash.fillInitial();
    this.food = new FoodField(zone, balance.food, rng, balance.lanes.foodFallSeconds);
    this.drops = new DropField(zone, balance.drops, balance.lanes.dropFallSeconds);
    this.school = new School(zone, balance.fish, balance.food.nutrition, rng);

    this.speciesById = new Map(content.fish.species.map((species) => [species.id, species]));
    for (const { species, count } of balance.startingFish) {
      const def = this.speciesById.get(species) as FishSpeciesDef;
      for (let i = 0; i < count; i++) this.school.add(def);
    }
    // Game mới bắt đầu với nước ở trạng thái cân bằng theo lượng rác ban đầu.
    this.cleanliness = waterTarget(this.pollution);

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

  /** Độ sạch nước hiện tại, 0–100%. */
  get water(): number {
    return this.cleanliness;
  }

  /** Tổng ô nhiễm: rác + thức ăn thừa dưới đáy (P4 thêm tảo). */
  get pollution(): number {
    return this.trash.pollution + this.food.pollution;
  }

  get fish(): readonly Fish[] {
    return this.school.fish;
  }

  get orders(): readonly FishOrder[] {
    return this.fishOrders.orders;
  }

  get inventory(): readonly InventoryEntry[] {
    return [...this.inventoryCounts]
      .filter(([, count]) => count > 0)
      .map(([speciesId, count]) => ({ speciesId, count }));
  }

  /** Mua một con cá để giao; chỉ tạo đơn sau khi đã trừ đủ giá. */
  orderFish(speciesId: string, now: number): boolean {
    const species = this.speciesById.get(speciesId);
    if (!species) return false;
    if (!this.wallet.spend('coins', species.price)) {
      this.bus.emit('toast', { key: 'toast.notEnoughCoins' });
      return false;
    }
    this.fishOrders.add(speciesId, createTimer(now, species.deliverySeconds));
    return true;
  }

  /** Báo đúng một lần cho mỗi đơn vừa tới cửa. */
  checkDeliveries(now: number): void {
    for (const order of this.orders) {
      if (order.notified || !isDone(order.timer, now)) continue;
      order.notified = true;
      const species = this.speciesById.get(order.speciesId);
      if (species) {
        this.bus.emit('toast', {
          key: 'toast.deliveryArrived',
          params: { name: t(species.name as StringKey) },
        });
      }
    }
  }

  hasArrivedDeliveries(now: number): boolean {
    return this.orders.some((order) => isDone(order.timer, now));
  }

  /** Chuyển mọi đơn đã tới cửa vào Kho và trả số món vừa nhận. */
  collectDeliveries(now: number): number {
    const arrived = this.orders.filter((order) => isDone(order.timer, now));
    for (const order of arrived) {
      this.inventoryCounts.set(
        order.speciesId,
        (this.inventoryCounts.get(order.speciesId) ?? 0) + 1,
      );
      this.fishOrders.remove(order.id);
    }
    if (arrived.length > 0) {
      this.bus.emit('toast', { key: 'toast.collected', params: { count: arrived.length } });
    }
    return arrived.length;
  }

  /** Thả một cá con từ Kho tại vị trí robot nếu khu vẫn còn chỗ. */
  releaseFish(speciesId: string): boolean {
    const count = this.inventoryCounts.get(speciesId) ?? 0;
    const species = this.speciesById.get(speciesId);
    if (count <= 0 || !species) return false;
    if (
      this.fish.filter((fish) => !fish.leaving).length >=
      (this.zone.fishCapacity as number)
    ) {
      this.bus.emit('toast', { key: 'toast.zoneFull' });
      return false;
    }
    this.inventoryCounts.set(speciesId, count - 1);
    this.school.add(species, {
      juvenile: true,
      x: this.robot.x,
      y: this.robot.y,
      lane: nearestLane(this.robot.z),
    });
    return true;
  }

  moodOf(fish: Fish): Mood {
    return this.school.moodOf(fish, this.cleanliness);
  }

  /** Ghi thời điểm bắt đầu rời bể; gọi lặp lại không làm mất mốc ban đầu. */
  leaveTank(now: number): void {
    this.leftTankAt ??= now;
  }

  /** Cộng xu vắng mặt một lần khi quay lại bể, không mô phỏng các nhu cầu dài hạn. */
  returnToTank(now: number): number {
    const leftAt = this.leftTankAt;
    if (leftAt === undefined) return 0;
    this.leftTankAt = undefined;
    const coins = absenceCoins(
      this.fish,
      (now - leftAt) / 1_000,
      this.balance.absence.maxSeconds,
      this.cleanliness,
      this.balance.fish,
    );
    if (coins > 0) {
      this.wallet.add('coins', coins);
      this.bus.emit('toast', { key: 'toast.absenceCoins', params: { coins } });
    }
    return coins;
  }

  /** Có cá ốm trong tầm chữa quanh robot không (nút Thuốc sáng/mờ theo đây). */
  canGiveMedicine(): boolean {
    return this.nearestSickFish() !== undefined;
  }

  /** Đổi tầng nước đích; trả false nếu robot đã ở biên theo hướng đó. */
  changeLane(delta: -1 | 1): boolean {
    const lane = Math.min(LANE_COUNT - 1, Math.max(0, this.robot.lane + delta));
    if (lane === this.robot.lane) return false;
    this.robot.lane = lane;
    return true;
  }

  /** Thả thức ăn tại robot; tốn xu. Không đủ xu thì báo và không thả. */
  feed(): boolean {
    if (!this.wallet.spend('coins', this.balance.food.price)) {
      this.bus.emit('toast', { key: 'toast.notEnoughCoins' });
      return false;
    }
    this.food.drop(this.robot.x, this.robot.y, nearestLane(this.robot.z));
    return true;
  }

  /** Chữa con cá ốm gần robot nhất. Không có cá ốm trong tầm thì không làm gì, không trừ xu. */
  giveMedicine(): boolean {
    const target = this.nearestSickFish();
    if (!target) return false;
    if (!this.wallet.spend('coins', this.balance.medicine.price)) {
      this.bus.emit('toast', { key: 'toast.notEnoughCoins' });
      return false;
    }
    target.health = this.balance.medicine.healTo;
    target.sickSeconds = 0;
    this.bus.emit('fish:healed', { x: target.x, y: target.y, z: nearestLane(target.z) });
    return true;
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

  /**
   * Chạy một khung hình. `dt`: giây thực (bơi, hút, rác, thức ăn, xu rơi).
   * `timeScale`: hệ số tua của đồng hồ game — nhân vào các mô phỏng dài hạn (nước, nhu cầu cá, sinh xu).
   */
  update(dt: number, input: PlayerInput, timeScale = 1): void {
    const gameDt = dt * timeScale;
    this.moveRobot(dt, input);
    this.updateStation(dt);
    this.trash.update(dt);
    this.runVacuum(dt);
    this.food.update(dt);
    this.cleanliness = stepCleanliness(
      this.cleanliness,
      this.pollution,
      this.balance.water.changePerMinute,
      gameDt,
    );
    this.updateFish(dt, gameDt);
    this.updateDrops(dt);
  }

  private updateFish(dt: number, gameDt: number): void {
    const { becameSick, startedLeaving } = this.school.update(
      dt,
      gameDt,
      this.cleanliness,
      this.food,
      this.drops,
    );
    for (const fish of becameSick) {
      this.bus.emit('toast', { key: 'toast.fishSick', params: { name: this.nameOf(fish) } });
    }
    for (const fish of startedLeaving) {
      this.bus.emit('toast', { key: 'toast.fishLeft', params: { name: this.nameOf(fish) } });
      this.bus.emit('fish:left', { speciesId: fish.species.id, x: fish.x, y: fish.y });
    }
  }

  /** Robot chạm là nhặt đủ; để quá hạn thì tự cộng một phần (spec 4.4). */
  private updateDrops(dt: number): void {
    const { robot } = this;
    const { halfWidth, halfHeight } = this.balance.robot;
    const margin = this.balance.drops.pickupMargin;
    for (const drop of this.drops.pickup(
      robot.x,
      robot.y,
      halfWidth + margin,
      halfHeight + margin,
      nearestLane(robot.z),
    )) {
      this.collectDrop(drop, false);
    }
    for (const drop of this.drops.update(dt)) {
      this.collectDrop(drop, true);
    }
  }

  /**
   * Nhặt tay: nhận đủ. Tự cộng: nhận `autoCollectRatio` giá trị; ngọc không chia đôi được
   * nên quy ra xu theo tỉ giá (1 ngọc × 1000 × 50% = 500 xu).
   */
  private collectDrop(drop: Drop, auto: boolean): void {
    const { autoCollectRatio } = this.balance.drops;
    let currency: Currency;
    let amount: number;
    if (!auto) {
      currency = drop.kind === 'coin' ? 'coins' : 'pearls';
      amount = drop.value;
    } else {
      currency = 'coins';
      const valueInCoins =
        drop.kind === 'coin' ? drop.value : drop.value * this.balance.economy.pearlValueInCoins;
      amount = Math.floor(valueInCoins * autoCollectRatio);
    }
    if (amount <= 0) return;
    this.wallet.add(currency, amount);
    this.bus.emit('drop:collected', {
      currency,
      amount,
      x: drop.x,
      y: drop.y,
      z: nearestLane(drop.z),
      auto,
    });
  }

  private nearestSickFish(): Fish | undefined {
    const { robot } = this;
    return this.school.nearestSick(
      robot.x,
      robot.y,
      this.balance.medicine.radius,
      nearestLane(robot.z),
    );
  }

  private nameOf(fish: Fish): string {
    // fish.json › name đã được loader kiểm tra là khoá có trong strings.vi.json.
    return t(fish.species.name as StringKey);
  }

  private moveRobot(dt: number, input: PlayerInput): void {
    const { robot } = this;
    robot.z = stepLane(robot.z, robot.lane, dt / this.balance.robot.laneSwitchSeconds);
    const fromX = robot.x;
    const fromY = robot.y;
    stepMotion(robot, input.moveX, input.moveY, dt, this.balance.robot, this.robotBounds);
    const { halfWidth, halfHeight } = this.balance.robot;
    const move = resolveMove(
      this.zone.obstacles ?? [],
      fromX,
      fromY,
      robot.x,
      robot.y,
      halfWidth,
      halfHeight,
    );
    robot.x = move.x;
    robot.y = move.y;
    if (move.hitX) robot.vx = 0;
    if (move.hitY) robot.vy = 0;
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
      nearestLane(robot.z) === 0 &&
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
    this.bus.emit('station:sold', {
      coins,
      x: station.x + station.width / 2,
      y: station.y,
      z: 0,
    });
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

    const { blocked } = this.trash.pull(
      robot.x,
      robot.y,
      this.balance.robot.vacuum,
      dt,
      {
        canFit: (item) => robot.cargo.canFit(item.type.slots),
        collect: (item) => robot.cargo.add(item.type.id, item.type.slots),
      },
      nearestLane(robot.z),
    );
    if (blocked && !this.cargoFullWarned) {
      this.cargoFullWarned = true;
      this.bus.emit('toast', { key: 'toast.cargoFull' });
    }
  }
}
