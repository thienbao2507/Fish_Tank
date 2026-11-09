import type Phaser from 'phaser';
import { t } from '../core/i18n';
import type { GameContext } from '../game/context';
import { BLOOM_KEY } from '../game/env/bloom';
import { TILT_SHIFT_KEY, VIGNETTE_KEY } from '../game/env/postfx';

const TIME_SCALES = [1, 10, 100] as const;
const REFRESH_MS = 250;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Panel debug (chỉ hiện khi URL có `?debug=1`). Các nút khác được thêm khi hệ thống tương ứng tồn tại. */
export function mountDebugPanel(game: Phaser.Game, ctx: GameContext): void {
  // Soi/chỉnh trạng thái từ console trình duyệt hoặc script kiểm thử: fishtank.world, fishtank.clock…
  (window as unknown as { fishtank: GameContext }).fishtank = ctx;

  const panel = element('div', 'debug-panel');
  const title = element('div', 'debug-title', t('debug.title'));
  const body = element('div', 'debug-body');
  body.hidden = true; // bấm tiêu đề "Debug" để mở
  const fps = element('div');
  const gameTime = element('div');
  const scaleLabel = element('div', undefined, t('debug.timeScale'));
  const scaleRow = element('div', 'debug-row');

  const scaleButtons = TIME_SCALES.map((scale) => {
    const button = element('button', undefined, `×${scale}`);
    button.type = 'button';
    button.addEventListener('click', () => {
      ctx.clock.setScale(scale);
      refresh();
    });
    scaleRow.append(button);
    return { scale, button };
  });

  const currencyLabel = element('div', undefined, t('debug.currency'));
  const currencyRow = element('div', 'debug-row');
  const grants = [
    { text: t('debug.addCoins'), grant: () => ctx.world.wallet.add('coins', 1000) },
    { text: t('debug.addPearls'), grant: () => ctx.world.wallet.add('pearls', 10) },
  ];
  for (const { text, grant } of grants) {
    const button = element('button', undefined, text);
    button.type = 'button';
    button.addEventListener('click', grant);
    currencyRow.append(button);
  }

  const effectsLabel = element('div', undefined, t('debug.effects'));
  const effectsRow = element('div', 'debug-row');
  const bloomButton = element('button');
  bloomButton.type = 'button';
  bloomButton.addEventListener('click', () => {
    game.registry.set(BLOOM_KEY, game.registry.get(BLOOM_KEY) === false);
    refresh();
  });
  const tiltButton = element('button');
  tiltButton.type = 'button';
  tiltButton.addEventListener('click', () => {
    game.registry.set(TILT_SHIFT_KEY, game.registry.get(TILT_SHIFT_KEY) === false);
    refresh();
  });
  const vignetteButton = element('button');
  vignetteButton.type = 'button';
  vignetteButton.addEventListener('click', () => {
    game.registry.set(VIGNETTE_KEY, game.registry.get(VIGNETTE_KEY) === false);
    refresh();
  });
  effectsRow.append(bloomButton, tiltButton, vignetteButton);

  title.addEventListener('click', () => {
    body.hidden = !body.hidden;
  });

  function refresh(): void {
    fps.textContent = t('debug.fps', { fps: Math.round(game.loop.actualFps) });
    gameTime.textContent = t('debug.gameTime', {
      time: new Date(ctx.clock.now()).toLocaleString('vi-VN'),
    });
    for (const { scale, button } of scaleButtons) {
      button.classList.toggle('active', ctx.clock.scale === scale);
    }
    const bloomOn = game.registry.get(BLOOM_KEY) !== false;
    bloomButton.textContent = t(bloomOn ? 'debug.bloomOn' : 'debug.bloomOff');
    bloomButton.classList.toggle('active', bloomOn);
    const tiltOn = game.registry.get(TILT_SHIFT_KEY) !== false;
    tiltButton.textContent = t(tiltOn ? 'debug.tiltOn' : 'debug.tiltOff');
    tiltButton.classList.toggle('active', tiltOn);
    const vignetteOn = game.registry.get(VIGNETTE_KEY) !== false;
    vignetteButton.textContent = t(vignetteOn ? 'debug.vignetteOn' : 'debug.vignetteOff');
    vignetteButton.classList.toggle('active', vignetteOn);
  }

  body.append(
    fps,
    gameTime,
    scaleLabel,
    scaleRow,
    currencyLabel,
    currencyRow,
    effectsLabel,
    effectsRow,
  );
  panel.append(title, body);
  document.body.append(panel);

  refresh();
  window.setInterval(refresh, REFRESH_MS);
}
