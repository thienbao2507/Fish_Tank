function assertAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`Lượng pin không hợp lệ: ${amount}`);
  }
}

/** Pin của robot: luôn nằm trong [0, capacity]. */
export class Battery {
  private current: number;

  constructor(
    readonly capacity: number,
    initial: number = capacity,
  ) {
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new RangeError(`Dung lượng pin không hợp lệ: ${capacity}`);
    }
    this.current = Math.min(capacity, Math.max(0, initial));
  }

  get charge(): number {
    return this.current;
  }

  /** Tỉ lệ còn lại, 0–1. */
  get ratio(): number {
    return this.current / this.capacity;
  }

  get isEmpty(): boolean {
    return this.current <= 0;
  }

  get isFull(): boolean {
    return this.current >= this.capacity;
  }

  drain(amount: number): void {
    assertAmount(amount);
    this.current = Math.max(0, this.current - amount);
  }

  recharge(amount: number): void {
    assertAmount(amount);
    this.current = Math.min(this.capacity, this.current + amount);
  }
}
