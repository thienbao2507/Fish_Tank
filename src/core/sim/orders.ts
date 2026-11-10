import type { Timer } from '../time/timers';
import type { OrderItem } from './items';

export interface FishOrder {
  readonly id: number;
  readonly speciesId: string;
  readonly timer: Timer;
  notified: boolean;
}

export interface ItemOrder {
  readonly id: number;
  readonly item: OrderItem;
  /** Giữ cho code đọc `speciesId` trên mọi đơn vẫn tương thích; item order không lưu field này. */
  readonly speciesId?: never;
  readonly timer: Timer;
  notified: boolean;
}

export type DeliveryOrder = FishOrder | ItemOrder;

export function isFishOrder(order: DeliveryOrder): order is FishOrder {
  return 'speciesId' in order;
}

/** Danh sách đơn cá đang giao trong một ván chơi. */
export class FishOrders {
  private readonly pending: DeliveryOrder[] = [];
  private nextId = 1;

  get orders(): readonly DeliveryOrder[] {
    return this.pending;
  }

  add(speciesId: string, timer: Timer): FishOrder {
    const order: FishOrder = { id: this.nextId, speciesId, timer, notified: false };
    this.nextId += 1;
    this.pending.push(order);
    return order;
  }

  addItem(item: OrderItem, timer: Timer): ItemOrder {
    const order: ItemOrder = { id: this.nextId, item, timer, notified: false };
    this.nextId += 1;
    this.pending.push(order);
    return order;
  }

  complete(id: number, timer: Timer): boolean {
    const order = this.pending.find((candidate) => candidate.id === id);
    if (!order) return false;
    (order as { timer: Timer }).timer = timer;
    return true;
  }

  remove(id: number): boolean {
    const index = this.pending.findIndex((order) => order.id === id);
    if (index < 0) return false;
    this.pending.splice(index, 1);
    return true;
  }
}
