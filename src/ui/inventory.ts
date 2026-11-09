import { UI_FONT_FAMILY } from '../config';
import type { Content } from '../core/content/loader';
import { t, type StringKey } from '../core/i18n';
import type { World } from '../core/world';
import './inventory.css';

export interface InventoryWindowOptions {
  readonly world: World;
  readonly content: Content;
  readonly onClose: () => void;
}

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

/** Cửa sổ Kho phủ trên bể; thao tác thả cá vẫn đi qua luật của World. */
export class InventoryWindow {
  private root?: HTMLDivElement;
  private body?: HTMLElement;

  constructor(private readonly options: InventoryWindowOptions) {}

  open(): void {
    if (this.root) return;

    const root = element('div', 'inventory-overlay');
    root.tabIndex = -1;
    root.style.fontFamily = UI_FONT_FAMILY;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', t('inv.title'));

    const panel = element('section', 'inventory-window');
    const titlebar = element('div', 'inventory-titlebar');
    titlebar.append(element('h1', undefined, t('inv.title')));
    const closeButton = element('button', 'inventory-close');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', t('pc.close'));
    closeButton.addEventListener('click', () => this.close());
    titlebar.append(closeButton);

    const body = element('div', 'inventory-body');
    panel.append(titlebar, body);
    root.append(panel);

    root.addEventListener('pointerdown', this.blockPointerEvent);
    root.addEventListener('pointerup', this.blockPointerEvent);
    root.addEventListener('pointermove', this.blockPointerEvent);
    root.addEventListener('click', this.blockPointerEvent);
    root.addEventListener('wheel', this.blockPointerEvent, { passive: false });
    root.addEventListener('contextmenu', this.blockPointerEvent);
    window.addEventListener('keydown', this.blockKeyEvent, true);
    window.addEventListener('keyup', this.blockKeyEvent, true);

    document.body.append(root);
    this.root = root;
    this.body = body;
    this.render();
    root.focus({ preventScroll: true });
  }

  close(): void {
    if (!this.root) return;
    this.unmount();
    this.options.onClose();
  }

  /** Dọn overlay khi scene shutdown mà không gọi callback vào scene đã đóng. */
  destroy(): void {
    this.unmount();
  }

  private readonly blockPointerEvent = (event: Event): void => {
    event.stopPropagation();
    if (event.type === 'wheel' || event.type === 'contextmenu') event.preventDefault();
  };

  private readonly blockKeyEvent = (event: KeyboardEvent): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === 'keydown' && event.key === 'Escape') this.close();
  };

  private render(showZoneFull = false): void {
    const body = this.body;
    if (!body) return;
    const { world, content } = this.options;
    body.replaceChildren();
    if (showZoneFull) {
      const message = element('p', undefined, t('toast.zoneFull'));
      message.setAttribute('role', 'alert');
      body.append(message);
    }
    if (world.inventory.length === 0) {
      body.append(element('p', 'inventory-empty', t('inv.empty')));
      return;
    }

    const list = element('div', 'inventory-list');
    for (const entry of world.inventory) {
      const species = content.fish.species.find((candidate) => candidate.id === entry.speciesId);
      if (!species) continue;
      const row = element('article', 'inventory-row');
      const texture = content.art.textures[species.texture];
      if (texture?.kind === 'image') {
        const image = element('img', 'inventory-fish-image');
        image.src = texture.file;
        image.alt = t(species.name as StringKey);
        row.append(image);
      }

      const details = element('div', 'inventory-details');
      details.append(
        element('strong', 'inventory-fish-name', t(species.name as StringKey)),
        element('span', 'inventory-count', t('inv.count', { count: entry.count })),
      );
      const release = element('button', 'inventory-release', t('inv.release'));
      release.type = 'button';
      release.addEventListener('click', () => {
        this.render(!world.releaseFish(entry.speciesId));
      });
      row.append(details, release);
      list.append(row);
    }
    body.append(list);
  }

  private unmount(): void {
    const root = this.root;
    if (!root) return;
    window.removeEventListener('keydown', this.blockKeyEvent, true);
    window.removeEventListener('keyup', this.blockKeyEvent, true);
    root.remove();
    this.root = undefined;
    this.body = undefined;
  }
}
