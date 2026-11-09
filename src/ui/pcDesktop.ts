import { UI_FONT_FAMILY } from '../config';
import type { Content } from '../core/content/loader';
import { t, type StringKey } from '../core/i18n';
import { isDone, remainingSeconds } from '../core/time/timers';
import type { World } from '../core/world';
import './pcDesktop.css';

export interface PcDesktopOptions {
  readonly world: World;
  readonly content: Content;
  readonly now: () => number;
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

/** Desktop retro phủ lên game; toàn bộ luật mua cá vẫn thuộc về World. */
export class PcDesktop {
  private root?: HTMLDivElement;
  private shopWindow?: HTMLElement;
  private shopBody?: HTMLElement;
  private deliveryBody?: HTMLElement;
  private deliveryInterval?: ReturnType<typeof setInterval>;

  constructor(private readonly options: PcDesktopOptions) {}

  open(): void {
    if (this.root) return;

    const root = element('div', 'pc-desktop-overlay');
    root.tabIndex = -1;
    root.style.fontFamily = UI_FONT_FAMILY;
    root.setAttribute('role', 'application');
    root.setAttribute('aria-label', t('pc.peeshop'));

    const shopIcon = element('button', 'pc-desktop-icon');
    shopIcon.type = 'button';
    shopIcon.setAttribute('aria-label', t('pc.peeshop'));
    const bag = element('span', 'pc-shop-bag');
    bag.setAttribute('aria-hidden', 'true');
    shopIcon.append(bag, element('span', 'pc-desktop-icon-label', t('pc.peeshop')));
    shopIcon.addEventListener('click', () => this.openShop());

    const taskbar = element('div', 'pc-taskbar');
    const start = element('button', 'pc-start-button', t('pc.start'));
    start.type = 'button';
    start.tabIndex = -1;
    const spacer = element('span', 'pc-taskbar-spacer');
    const shutdown = element('button', 'pc-shutdown-button', t('pc.shutdown'));
    shutdown.type = 'button';
    shutdown.addEventListener('click', () => this.close());
    taskbar.append(start, spacer, shutdown);

    const shopWindow = element('section', 'pc-shop-window');
    shopWindow.hidden = true;
    shopWindow.setAttribute('aria-label', t('pc.peeshop'));
    const titlebar = element('div', 'pc-shop-titlebar');
    titlebar.append(element('h1', undefined, t('pc.peeshop')));
    const closeShop = element('button', 'pc-window-close');
    closeShop.type = 'button';
    closeShop.setAttribute('aria-label', t('pc.close'));
    closeShop.addEventListener('click', () => {
      this.stopDeliveryUpdates();
      shopWindow.hidden = true;
      root.focus({ preventScroll: true });
    });
    titlebar.append(closeShop);
    const shopBody = element('div', 'pc-shop-body');
    shopWindow.append(titlebar, shopBody);

    root.addEventListener('pointerdown', this.blockPointerEvent);
    root.addEventListener('pointerup', this.blockPointerEvent);
    root.addEventListener('pointermove', this.blockPointerEvent);
    root.addEventListener('click', this.blockPointerEvent);
    root.addEventListener('wheel', this.blockPointerEvent, { passive: false });
    root.addEventListener('contextmenu', this.blockPointerEvent);
    window.addEventListener('keydown', this.blockKeyEvent, true);
    window.addEventListener('keyup', this.blockKeyEvent, true);

    root.append(shopIcon, shopWindow, taskbar);
    document.body.append(root);
    this.root = root;
    this.shopWindow = shopWindow;
    this.shopBody = shopBody;
    root.focus({ preventScroll: true });
  }

  close(): void {
    if (!this.root) return;
    this.unmount();
    this.options.onClose();
  }

  /** Dọn overlay khi scene shutdown mà không gọi ngược vào scene đã đóng. */
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

  private openShop(): void {
    if (!this.shopWindow) return;
    this.renderShop();
    this.shopWindow.hidden = false;
    this.startDeliveryUpdates();
  }

  private renderShop(): void {
    const body = this.shopBody;
    if (!body) return;
    const { world, content } = this.options;
    const coins = world.wallet.get('coins');
    const fragment = document.createDocumentFragment();

    fragment.append(element('div', 'pc-shop-balance', t('shop.coins', { coins })));
    const catalog = element('div', 'pc-shop-catalog');
    for (const species of content.fish.species) {
      const row = element('article', 'pc-fish-row');
      const texture = content.art.textures[species.texture];
      if (texture?.kind === 'image') {
        const image = element('img', 'pc-fish-image');
        image.src = texture.file;
        image.alt = t(species.name as StringKey);
        row.append(image);
      }

      const details = element('div', 'pc-fish-details');
      details.append(
        element('strong', 'pc-fish-name', t(species.name as StringKey)),
        element('span', 'pc-fish-price', t('shop.price', { price: species.price })),
      );
      const canBuy = coins >= species.price;
      const buy = element(
        'button',
        'pc-buy-button',
        t(canBuy ? 'shop.buy' : 'shop.notEnough'),
      );
      buy.type = 'button';
      buy.disabled = !canBuy;
      buy.addEventListener('click', () => {
        world.orderFish(species.id, this.options.now());
        this.renderShop();
      });
      row.append(details, buy);
      catalog.append(row);
    }
    fragment.append(catalog);

    const delivery = element('section', 'pc-delivery');
    delivery.append(element('h2', undefined, t('shop.delivering')));
    const deliveryBody = element('div', 'pc-delivery-body');
    delivery.append(deliveryBody);
    fragment.append(delivery);
    body.replaceChildren(fragment);
    this.deliveryBody = deliveryBody;
    this.updateDelivery();
  }

  private startDeliveryUpdates(): void {
    if (this.deliveryInterval !== undefined) return;
    this.deliveryInterval = setInterval(() => this.updateDelivery(), 1_000);
  }

  private stopDeliveryUpdates(): void {
    if (this.deliveryInterval === undefined) return;
    clearInterval(this.deliveryInterval);
    this.deliveryInterval = undefined;
  }

  /** Chỉ cập nhật danh sách giao hàng; catalog không bị vẽ lại theo chu kỳ. */
  private updateDelivery(): void {
    const body = this.deliveryBody;
    if (!body) return;
    const { world, content, now } = this.options;
    if (world.orders.length === 0) {
      body.replaceChildren(element('p', 'pc-no-orders', t('shop.noOrders')));
      return;
    }

    const current = now();
    const list = element('ul', 'pc-order-list');
    for (const order of world.orders) {
      const species = content.fish.species.find((candidate) => candidate.id === order.speciesId);
      if (!species) continue;
      const row = element('li');
      row.append(element('span', undefined, t(species.name as StringKey)));
      const status = isDone(order.timer, current)
        ? t('shop.arrived')
        : t('shop.remaining', {
            time: formatRemainingTime(remainingSeconds(order.timer, current)),
          });
      row.append(element('span', 'pc-order-status', status));
      list.append(row);
    }
    body.replaceChildren(list);
  }

  private unmount(): void {
    const root = this.root;
    if (!root) return;
    this.stopDeliveryUpdates();
    window.removeEventListener('keydown', this.blockKeyEvent, true);
    window.removeEventListener('keyup', this.blockKeyEvent, true);
    root.remove();
    this.root = undefined;
    this.shopWindow = undefined;
    this.shopBody = undefined;
    this.deliveryBody = undefined;
  }
}

function formatRemainingTime(seconds: number): string {
  const total = Math.ceil(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}
