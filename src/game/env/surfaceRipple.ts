import Phaser from 'phaser';

/** Khoá registry bật/tắt gợn mặt nước, mặc định bật. */
export const SURFACE_RIPPLE_KEY = 'fx.surfaceRipple';

const RIPPLE_START_DEPTH = 1.6;
const RIPPLE_DEPTH_RANGE = 0.4;
const RIPPLE_MAP_SIZE = 32;
const RIPPLE_MAP_FRAMES = 8;
const RIPPLE_FRAME_MS = 90;
const RIPPLE_MAP_KEYS = Array.from(
  { length: RIPPLE_MAP_FRAMES },
  (_, index) => `fx.surfaceRipple.map.${index}`,
);

export interface SurfaceRippleController {
  update(time: number, robotDepth: number): void;
}

/** Cường độ gợn theo độ sâu tàu: tắt dưới 1,6 và đạt tối đa ở mặt nước z=2. */
export function surfaceRippleStrength(robotDepth: number): number {
  return Phaser.Math.Clamp((robotDepth - RIPPLE_START_DEPTH) / RIPPLE_DEPTH_RANGE, 0, 1);
}

function createRippleMaps(scene: Phaser.Scene): void {
  RIPPLE_MAP_KEYS.forEach((key, frame) => {
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, RIPPLE_MAP_SIZE, RIPPLE_MAP_SIZE);
    if (!texture) return;

    const image = texture.context.createImageData(RIPPLE_MAP_SIZE, RIPPLE_MAP_SIZE);
    const phase = (frame / RIPPLE_MAP_FRAMES) * Math.PI * 2;
    for (let y = 0; y < RIPPLE_MAP_SIZE; y++) {
      for (let x = 0; x < RIPPLE_MAP_SIZE; x++) {
        const offset = (y * RIPPLE_MAP_SIZE + x) * 4;
        const waveX = Math.sin((y / RIPPLE_MAP_SIZE) * Math.PI * 4 + phase + x * 0.08);
        const waveY = Math.sin((x / RIPPLE_MAP_SIZE) * Math.PI * 2 - phase * 0.75 + y * 0.05);
        image.data[offset] = Math.round(128 + waveX * 54);
        image.data[offset + 1] = Math.round(128 + waveY * 38);
        image.data[offset + 2] = 128;
        image.data[offset + 3] = 255;
      }
    }
    texture.context.putImageData(image, 0, 0);
    texture.refresh();
  });
}

/** Thêm gợn sóng + nhòe nhẹ cho camera cảnh bể; Canvas renderer bỏ qua hoàn toàn. */
export function addSurfaceRipple(scene: Phaser.Scene): SurfaceRippleController | undefined {
  if (scene.game.renderer.type !== Phaser.WEBGL) return undefined;

  createRippleMaps(scene);
  const filters = scene.cameras.main.filters.external;
  const displacement = filters.addDisplacement(RIPPLE_MAP_KEYS[0], 0, 0);
  const blur = filters.addBlur(0, 0.8, 0.8, 0, 0xffffff, 1);
  displacement.active = false;
  blur.active = false;

  if (!scene.registry.has(SURFACE_RIPPLE_KEY)) scene.registry.set(SURFACE_RIPPLE_KEY, true);
  let lastTime = 0;
  let lastDepth = 0;
  let lastFrame = -1;
  const apply = (): void => {
    const strength =
      scene.registry.get(SURFACE_RIPPLE_KEY) === false
        ? 0
        : surfaceRippleStrength(lastDepth);
    const active = strength > 0;
    displacement.active = active;
    blur.active = active;
    if (!active) return;

    const frame = Math.floor(lastTime / RIPPLE_FRAME_MS) % RIPPLE_MAP_FRAMES;
    if (frame !== lastFrame) {
      lastFrame = frame;
      displacement.setTexture(RIPPLE_MAP_KEYS[frame] as string);
    }
    const phase = lastTime * 0.002;
    displacement.x = strength * (0.006 + Math.sin(phase) * 0.001);
    displacement.y = strength * (0.003 + Math.cos(phase * 1.3) * 0.0008);
    blur.strength = strength * 0.45;
  };

  const onChange = (_parent: unknown, key: string): void => {
    if (key === SURFACE_RIPPLE_KEY) apply();
  };
  scene.registry.events.on(Phaser.Data.Events.CHANGE_DATA, onChange);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.registry.events.off(Phaser.Data.Events.CHANGE_DATA, onChange);
  });

  return {
    update(time: number, robotDepth: number): void {
      lastTime = time;
      lastDepth = robotDepth;
      apply();
    },
  };
}
