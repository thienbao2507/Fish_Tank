import { describe, expect, it } from 'vitest';
import { ContentError, loadContent } from './loader';
import { rawContent } from './raw';

const validArt = {
  textures: {
    robot: {
      kind: 'shapes',
      width: 10,
      height: 10,
      parts: [{ shape: 'rect', x: 0, y: 0, w: 10, h: 10, color: '#ffffff' }],
    },
  },
};

function errorOf(fn: () => unknown): ContentError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ContentError) return err;
    throw err;
  }
  throw new Error('Không có lỗi nào được ném ra');
}

describe('loadContent', () => {
  it('dữ liệu thật trong src/data hợp lệ', () => {
    expect(() => loadContent(rawContent)).not.toThrow();
  });

  it('báo rõ file và trường khi sai kiểu', () => {
    const art = structuredClone(validArt);
    art.textures.robot.parts[0]!.color = 'red';
    const error = errorOf(() => loadContent({ strings: {}, art }));
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]).toContain('art.json › textures.robot.parts.0.color');
  });

  it('báo lỗi khi có trường lạ (gõ sai tên trường)', () => {
    const art = { textures: { robot: { ...validArt.textures.robot, colour: '#fff' } } };
    const error = errorOf(() => loadContent({ strings: {}, art }));
    expect(error.issues[0]).toContain('art.json › textures.robot');
  });

  it('gom lỗi của nhiều file vào một lần báo', () => {
    const error = errorOf(() => loadContent({ strings: { 'ui.ok': 5 }, art: { textures: 1 } }));
    expect(error.issues.some((issue) => issue.startsWith('strings.vi.json › ui.ok'))).toBe(true);
    expect(error.issues.some((issue) => issue.startsWith('art.json › textures'))).toBe(true);
    expect(error.message).toContain('Dữ liệu game không hợp lệ');
  });
});
