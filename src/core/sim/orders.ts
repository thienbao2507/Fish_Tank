import type { Timer } from '../time/timers';

export interface FishOrder {
  readonly id: number;
  readonly speciesId: string;
  readonly timer: Timer;
  notified: boolean;
}

/** Danh sách đơn cá đang giao trong một ván chơi. */
export class FishOrders {
  private readonly pending: FishOrder[] = [];
  private nextId = 1;

  get orders(): readonly FishOrder[] {
    return this.pending;
  }

  add(speciesId: string, timer: Timer): FishOrder {
    const order: FishOrder = { id: this.nextId, speciesId, timer, notified: false };
    this.nextId += 1;
    this.pending.push(order);
    return order;
  }

  remove(id: number): boolean {
    const index = this.pending.findIndex((order) => order.id === id);
    if (index < 0) return false;
    this.pending.splice(index, 1);
    return true;
  }
}
