import { describe, expect, it } from 'vitest';
import { Fish, moodOf, stepNeeds } from './fish';
import { testRules, testSpecies } from './testFixtures';

function fish(fullness = 80, health = 100, species = testSpecies): Fish {
  const f = new Fish(1, species, 0, 0, fullness);
  f.health = health;
  return f;
}

describe('moodOf', () => {
  it('no và nước sạch → Vui', () => {
    expect(moodOf(80, 100, 80, testRules)).toBe('happy');
  });

  it('đói → Buồn', () => {
    expect(moodOf(30, 100, 80, testRules)).toBe('sad');
  });

  it('nước dưới ngưỡng → Buồn', () => {
    expect(moodOf(80, 100, 50, testRules)).toBe('sad');
  });

  it('máu thấp → Ốm, kể cả khi no và nước sạch', () => {
    expect(moodOf(100, 30, 100, testRules)).toBe('sick');
  });
});

describe('stepNeeds', () => {
  it('No giảm theo tốc độ đói của loài', () => {
    const f = fish(80);
    stepNeeds(f, 100, testRules, 60);
    expect(f.fullness).toBeCloseTo(70);
  });

  it('nước sạch và không đói lả → hồi máu', () => {
    const f = fish(80, 50);
    stepNeeds(f, 100, testRules, 60);
    expect(f.health).toBeCloseTo(60);
  });

  it('nước bẩn → mất máu theo độ bẩn', () => {
    const f = fish(80, 100);
    stepNeeds(f, 20, testRules, 60); // bẩn 50% so với ngưỡng 40
    expect(f.health).toBeCloseTo(90);
  });

  it('loài nhạy hơn mất máu nhanh hơn', () => {
    const f = fish(80, 100, { ...testSpecies, waterSensitivity: 2 });
    stepNeeds(f, 20, testRules, 60);
    expect(f.health).toBeCloseTo(80);
  });

  it('đói lả → mất máu', () => {
    const f = fish(0, 100);
    stepNeeds(f, 100, testRules, 60);
    expect(f.health).toBeCloseTo(85);
  });

  it('ốm thì đếm thời gian ốm; khỏi thì đếm lại từ đầu', () => {
    const f = fish(0, 39);
    stepNeeds(f, 100, testRules, 30);
    expect(f.sickSeconds).toBe(30);
    f.fullness = 100;
    f.health = 100;
    stepNeeds(f, 100, testRules, 1);
    expect(f.sickSeconds).toBe(0);
  });

  it('ốm liên tục đủ lâu → phải bỏ đi', () => {
    const f = fish(0, 10);
    expect(stepNeeds(f, 0, testRules, 60)).toBe(false);
    expect(stepNeeds(f, 0, testRules, 30)).toBe(true);
  });
});
