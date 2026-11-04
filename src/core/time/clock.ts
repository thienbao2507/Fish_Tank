/** Nguồn thời gian của game (ms, dạng epoch). Mọi bộ đếm và mô phỏng đọc thời gian qua đây. */
export interface Clock {
  now(): number;
}

/**
 * Đồng hồ chạy theo giờ thực, có hệ số tua (debug).
 * Đổi hệ số không làm thời gian nhảy: thời điểm hiện tại được giữ làm mốc mới.
 */
export class ScaledClock implements Clock {
  private baseReal: number;
  private baseVirtual: number;
  private currentScale = 1;

  constructor(private readonly realNow: () => number) {
    this.baseReal = realNow();
    this.baseVirtual = this.baseReal;
  }

  get scale(): number {
    return this.currentScale;
  }

  now(): number {
    return this.baseVirtual + (this.realNow() - this.baseReal) * this.currentScale;
  }

  setScale(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new RangeError(`Hệ số thời gian không hợp lệ: ${scale}`);
    }
    const virtualNow = this.now();
    this.baseReal = this.realNow();
    this.baseVirtual = virtualNow;
    this.currentScale = scale;
  }
}
