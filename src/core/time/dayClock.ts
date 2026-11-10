import type { Balance } from '../content/schemas';

export type DayPhase = 'morning' | 'noon' | 'afternoon' | 'night';

export type DayBalance = Balance['day'];

const MINUTES_PER_DAY = 1440;

/**
 * Đồng hồ giờ trong ngày của căn phòng, chạy theo thời gian của `Clock` (ms).
 * Chỉ giữ mốc bắt đầu và độ lệch do ngủ; không tự đọc `Date.now()`.
 */
export class DayClock {
  /** Tổng thời gian (ms) đã được cộng thêm do ngủ. */
  private shiftMs = 0;

  constructor(
    private readonly balance: DayBalance,
    private readonly startRealMs: number,
  ) {}

  /** Số phút game trôi qua trong một ms thời gian. */
  private get minutesPerMs(): number {
    return MINUTES_PER_DAY / (this.balance.realSecondsPerDay * 1_000);
  }

  /** Giờ trong ngày, tính bằng phút: 0 đến 1439.99. */
  minuteOfDay(now: number): number {
    const elapsed = now - this.startRealMs + this.shiftMs;
    const minute = (this.balance.startMinute + elapsed * this.minutesPerMs) % MINUTES_PER_DAY;
    return minute < 0 ? minute + MINUTES_PER_DAY : minute;
  }

  phaseAt(now: number): DayPhase {
    return phaseOfMinute(this.balance, this.minuteOfDay(now));
  }

  /** Ngủ được từ giờ tối tới trước giờ sáng. */
  canSleep(now: number): boolean {
    return this.phaseAt(now) === 'night';
  }

  /**
   * Ngủ tới giờ sáng kế tiếp: dời đồng hồ để ngay sau đó là `morningFrom`.
   * Trả số giây thực bị bỏ qua (đã cắt trần), hoặc `null` nếu đang ban ngày.
   */
  sleep(now: number): { realSecondsSkipped: number } | null {
    if (!this.canSleep(now)) return null;
    const minute = this.minuteOfDay(now);
    const wake = this.balance.morningFrom;
    const minutesToWake = (wake - minute + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    this.shiftMs += minutesToWake / this.minutesPerMs;
    const realSeconds = (minutesToWake * this.balance.realSecondsPerDay) / MINUTES_PER_DAY;
    return { realSecondsSkipped: Math.min(realSeconds, this.balance.maxSleepRealSeconds) };
  }
}

export function phaseOfMinute(balance: DayBalance, minute: number): DayPhase {
  if (minute >= balance.nightFrom || minute < balance.morningFrom) return 'night';
  if (minute >= balance.afternoonFrom) return 'afternoon';
  if (minute >= balance.noonFrom) return 'noon';
  return 'morning';
}

/** Định dạng "HH:MM" từ số phút trong ngày. */
export function formatClock(minute: number): string {
  const whole = Math.floor(((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY);
  const hours = Math.floor(whole / 60);
  const mins = whole % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
