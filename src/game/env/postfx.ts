import Phaser from 'phaser';

/** Khoá registry bật/tắt tilt-shift, mặc định bật. */
export const TILT_SHIFT_KEY = 'fx.tiltShift';
/** Khoá registry bật/tắt vignette filter, mặc định bật. */
export const VIGNETTE_KEY = 'fx.vignette';

/** Tilt-shift và vignette nhẹ cho camera chính (spec 12.5). Chỉ chạy với WebGL. */
export function addCameraPostFx(
  scene: Phaser.Scene,
  options?: {
    tiltRadius?: number;
    vignetteRadius?: number;
    vignetteStrength?: number;
  },
): void {
  if (scene.game.renderer.type !== Phaser.WEBGL) return;

  const {
    tiltRadius = 0.18,
    vignetteRadius = 0.85,
    vignetteStrength = 0.25,
  } = options ?? {};
  const filters = scene.cameras.main.filters.external;
  // contrast = 0: shader Bokeh bình phương màu khi contrast > 0, làm tối cả cảnh.
  // blurX = 0: chỉ nhòe theo khoảng cách dọc tới giữa màn hình (dải giữa nét).
  // Bán kính nhỏ: camera chạm mép khu thì tàu có thể nằm sát mép màn hình, không được nhòe nhiều.
  const tiltShift = filters.addTiltShift(tiltRadius, 0.3, 0, 0, 1, 1);
  const vignette = filters.addVignette(
    0.5,
    0.5,
    vignetteRadius,
    vignetteStrength,
    0x060a26,
    Phaser.BlendModes.NORMAL,
  );

  if (!scene.registry.has(TILT_SHIFT_KEY)) scene.registry.set(TILT_SHIFT_KEY, true);
  if (!scene.registry.has(VIGNETTE_KEY)) scene.registry.set(VIGNETTE_KEY, true);
  const apply = () => {
    tiltShift.active = scene.registry.get(TILT_SHIFT_KEY) !== false;
    vignette.active = scene.registry.get(VIGNETTE_KEY) !== false;
  };
  apply();

  const onChange = (_parent: unknown, key: string) => {
    if (key === TILT_SHIFT_KEY || key === VIGNETTE_KEY) apply();
  };
  scene.registry.events.on(Phaser.Data.Events.CHANGE_DATA, onChange);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.registry.events.off(Phaser.Data.Events.CHANGE_DATA, onChange);
  });
}
