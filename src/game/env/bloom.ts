import Phaser from 'phaser';

/** Khoá trong `game.registry` bật/tắt bloom (panel debug ghi, GameScene đọc). Mặc định bật. */
export const BLOOM_KEY = 'fx.bloom';

/**
 * Chỉ phần sáng nhất (tia nắng, mặt nước, đèn pha, ánh lửa trạm, sinh vật phát quang, xu) được
 * loang sáng; độ phân giải logic thấp (≤ 840×360) nên chi phí GPU nhỏ.
 */
const BLOOM_CONFIG = {
  threshold: 0.72,
  blurRadius: 3,
  blurSteps: 4,
  blurQuality: 0,
  blendAmount: 0.6,
};

/** Bloom toàn màn hình cho camera chính (spec 12.4, HD-2D). Cần WebGL; với Canvas thì bỏ qua. */
export function addCameraBloom(scene: Phaser.Scene): void {
  if (scene.game.renderer.type !== Phaser.WEBGL) return;
  const [bloom] = Phaser.Actions.AddEffectBloom(scene.cameras.main, BLOOM_CONFIG);
  if (!bloom) return;

  if (!scene.registry.has(BLOOM_KEY)) scene.registry.set(BLOOM_KEY, true);
  const apply = () => {
    bloom.parallelFilters.active = scene.registry.get(BLOOM_KEY) !== false;
  };
  apply();
  const onChange = (_parent: unknown, key: string) => {
    if (key === BLOOM_KEY) apply();
  };
  scene.registry.events.on(Phaser.Data.Events.CHANGE_DATA, onChange);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.registry.events.off(Phaser.Data.Events.CHANGE_DATA, onChange);
  });
}
