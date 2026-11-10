import './style.css';
import { isDebugMode, UI_FONT_FAMILY, UI_FONT_URL } from './config';
import { ContentError, loadContent } from './core/content/loader';
import { rawContent } from './core/content/raw';
import { EventBus, type GameEvents } from './core/events';
import { initI18n, t } from './core/i18n';
import { createRng } from './core/rng';
import { ScaledClock } from './core/time/clock';
import { DayClock } from './core/time/dayClock';
import { World } from './core/world';
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

  const rng = createRng(Date.now());
  const bus = new EventBus<GameEvents>();
  const clock = new ScaledClock(() => Date.now());
  const ctx = {
    content,
    clock,
    day: new DayClock(content.balance.day, clock.now()),
    rng,
    bus,
    world: new World({ content, rng, bus }),
    input: { moveX: 0, moveY: 0 },
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
