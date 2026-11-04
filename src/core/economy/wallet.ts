export type Currency = 'coins' | 'pearls';

function assertAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`Số tiền không hợp lệ: ${amount}`);
  }
}

/** Ví của người chơi: xu và ngọc trai, luôn là số nguyên không âm. */
export class Wallet {
  private readonly balances: Record<Currency, number>;

  constructor(initial: Partial<Record<Currency, number>> = {}) {
    const coins = initial.coins ?? 0;
    const pearls = initial.pearls ?? 0;
    assertAmount(coins);
    assertAmount(pearls);
    this.balances = { coins, pearls };
  }

  get(currency: Currency): number {
    return this.balances[currency];
  }

  add(currency: Currency, amount: number): void {
    assertAmount(amount);
    this.balances[currency] += amount;
  }

  /** Trừ tiền; không đủ thì trả về false và không trừ gì. */
  spend(currency: Currency, amount: number): boolean {
    assertAmount(amount);
    if (this.balances[currency] < amount) return false;
    this.balances[currency] -= amount;
    return true;
  }
}
