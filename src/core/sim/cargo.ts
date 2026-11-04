/** Khoang chứa rác của robot, đo bằng số ô. Mỗi loại rác chiếm một số ô nhất định. */
export class Cargo {
  private readonly counts = new Map<string, number>();
  private usedSlots = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(`Sức chứa không hợp lệ: ${capacity}`);
    }
  }

  get used(): number {
    return this.usedSlots;
  }

  get free(): number {
    return this.capacity - this.usedSlots;
  }

  get isEmpty(): boolean {
    return this.usedSlots === 0;
  }

  /** Số lượng từng loại rác đang chứa. */
  get contents(): ReadonlyMap<string, number> {
    return this.counts;
  }

  canFit(slots: number): boolean {
    return slots <= this.free;
  }

  /** Thêm một món rác; trả về false (không đổi gì) nếu không đủ chỗ. */
  add(typeId: string, slots: number): boolean {
    if (!Number.isInteger(slots) || slots <= 0) {
      throw new RangeError(`Số ô không hợp lệ: ${slots}`);
    }
    if (!this.canFit(slots)) return false;
    this.counts.set(typeId, (this.counts.get(typeId) ?? 0) + 1);
    this.usedSlots += slots;
    return true;
  }

  /** Lấy hết rác ra (khi về trạm); trả về số lượng từng loại. */
  unload(): Map<string, number> {
    const unloaded = new Map(this.counts);
    this.counts.clear();
    this.usedSlots = 0;
    return unloaded;
  }
}
