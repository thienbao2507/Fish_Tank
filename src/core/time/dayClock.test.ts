import { describe, expect, it } from 'vitest';
import { loadContent } from '../content/loader';
import { rawContent } from '../content/raw';
import { ScaledClock } from './clock';
import { DayClock, formatClock } from './dayClock';

const day = loadContent(rawContent).balance.day;
const START = 1_000_000;
/** 1 phút game = 1 giây thực với balance hiện tại. */
const MIN = (day.realSecondsPerDay * 1_000) / 1440;

/** Đồng hồ bắt đầu lúc 00:00 để dễ đặt giờ. */
function clockAt(minute: number): { clock: DayClock; now: number } {
  const clock = new DayClock({ ...day, startMinute: minute }, START);
  return { clock, now: START };
}

describe('DayClock', () => {
  it('bắt đầu lúc 08:00', () => {
    const clock = new DayClock(day, START);
    expect(clock.minuteOfDay(START)).toBe(480);
    expect(formatClock(clock.minuteOfDay(START))).toBe('08:00');
  });

  it('qua đủ 4 buổi', () => {
    const clock = new DayClock(day, START);
    expect(clock.phaseAt(START)).toBe('morning');
    expect(clock.phaseAt(START + 4 * 60 * MIN)).toBe('noon'); // 12:00
    expect(clock.phaseAt(START + 8 * 60 * MIN)).toBe('afternoon'); // 16:00
    expect(clock.phaseAt(START + 14 * 60 * MIN)).toBe('night'); // 22:00
    expect(clock.phaseAt(START + 20 * 60 * MIN)).toBe('night'); // 04:00 hôm sau
    expect(clock.phaseAt(START + 22 * 60 * MIN)).toBe('morning'); // 06:00 hôm sau
  });

  it('ranh giới 20:00 và 06:00', () => {
    expect(clockAt(1199).clock.canSleep(START)).toBe(false);
    expect(clockAt(1200).clock.canSleep(START)).toBe(true);
    expect(clockAt(359).clock.canSleep(START)).toBe(true);
    expect(clockAt(360).clock.canSleep(START)).toBe(false);
  });

  it('ban ngày không ngủ được', () => {
    const { clock, now } = clockAt(720);
    expect(clock.sleep(now)).toBeNull();
    expect(clock.minuteOfDay(now)).toBe(720);
  });

  it('ngủ lúc 20:00 bỏ qua 600s (kẹp trần)', () => {
    expect(clockAt(1200).clock.sleep(START)?.realSecondsSkipped).toBe(600);
  });

  it('ngủ lúc 02:00 bỏ qua 240s', () => {
    expect(clockAt(120).clock.sleep(START)?.realSecondsSkipped).toBeCloseTo(240);
  });

  it('ngủ lúc 21:30 bỏ qua 510s', () => {
    expect(clockAt(1290).clock.sleep(START)?.realSecondsSkipped).toBeCloseTo(510);
  });

  it('sau khi ngủ là 06:00 và giờ tiếp tục chạy', () => {
    const { clock, now } = clockAt(1290);
    clock.sleep(now);
    expect(clock.minuteOfDay(now)).toBeCloseTo(360);
    expect(clock.phaseAt(now)).toBe('morning');
    expect(clock.minuteOfDay(now + 30 * MIN)).toBeCloseTo(390);
  });

  it('tua clock x100 thì giờ chạy nhanh tương ứng', () => {
    let real = START;
    const scaled = new ScaledClock(() => real);
    scaled.setScale(100);
    const clock = new DayClock(day, scaled.now());
    real += 600; // 0.6 giây thực x100 = 60 giây = 60 phút game
    expect(clock.minuteOfDay(scaled.now())).toBeCloseTo(480 + 60);
  });
});

describe('formatClock', () => {
  it('định dạng HH:MM', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(480)).toBe('08:00');
    expect(formatClock(1439.99)).toBe('23:59');
  });
});
