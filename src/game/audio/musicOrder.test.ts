import { describe, expect, it } from 'vitest';
import { nextTrackIndex } from './musicOrder';

describe('nextTrackIndex', () => {
  it('đi lần lượt rồi quay vòng về bài đầu', () => {
    expect(nextTrackIndex(0, 3)).toBe(1);
    expect(nextTrackIndex(1, 3)).toBe(2);
    expect(nextTrackIndex(2, 3)).toBe(0);
  });

  it('một bài thì lặp lại chính nó', () => {
    expect(nextTrackIndex(0, 1)).toBe(0);
  });

  it('danh sách rỗng trả về 0', () => {
    expect(nextTrackIndex(0, 0)).toBe(0);
  });
});
