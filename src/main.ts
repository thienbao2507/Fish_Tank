import './style.css';
import { isDebugMode, UI_FONT_FAMILY, UI_FONT_URL } from './config';
import { ContentError, loadContent } from './core/content/loader';
import { rawContent } from './core/content/raw';
import { initI18n, t } from './core/i18n';
import { createRng } from './core/rng';
import { ScaledClock } from './core/time/clock';
import { mountDebugPanel } from './debug/panel';
import { createGame } from './game/createGame';

function showFatalError(message: string): void {
  const pre = document.createElement('pre');
  pre.className = 'fatal-error';
  pre.textContent = message;
  document.body.append(pre);
}

function mountRotateOverlay(): void {
  const overlay = document.createElement('div');
  overlay.className = 'rotate-overlay';
  overlay.textContent = t('ui.rotateDevice');
  document.body.append(overlay);
}

/** Nạp font pixel từ file đóng gói kèm game. Lỗi thì vẫn chạy với font dự phòng. */
async function loadUiFont(): Promise<void> {
  try {
    const face = new FontFace(UI_FONT_FAMILY, `url(${UI_FONT_URL})`);
    await face.load();
    document.fonts.add(face);
  } catch (err) {
    console.error(`Không nạp được font ${UI_FONT_FAMILY} từ ${UI_FONT_URL}`, err);
  }
}

async function start(): Promise<void> {
  const content = loadContent(rawContent);
  initI18n(content.strings);

  await loadUiFont();
  mountRotateOverlay();

  const ctx = {
    content,
    clock: new ScaledClock(() => Date.now()),
    rng: createRng(Date.now()),
  };
  const game = createGame(ctx);

  if (isDebugMode()) {
    mountDebugPanel(game, ctx);
  }
}

start().catch((err: unknown) => {
  showFatalError(err instanceof ContentError ? err.message : String(err));
  console.error(err);
});
