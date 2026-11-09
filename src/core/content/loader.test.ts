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
    raw.art.textures['ui.button'].parts[0].color = 'red';
    const error = errorOf(() => loadContent(raw));
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]).toContain('art.json › textures.ui.button.parts.0.color');
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

  it('deliverySeconds phải có và là số dương', () => {
    const missing = rawCopy();
    delete missing.fish.species[0].deliverySeconds;
    expect(errorOf(() => loadContent(missing)).issues[0]).toContain(
      'fish.json › species.0.deliverySeconds',
    );

    const nonPositive = rawCopy();
    nonPositive.fish.species[0].deliverySeconds = 0;
    expect(errorOf(() => loadContent(nonPositive)).issues[0]).toContain(
      'fish.json › species.0.deliverySeconds',
    );
  });

  it('fishCapacity phải có và là số nguyên dương', () => {
    const missing = rawCopy();
    delete missing.zones.zones[0].fishCapacity;
    expect(errorOf(() => loadContent(missing)).issues[0]).toContain(
      'zones.json › zones.0.fishCapacity',
    );

    const invalid = rawCopy();
    invalid.zones.zones[0].fishCapacity = 1.5;
    expect(errorOf(() => loadContent(invalid)).issues[0]).toContain(
      'zones.json › zones.0.fishCapacity',
    );
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

    it('các điểm terrain phải tăng dần và nằm trong chiều rộng khu', () => {
      const raw = rawCopy();
      raw.zones.zones[0].terrain = [
        [0, 0],
        [100, 10],
        [200, 0],
      ];
      raw.zones.zones[0].terrain[0][0] = -1;
      raw.zones.zones[0].terrain[2][0] = raw.zones.zones[0].terrain[1][0];
      const error = errorOf(() => loadContent(raw));
      expect(error.issues.some((issue) => issue.includes('terrain.0.0: x phải nằm trong'))).toBe(
        true,
      );
      expect(error.issues.some((issue) => issue.includes('terrain.2.0: x phải tăng dần'))).toBe(
        true,
      );
    });

    it('đáy trong khoảng ngang của trạm phải phẳng ở floorY', () => {
      const raw = rawCopy();
      raw.zones.zones[0].terrain = [
        [0, 1],
        [raw.zones.zones[0].width, 1],
      ];
      const error = errorOf(() => loadContent(raw));
      expect(error.issues.some((issue) => issue.includes('station: mặt đáy'))).toBe(true);
    });

    it('robotSpawn phải chừa đủ nửa chiều cao robot trên mặt đáy', () => {
      const raw = rawCopy();
      raw.zones.zones[0].robotSpawn.y = raw.zones.zones[0].floorY;
      const error = errorOf(() => loadContent(raw));
      expect(error.issues.some((issue) => issue.includes('robotSpawn'))).toBe(true);
    });

    it('vật cản phải nằm trọn trong biên khu', () => {
      const raw = rawCopy();
      raw.zones.zones[0].obstacles[0].y = raw.zones.zones[0].surfaceY;
      const error = errorOf(() => loadContent(raw));
      expect(error.issues.some((issue) => issue.includes('obstacles.0: vật cản nằm ngoài'))).toBe(
        true,
      );
    });

    it('từ chối trạm nằm trong vật cản', () => {
      const raw = rawCopy();
      const obstacle = raw.zones.zones[0].obstacles[0];
      const station = raw.zones.zones[0].station;
      station.x = obstacle.x - station.width / 2;
      station.y = obstacle.y - station.height / 2;
      const error = errorOf(() => loadContent(raw));
      expect(error.issues.some((issue) => issue.includes('station: trạm nằm trong vật cản'))).toBe(
        true,
      );
    });

    it('từ chối điểm xuất phát nằm trong vật cản', () => {
      const raw = rawCopy();
      const obstacle = raw.zones.zones[0].obstacles[0];
      raw.zones.zones[0].robotSpawn = { x: obstacle.x, y: obstacle.y };
      const error = errorOf(() => loadContent(raw));
      expect(
        error.issues.some((issue) =>
          issue.includes('robotSpawn: điểm xuất phát nằm trong vật cản'),
        ),
      ).toBe(true);
    });
  });

  describe('texture spritesheet', () => {
    it('chấp nhận spritesheet có kích thước frame hợp lệ', () => {
      const raw = rawCopy();
      raw.art.textures.robot = {
        kind: 'spritesheet',
        file: 'art/gen/submarine.png',
        frameWidth: 56,
        frameHeight: 48,
      };
      expect(() => loadContent(raw)).not.toThrow();
    });

    it('báo lỗi khi spritesheet thiếu frameWidth', () => {
      const raw = rawCopy();
      raw.art.textures.robot = {
        kind: 'spritesheet',
        file: 'art/gen/submarine.png',
        frameHeight: 48,
      };
      const error = errorOf(() => loadContent(raw));
      expect(error.issues[0]).toContain('art.json › textures.robot.frameWidth');
    });
  });
});
