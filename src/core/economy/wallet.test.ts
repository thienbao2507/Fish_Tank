import { describe, expect, it } from 'vitest';
import { Wallet } from './wallet';

describe('Wallet', () => {
  it('mặc định 0 xu, 0 ngọc', () => {
    const wallet = new Wallet();
    expect(wallet.get('coins')).toBe(0);
    expect(wallet.get('pearls')).toBe(0);
  });

  it('cộng tiền theo đúng loại', () => {
    const wallet = new Wallet({ coins: 10 });
    wallet.add('coins', 5);
    wallet.add('pearls', 2);
    expect(wallet.get('coins')).toBe(15);
    expect(wallet.get('pearls')).toBe(2);
  });

  it('trừ tiền khi đủ', () => {
    const wallet = new Wallet({ coins: 10 });
    expect(wallet.spend('coins', 10)).toBe(true);
    expect(wallet.get('coins')).toBe(0);
  });

  it('không đủ thì không trừ và không bao giờ âm', () => {
    const wallet = new Wallet({ coins: 3 });
    expect(wallet.spend('coins', 4)).toBe(false);
    expect(wallet.get('coins')).toBe(3);
  });

  it('từ chối số tiền âm, lẻ hoặc không phải số', () => {
    const wallet = new Wallet();
    expect(() => wallet.add('coins', -1)).toThrow(RangeError);
    expect(() => wallet.add('coins', 1.5)).toThrow(RangeError);
    expect(() => wallet.spend('pearls', Number.NaN)).toThrow(RangeError);
    expect(() => new Wallet({ coins: -5 })).toThrow(RangeError);
  });
});
