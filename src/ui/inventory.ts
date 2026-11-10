import { UI_FONT_FAMILY } from '../config';
import type { Content } from '../core/content/loader';
import type { SoundCue } from '../core/content/schemas';
import { t, type StringKey } from '../core/i18n';
import type { ItemInventoryEntry, OrderItem, World } from '../core/world';
import { presentItem } from './itemPresentation';
import './inventory.css';

export interface InventoryWindowOptions {
  readonly world: World;
  readonly content: Content;
  readonly playSound: (cue: SoundCue) => void;
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

/** Cửa sổ Kho phủ trên bể; mọi thao tác vật phẩm vẫn đi qua luật của World. */
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
    root.addEventListener('click', this.playButtonClick, true);
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

  private readonly playButtonClick = (event: Event): void => {
    const target = event.target;
    if (target instanceof Element && target.closest('button')) this.options.playSound('click');
  };

  private render(message?: StringKey): void {
    const body = this.body;
    if (!body) return;
    const { world } = this.options;
    body.replaceChildren();
    if (message) {
      const alert = element('p', 'inventory-alert', t(message));
      alert.setAttribute('role', 'alert');
      body.append(alert);
    }
    if (world.inventory.length === 0 && world.items.length === 0) {
      body.append(element('p', 'inventory-empty', t('inv.empty')));
      return;
    }

    if (world.inventory.length > 0) this.renderFishGroup(body);
    const components = world.items.filter(
      ({ item }) => item.kind === 'upgrade' || item.kind === 'battery' || item.kind === 'charger',
    );
    const powerBanks = world.items.filter(({ item }) => item.kind === 'powerBank');
    const devices = world.items.filter(({ item }) => item.kind === 'device');
    this.renderItemGroup(body, 'inv.components', components);
    this.renderItemGroup(body, 'inv.powerBanks', powerBanks);
    this.renderItemGroup(body, 'inv.devices', devices);
  }

  private renderFishGroup(body: HTMLElement): void {
    const { world, content } = this.options;
    const section = this.createGroup('inv.fish');
    const list = element('div', 'inventory-list');
    for (const entry of world.inventory) {
      const species = content.fish.species.find((candidate) => candidate.id === entry.speciesId);
      if (!species) continue;
      const row = element('article', 'inventory-row');
      this.appendImage(row, species.texture, t(species.name as StringKey));
      const details = element('div', 'inventory-details');
      details.append(
        element('strong', 'inventory-item-name', t(species.name as StringKey)),
        element('span', 'inventory-count', t('inv.count', { count: entry.count })),
      );
      const release = element('button', 'inventory-action', t('inv.release'));
      release.type = 'button';
      release.addEventListener('click', () => {
        this.render(world.releaseFish(entry.speciesId) ? undefined : 'toast.zoneFull');
      });
      row.append(details, release);
      list.append(row);
    }
    section.append(list);
    body.append(section);
  }

  private renderItemGroup(
    body: HTMLElement,
    title: StringKey,
    entries: readonly ItemInventoryEntry[],
  ): void {
    if (entries.length === 0) return;
    const section = this.createGroup(title);
    const list = element('div', 'inventory-list');
    for (const entry of entries) list.append(this.renderItemRow(entry));
    section.append(list);
    body.append(section);
  }

  private renderItemRow(entry: ItemInventoryEntry): HTMLElement {
    const { item } = entry;
    const presentation = presentItem(this.options.content, item);
    const row = element('article', 'inventory-row');
    if (!presentation) return row;
    this.appendImage(row, presentation.icon, presentation.name);
    const details = element('div', 'inventory-details');
    details.append(element('strong', 'inventory-item-name', presentation.name));
    if (item.kind === 'upgrade' || item.kind === 'device') {
      details.append(element('span', 'inventory-level', t('shop.level', { level: item.level })));
    }
    for (const stat of presentation.stats) {
      details.append(element('span', 'inventory-stat', stat));
    }
    details.append(element('span', 'inventory-count', t('inv.count', { count: entry.count })));
    row.append(details, this.renderItemAction(item));
    return row;
  }

  private renderItemAction(item: OrderItem): HTMLElement {
    if (item.kind === 'powerBank') {
      const use = element('button', 'inventory-action', t('inv.use'));
      use.type = 'button';
      use.addEventListener('click', () => {
        const used = this.options.world.usePowerBank(item.id);
        if (used) this.options.playSound('install');
        this.render(used ? undefined : 'inv.batteryFull');
      });
      return use;
    }

    if (item.kind === 'device' && item.level === 1) {
      return this.renderPlacementAction(item);
    }

    const install = element('button', 'inventory-action', t('inv.install'));
    install.type = 'button';
    install.addEventListener('click', () => {
      if (this.options.world.installItem(item)) this.options.playSound('install');
      this.render();
    });
    return install;
  }

  private renderPlacementAction(item: Extract<OrderItem, { kind: 'device' }>): HTMLElement {
    const action = element('div', 'inventory-placement');
    const occupied = new Set(this.options.world.devices.map(({ slotIndex }) => slotIndex));
    const emptySlots = (this.options.world.zone.deviceSlots ?? [])
      .map((_, slotIndex) => slotIndex)
      .filter((slotIndex) => !occupied.has(slotIndex));
    const select = element('select', 'inventory-slot');
    select.setAttribute('aria-label', t('inv.devices'));
    for (const slotIndex of emptySlots) {
      const option = element('option', undefined, t('inv.slot', { slot: slotIndex + 1 }));
      option.value = String(slotIndex);
      select.append(option);
    }
    const place = element('button', 'inventory-action', t('inv.place'));
    place.type = 'button';
    place.disabled = emptySlots.length === 0;
    place.addEventListener('click', () => {
      if (this.options.world.placeDevice(item.type, Number(select.value))) {
        this.options.playSound('install');
      }
      this.render();
    });
    if (emptySlots.length === 0) {
      action.append(element('span', 'inventory-no-slot', t('inv.noEmptySlot')));
    } else {
      action.append(select);
    }
    action.append(place);
    return action;
  }

  private createGroup(title: StringKey): HTMLElement {
    const section = element('section', 'inventory-group');
    section.append(element('h2', undefined, t(title)));
    return section;
  }

  private appendImage(parent: HTMLElement, textureKey: string, alt: string): void {
    const texture = this.options.content.art.textures[textureKey];
    if (texture?.kind !== 'image') return;
    const image = element('img', 'inventory-item-image');
    image.src = texture.file;
    image.alt = alt;
    parent.append(image);
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
