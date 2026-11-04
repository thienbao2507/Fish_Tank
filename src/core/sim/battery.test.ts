import { describe, expect, it } from 'vitest';
import { Battery } from './battery';

describe('Battery', () => {
  it('mặc định đầy', () => {
    const battery = new Battery(100);
    expect(battery.charge).toBe(100);
    expect(battery.isFull).toBe(true);
    expect(battery.ratio).toBe(1);
  });

  it('drain giảm pin và không xuống dưới 0', () => {
    const battery = new Battery(100);
    battery.drain(30);
    expect(battery.charge).toBe(70);
    battery.drain(500);
    expect(battery.charge).toBe(0);
    expect(battery.isEmpty).toBe(true);
  });

  it('recharge tăng pin và không vượt dung lượng', () => {
    const battery = new Battery(100, 10);
    battery.recharge(25);
    expect(battery.charge).toBe(35);
    battery.recharge(1000);
    expect(battery.charge).toBe(100);
  });

  it('giá trị ban đầu bị kẹp trong [0, capacity]', () => {
    expect(new Battery(50, 80).charge).toBe(50);
    expect(new Battery(50, -5).charge).toBe(0);
  });

  it('từ chối lượng âm hoặc dung lượng không hợp lệ', () => {
    const battery = new Battery(100);
    expect(() => battery.drain(-1)).toThrow(RangeError);
    expect(() => battery.recharge(Number.NaN)).toThrow(RangeError);
    expect(() => new Battery(0)).toThrow(RangeError);
  });
});
