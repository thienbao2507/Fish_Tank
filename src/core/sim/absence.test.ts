import { describe, expect, it } from 'vitest';
import { absenceCoins } from './absence';
import { Fish } from './fish';
import { testRules, testSpecies } from './testFixtures';

function fish(): Fish {
  return new Fish(1, testSpecies, 100, 100, testRules.startFullness);
}

describe('absenceCoins', () => {
  it('cá vui sinh đúng số xu', () => {
    expect(absenceCoins([fish()], 40, 3_600, 100, testRules)).toBe(8);
  });

  it('cá không vui không sinh xu', () => {
    const sadFish = fish();
    sadFish.fullness = testRules.hungryBelow - 1;

    expect(absenceCoins([sadFish], 40, 3_600, 100, testRules)).toBe(0);
  });

  it('cá đang bỏ đi không sinh xu', () => {
    const leavingFish = fish();
    leavingFish.leaving = true;

    expect(absenceCoins([leavingFish], 40, 3_600, 100, testRules)).toBe(0);
  });

  it('cá con không sinh xu khi người chơi rời bể', () => {
    const juvenile = new Fish(1, testSpecies, 100, 100, testRules.startFullness, 0, 0);

    expect(absenceCoins([juvenile], 40, 3_600, 100, testRules)).toBe(0);
  });

  it('thời gian quá maxSeconds bị kẹp', () => {
    expect(absenceCoins([fish()], 100, 20, 100, testRules)).toBe(4);
  });

  it('seconds âm trả 0', () => {
    expect(absenceCoins([fish()], -10, 3_600, 100, testRules)).toBe(0);
  });

  it('làm tròn tổng xu xuống', () => {
    expect(absenceCoins([fish()], 9, 3_600, 100, testRules)).toBe(1);
  });
});
