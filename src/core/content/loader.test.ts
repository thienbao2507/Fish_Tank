import { describe, expect, it } from 'vitest';
import { ContentError, loadContent, type RawContent } from './loader';
import { rawContent } from './raw';

function errorOf(fn: () => unknown): ContentError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ContentError) return err;
    throw err;
  }
  throw new Error('Không có lỗi nào được ném ra');
}

// JSON thô, sửa tự do trong từng test.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MutableRaw = Record<keyof RawContent, any>;

/** Bản sao sâu của dữ liệu thật để sửa trong từng test. */
function rawCopy(): MutableRaw {
  return structuredClone(rawContent) as MutableRaw;
}

describe('loadContent', () => {
  it('dữ liệu thật trong src/data hợp lệ', () => {
    expect(() => loadContent(rawContent)).not.toThrow();
  });

  it('báo rõ file và trường khi sai kiểu', () => {
    const raw = rawCopy();
    raw.art.textures.station.parts[0].color = 'red';
    const error = errorOf(() => loadContent(raw));
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]).toContain('art.json › textures.station.parts.0.color');
  });

  it('báo lỗi khi có trường lạ (gõ sai tên trường)', () => {
    const raw = rawCopy();
    raw.balance.robot.maxSpeeed = 100;
    const error = errorOf(() => loadContent(raw));
    expect(error.issues[0]).toContain('balance.json › robot');
  });

  it('gom lỗi của nhiều file vào một lần báo', () => {
    const raw = rawCopy();
    raw.strings = { 'ui.ok': 5 };
    raw.trash.sinkSpeed = -1;
    const error = errorOf(() => loadContent(raw));
    expect(error.issues.some((issue) => issue.startsWith('strings.vi.json › ui.ok'))).toBe(true);
    expect(error.issues.some((issue) => issue.startsWith('trash.json › sinkSpeed'))).toBe(true);
    expect(error.message).toContain('Dữ liệu game không hợp lệ');
  });

  describe('kiểm tra chéo giữa các file', () => {
    it('khu tham chiếu loại rác không tồn tại', () => {
      const raw = rawCopy();
      raw.zones.zones[0].trash.weights.ghost = 1;
      const error = errorOf(() => loadContent(raw));
      expect(error.issues[0]).toContain('zones.json › zones.0.trash.weights.ghost');
    });

    it('loại rác dùng texture không có trong art.json', () => {
      const raw = rawCopy();
      raw.trash.types[0].texture = 'missing.texture';
      const error = errorOf(() => loadContent(raw));
      expect(error.issues[0]).toContain('trash.json › types.0.texture');
    });

    it('startZone không tồn tại', () => {
      const raw = rawCopy();
      raw.balance.startZone = 'nowhere';
      const error = errorOf(() => loadContent(raw));
      expect(error.issues[0]).toContain('balance.json › startZone');
    });

    it('loài cá dùng texture hoặc tên không tồn tại', () => {
      const raw = rawCopy();
      raw.fish.species[0].texture = 'missing.texture';
      raw.fish.species[0].name = 'missing.name';
      const error = errorOf(() => loadContent(raw));
      expect(error.issues.some((issue) => issue.includes('fish.json › species.0.texture'))).toBe(
        true,
      );
      expect(error.issues.some((issue) => issue.includes('fish.json › species.0.name'))).toBe(true);
    });

    it('cá có sẵn thuộc loài không tồn tại', () => {
      const raw = rawCopy();
      raw.balance.startingFish = [{ species: 'shark', count: 1 }];
      const error = errorOf(() => loadContent(raw));
      expect(error.issues[0]).toContain('balance.json › startingFish.0.species');
    });

    it('mặt nước phải nằm trên đáy', () => {
      const raw = rawCopy();
      raw.zones.zones[0].surfaceY = raw.zones.zones[0].floorY + 1;
      const error = errorOf(() => loadContent(raw));
      expect(error.issues.some((issue) => issue.includes('surfaceY < floorY'))).toBe(true);
    });
  });
});
