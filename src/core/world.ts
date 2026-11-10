import type { Content } from './content/loader';
import type {
  Balance,
  BatteryId,
  ChargerId,
  DeviceType,
  FishRules,
  FishSpeciesDef,
  PowerBankId,
  TrashTypeDef,
  UpgradeTrack,
  Upgrades,
  ZoneDef,
} from './content/schemas';
import { Wallet, type Currency } from './economy/wallet';
import type { EventBus, GameEvents } from './events';
import { t, type StringKey } from './i18n';
import type { PlayerInput } from './input';
import type { Rng } from './rng';
import { absenceCoins } from './sim/absence';
import { Battery } from './sim/battery';
import { Cargo } from './sim/cargo';
import { DropField, type Drop } from './sim/drops';
import type { Fish, Mood } from './sim/fish';
import { FoodField } from './sim/food';
import { itemKey, itemOffer, sameItem, type OrderItem } from './sim/items';
import { LANE_COUNT, nearestLane } from './sim/lanes';
import { stepMotion, type Bounds } from './sim/movement';
import { resolveMove } from './sim/obstacles';
import { FishOrders, isFishOrder, type DeliveryOrder, type ItemOrder } from './sim/orders';
import { Robot } from './sim/robot';
import { School } from './sim/school';
import { TrashField } from './sim/trash';
import { stepCleanliness, waterTarget } from './sim/water';
import { createTimer, isDone, remainingSeconds } from './time/timers';

export type { OrderItem } from './sim/items';

export interface WorldDeps {
  readonly content: Content;
  readonly rng: Rng;
  readonly bus: EventBus<GameEvents>;
}

export interface InventoryEntry {
  readonly speciesId: string;
  readonly count: number;
}

export interface ItemInventoryEntry {
  readonly item: OrderItem;
  readonly count: number;
}

export interface PlacedDevice {
  readonly type: DeviceType;
  readonly level: number;
  readonly slotIndex: number;
  readonly x: number;
  readonly y: number;
}

interface DeviceState {
  type: DeviceType;
  level: number;
  slotIndex: number;
}

class WorldRobot extends Robot {
  /** Tầng nước gần nhất: 0 Đáy, 1 Giữa, 2 Mặt. */
  lane = 0;
  /** Độ sâu liên tục từ đáy (0) tới mặt nước (2). */
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
  private readonly upgrades: Upgrades;
  private readonly fishRules: FishRules;
  private readonly bus: EventBus<GameEvents>;
  private readonly trashTypes: ReadonlyMap<string, TrashTypeDef>;
  private readonly speciesById: ReadonlyMap<string, FishSpeciesDef>;
  private readonly fishOrders = new FishOrders();
  private readonly inventoryCounts = new Map<string, number>();
  private readonly itemCounts = new Map<string, { item: OrderItem; count: number }>();
  private readonly placedDevices: DeviceState[] = [];
  private readonly upgradeLevels: Record<UpgradeTrack, number> = {
    cargo: 1,
    speed: 1,
    vacuum: 1,
  };
  private batteryId: BatteryId = 'S';
  private chargerId: ChargerId = 'basic';
  private readonly robotBounds: Bounds;
  private docked = false;
  private cargoFullWarned = false;
  private leftTankAt?: number;
  private lastChargingAt?: number;
  private chargingRate = 0;
  private feederElapsed = 0;
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
    this.upgrades = content.upgrades;
    this.fishRules = { ...balance.fish };
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
    this.school = new School(zone, this.fishRules, balance.food.nutrition, rng);

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
    return this.chargingRate > 0 && !this.robot.battery.isFull;
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

  get orders(): readonly DeliveryOrder[] {
    return this.fishOrders.orders;
  }

  get inventory(): readonly InventoryEntry[] {
    return [...this.inventoryCounts]
      .filter(([, count]) => count > 0)
      .map(([speciesId, count]) => ({ speciesId, count }));
  }

  get items(): readonly ItemInventoryEntry[] {
    return [...this.itemCounts.values()]
      .filter(({ count }) => count > 0)
      .map(({ item, count }) => ({ item, count }));
  }

  get devices(): readonly PlacedDevice[] {
    const slots = this.zone.deviceSlots ?? [];
    return this.placedDevices.map(({ type, level, slotIndex }) => {
      const slot = slots[slotIndex] as { x: number; y: number };
      return { type, level, slotIndex, x: slot.x, y: slot.y };
    });
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

  /** Kiểm tra quy tắc tuyến/cấp mà không thay đổi ví hay tạo đơn. */
  canOrderItem(item: OrderItem): boolean {
    if (!itemOffer(this.upgrades, item)) return false;
    const pendingItems = this.orders.filter((order): order is ItemOrder => !isFishOrder(order));
    const stockedItems = this.items.filter(({ count }) => count > 0);
    switch (item.kind) {
      case 'upgrade':
        return (
          item.level === this.upgradeLevels[item.track] + 1 &&
          !pendingItems.some(
            (order) => order.item.kind === 'upgrade' && order.item.track === item.track,
          ) &&
          !stockedItems.some(
            (entry) => entry.item.kind === 'upgrade' && entry.item.track === item.track,
          )
        );
      case 'device': {
        const installedLevel =
          this.placedDevices.find((device) => device.type === item.type)?.level ?? 0;
        return (
          item.level === installedLevel + 1 &&
          !pendingItems.some(
            (order) => order.item.kind === 'device' && order.item.type === item.type,
          ) &&
          !stockedItems.some(
            (entry) => entry.item.kind === 'device' && entry.item.type === item.type,
          )
        );
      }
      case 'battery':
        return (
          item.id !== this.batteryId &&
          !pendingItems.some((order) => sameItem(order.item, item)) &&
          !stockedItems.some((entry) => sameItem(entry.item, item))
        );
      case 'charger':
        return (
          item.id !== this.chargerId &&
          !pendingItems.some((order) => sameItem(order.item, item)) &&
          !stockedItems.some((entry) => sameItem(entry.item, item))
        );
      case 'powerBank':
        return true;
    }
  }

  /** Đặt một món hàng tổng quát; chỉ tạo đơn sau khi đã trừ đủ xu. */
  orderItem(item: OrderItem, now: number): boolean {
    const offer = itemOffer(this.upgrades, item);
    if (!offer || !this.canOrderItem(item)) return false;
    if (!this.wallet.spend('coins', offer.price)) {
      this.bus.emit('toast', { key: 'toast.notEnoughCoins' });
      return false;
    }
    this.fishOrders.addItem(item, createTimer(now, offer.deliverySeconds));
    return true;
  }

  /** Báo đúng một lần cho mỗi đơn vừa tới cửa. */
  checkDeliveries(now: number): void {
    for (const order of this.orders) {
      if (order.notified || !isDone(order.timer, now)) continue;
      order.notified = true;
      const name = isFishOrder(order)
        ? this.speciesById.get(order.speciesId)?.name
        : itemOffer(this.upgrades, order.item)?.name;
      if (name) {
        this.bus.emit('toast', {
          key: 'toast.deliveryArrived',
          params: { name: t(name as StringKey) },
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
      if (isFishOrder(order)) {
        this.inventoryCounts.set(
          order.speciesId,
          (this.inventoryCounts.get(order.speciesId) ?? 0) + 1,
        );
      } else {
        this.addItemToInventory(order.item);
      }
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
    if (this.fish.filter((fish) => !fish.leaving).length >= (this.zone.fishCapacity as number)) {
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

  /** Lắp linh kiện trong Kho và áp dụng ngay; thiết bị Lv1 phải đi qua placeDevice. */
  installItem(item: OrderItem): boolean {
    if (this.itemCount(item) <= 0) return false;
    switch (item.kind) {
      case 'upgrade': {
        if (item.level !== this.upgradeLevels[item.track] + 1) return false;
        if (item.track === 'cargo') {
          const level = this.upgrades.cargo.levels[item.level - 1];
          if (!level) return false;
          const cargo = new Cargo(level.capacity);
          for (const [typeId, count] of this.robot.cargo.contents) {
            const slots = this.trashTypes.get(typeId)?.slots;
            if (!slots) continue;
            for (let i = 0; i < count; i++) cargo.add(typeId, slots);
          }
          this.robot.cargo = cargo;
        } else if (item.track === 'speed') {
          if (!this.upgrades.speed.levels[item.level - 1]) return false;
        } else if (!this.upgrades.vacuum.levels[item.level - 1]) {
          return false;
        }
        this.upgradeLevels[item.track] = item.level;
        this.removeItemFromInventory(item);
        return true;
      }
      case 'battery': {
        if (item.id === this.batteryId) return false;
        const battery = this.upgrades.batteries.find((candidate) => candidate.id === item.id);
        if (!battery) return false;
        this.robot.battery = new Battery(battery.capacity, this.robot.battery.charge);
        this.batteryId = item.id;
        this.removeItemFromInventory(item);
        return true;
      }
      case 'charger': {
        if (item.id === this.chargerId) return false;
        if (!this.upgrades.chargers.some((candidate) => candidate.id === item.id)) return false;
        this.chargerId = item.id;
        this.removeItemFromInventory(item);
        return true;
      }
      case 'device': {
        if (item.level <= 1) return false;
        const device = this.placedDevices.find((candidate) => candidate.type === item.type);
        if (!device || item.level !== device.level + 1) return false;
        if (!this.upgrades.devices[item.type].levels[item.level - 1]) return false;
        device.level = item.level;
        this.removeItemFromInventory(item);
        this.applyDeviceRules(item.type);
        return true;
      }
      case 'powerBank':
        return false;
    }
  }

  /** Đặt thiết bị Lv1 từ Kho vào một slot trống; mỗi loại chỉ có một chiếc trong khu. */
  placeDevice(type: DeviceType, slotIndex: number): boolean {
    const item: OrderItem = { kind: 'device', type, level: 1 };
    const slots = this.zone.deviceSlots ?? [];
    if (
      this.itemCount(item) <= 0 ||
      !Number.isInteger(slotIndex) ||
      !slots[slotIndex] ||
      this.placedDevices.some((device) => device.slotIndex === slotIndex || device.type === type)
    ) {
      return false;
    }
    this.placedDevices.push({ type, level: 1, slotIndex });
    this.removeItemFromInventory(item);
    this.applyDeviceRules(type);
    return true;
  }

  /**
   * Bù phần sạc đã trôi theo đồng hồ thực giữa hai lần gọi.
   * Khoảng cách tối đa một giây đã được `update` xử lý nên không cộng lần hai.
   */
  catchUpCharging(now: number): void {
    const previous = this.lastChargingAt;
    this.lastChargingAt = now;
    if (previous === undefined) return;
    const elapsed = (now - previous) / 1_000;
    const charger = this.upgrades.chargers.find((item) => item.id === this.chargerId);
    const rate =
      this.leftTankAt === undefined
        ? this.chargingRate
        : this.docked
          ? (charger?.chargePerSecond ?? 0)
          : 0;
    if (!Number.isFinite(elapsed) || elapsed <= 1 || rate <= 0) return;
    this.robot.battery.recharge(rate * elapsed);
  }

  /** Dùng một sạc dự phòng trong Kho; pin đầy thì giữ nguyên vật phẩm. */
  usePowerBank(id: PowerBankId): boolean {
    const item: OrderItem = { kind: 'powerBank', id };
    const powerBank = this.upgrades.powerBanks.find((candidate) => candidate.id === id);
    if (!powerBank || this.itemCount(item) <= 0 || this.robot.battery.isFull) return false;
    this.robot.battery.recharge(powerBank.charge);
    this.removeItemFromInventory(item);
    return true;
  }

  /** Đổi một chiều ngọc trai sang xu. */
  exchangePearls(count: number): boolean {
    if (!Number.isInteger(count) || count <= 0 || !this.wallet.spend('pearls', count)) {
      return false;
    }
    this.wallet.add('coins', count * this.balance.economy.pearlValueInCoins);
    return true;
  }

  skipCost(seconds: number): number {
    if (seconds <= 0) return 0;
    return Math.max(1, Math.ceil(seconds / this.balance.economy.skipSecondsPerPearl));
  }

  /** Trừ ngọc rồi đưa bộ đếm của đơn về trạng thái hoàn tất; hàng vẫn nhận qua cửa như cũ. */
  skipOrder(orderId: number, now: number): boolean {
    const order = this.orders.find((candidate) => candidate.id === orderId);
    if (!order) return false;
    const cost = this.skipCost(remainingSeconds(order.timer, now));
    if (!this.wallet.spend('pearls', cost)) return false;
    return this.fishOrders.complete(order.id, createTimer(now, 0));
  }

  /** Trừ ngọc theo thời gian lớn còn lại và cho cá con trưởng thành ngay. */
  skipFishGrowth(fishId: number): boolean {
    const fish = this.fish.find((candidate) => candidate.id === fishId);
    if (!fish || fish.leaving || fish.isGrown) return false;
    const cost = this.skipCost(fish.species.growSeconds - fish.ageSeconds);
    if (!this.wallet.spend('pearls', cost)) return false;
    fish.ageSeconds = fish.species.growSeconds;
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
    this.catchUpCharging(now);
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

  /**
   * Ngủ qua đêm: tua `realSeconds` giây cho đơn đang giao và cá con chưa lớn,
   * dời mốc rời bể lùi lại để xu vắng mặt tính thêm khoảng đó. Cá và nước giữ nguyên.
   */
  sleep(realSeconds: number): void {
    if (realSeconds <= 0) return;
    this.fishOrders.advanceAll(realSeconds);
    for (const fish of this.fish) {
      if (fish.leaving || fish.isGrown) continue;
      fish.ageSeconds = Math.min(fish.species.growSeconds, fish.ageSeconds + realSeconds);
    }
    if (this.leftTankAt !== undefined) this.leftTankAt -= realSeconds * 1_000;
  }

  /** Có cá ốm trong tầm chữa quanh robot không (nút Thuốc sáng/mờ theo đây). */
  canGiveMedicine(): boolean {
    return this.nearestSickFish() !== undefined;
  }

  /** Thả thức ăn tại robot; tốn xu. Không đủ xu thì báo và không thả. */
  feed(): boolean {
    if (!this.wallet.spend('coins', this.balance.food.price)) {
      this.bus.emit('toast', { key: 'toast.notEnoughCoins' });
      return false;
    }
    this.food.drop(this.robot.x, this.robot.y, this.robot.z);
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
    this.updateAutomaticFeeder(gameDt);
    this.food.update(dt);
    this.cleanliness = stepCleanliness(
      this.cleanliness,
      this.filteredPollution(),
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
      robot.z,
      this.balance.robot.depthReach,
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
      robot.z,
      this.balance.robot.depthReach,
    );
  }

  private nameOf(fish: Fish): string {
    // fish.json › name đã được loader kiểm tra là khoá có trong strings.vi.json.
    return t(fish.species.name as StringKey);
  }

  private moveRobot(dt: number, input: PlayerInput): void {
    const { robot } = this;
    const dive = input.dive ?? 0;
    robot.z = Math.min(
      LANE_COUNT - 1,
      Math.max(0, robot.z + (dive * (LANE_COUNT - 1) * dt) / this.balance.robot.diveSeconds),
    );
    robot.lane = nearestLane(robot.z);
    const fromX = robot.x;
    const fromY = robot.y;
    const speedLevel = this.upgrades.speed.levels[this.upgradeLevels.speed - 1];
    stepMotion(
      robot,
      input.moveX,
      input.moveY,
      dt,
      { ...this.balance.robot, maxSpeed: speedLevel?.maxSpeed ?? this.balance.robot.maxSpeed },
      this.robotBounds,
    );
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
      robot.z <= this.balance.station.dockMaxZ &&
      robot.x >= station.x &&
      robot.x <= station.x + station.width &&
      robot.y >= station.y &&
      robot.y <= station.y + station.height;
    if (this.docked && !robot.cargo.isEmpty) {
      this.sellCargo();
    }

    const charger = this.upgrades.chargers.find((item) => item.id === this.chargerId);
    const mainRate = this.docked ? (charger?.chargePerSecond ?? 0) : 0;
    const aux = this.deviceState('auxCharger');
    const auxSlot = aux && (this.zone.deviceSlots ?? [])[aux.slotIndex];
    const auxLevel = aux && this.upgrades.devices.auxCharger.levels[aux.level - 1];
    const inAuxRange =
      robot.z <= this.balance.station.dockMaxZ &&
      auxSlot !== undefined &&
      Math.hypot(robot.x - auxSlot.x, robot.y - auxSlot.y) <= this.balance.devices.auxChargerRadius;
    const auxRate = inAuxRange ? (auxLevel?.chargePerSecond ?? 0) : 0;
    this.chargingRate = Math.max(mainRate, auxRate);
    robot.battery.recharge(this.chargingRate * dt);
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

    const vacuumLevel = this.upgrades.vacuum.levels[this.upgradeLevels.vacuum - 1];
    const { blocked } = this.trash.pull(
      robot.x,
      robot.y,
      {
        ...this.balance.robot.vacuum,
        radius: vacuumLevel?.radius ?? this.balance.robot.vacuum.radius,
        pullSpeed: vacuumLevel?.pullSpeed ?? this.balance.robot.vacuum.pullSpeed,
      },
      dt,
      {
        canFit: (item) => robot.cargo.canFit(item.type.slots),
        collect: (item) => robot.cargo.add(item.type.id, item.type.slots),
      },
      robot.z,
      this.balance.robot.depthReach,
    );
    if (blocked && !this.cargoFullWarned) {
      this.cargoFullWarned = true;
      this.bus.emit('toast', { key: 'toast.cargoFull' });
    }
  }

  private itemCount(item: OrderItem): number {
    return this.itemCounts.get(itemKey(item))?.count ?? 0;
  }

  private addItemToInventory(item: OrderItem): void {
    const key = itemKey(item);
    const current = this.itemCounts.get(key);
    if (current) {
      current.count += 1;
    } else {
      this.itemCounts.set(key, { item, count: 1 });
    }
  }

  private removeItemFromInventory(item: OrderItem): void {
    const key = itemKey(item);
    const current = this.itemCounts.get(key);
    if (!current) return;
    current.count -= 1;
    if (current.count <= 0) this.itemCounts.delete(key);
  }

  private deviceState(type: DeviceType): DeviceState | undefined {
    return this.placedDevices.find((device) => device.type === type);
  }

  private filteredPollution(): number {
    const filter = this.deviceState('filter');
    const level = filter && this.upgrades.devices.filter.levels[filter.level - 1];
    return this.pollution * (1 - (level?.pollutionReduction ?? 0));
  }

  private updateAutomaticFeeder(gameDt: number): void {
    const feeder = this.deviceState('feeder');
    if (!feeder) return;
    const level = this.upgrades.devices.feeder.levels[feeder.level - 1];
    const slot = (this.zone.deviceSlots ?? [])[feeder.slotIndex];
    if (!level || !slot) return;
    this.feederElapsed += gameDt;
    while (this.feederElapsed >= level.intervalSeconds) {
      this.feederElapsed -= level.intervalSeconds;
      if (this.wallet.spend('coins', this.balance.food.price)) {
        this.food.drop(slot.x, slot.y, 0);
      }
    }
  }

  private applyDeviceRules(type: DeviceType): void {
    if (type !== 'coral') return;
    const coral = this.deviceState('coral');
    const level = coral && this.upgrades.devices.coral.levels[coral.level - 1];
    this.fishRules.sadWaterBelow = Math.max(
      0,
      this.balance.fish.sadWaterBelow - (level?.sadWaterDrop ?? 0),
    );
  }
}
