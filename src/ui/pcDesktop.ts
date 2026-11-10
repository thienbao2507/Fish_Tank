import { UI_FONT_FAMILY } from '../config';
import type { Content } from '../core/content/loader';
import type { DeviceType, UpgradeTrack } from '../core/content/schemas';
import { t, type StringKey } from '../core/i18n';
import { isFishOrder } from '../core/sim/orders';
import { isDone, remainingSeconds } from '../core/time/timers';
import type { OrderItem, World } from '../core/world';
import { presentItem, type ItemPresentation } from './itemPresentation';
import './pcDesktop.css';

export interface PcDesktopOptions {
  readonly world: World;
  readonly content: Content;
  readonly now: () => number;
  readonly onClose: () => void;
}

type ShopTab = 'robot' | 'devices' | 'fish' | 'items' | 'exchange';

const SHOP_TABS: readonly { readonly id: ShopTab; readonly label: StringKey }[] = [
  { id: 'robot', label: 'shop.tab.robot' },
  { id: 'devices', label: 'shop.tab.devices' },
  { id: 'fish', label: 'shop.tab.fish' },
  { id: 'items', label: 'shop.tab.items' },
  { id: 'exchange', label: 'shop.tab.exchange' },
];

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

/** Desktop retro phủ lên game; mọi luật mua, đổi và tua vẫn thuộc về World. */
export class PcDesktop {
  private root?: HTMLDivElement;
  private shopWindow?: HTMLElement;
  private shopBody?: HTMLElement;
  private deliveryBody?: HTMLElement;
  private deliveryInterval?: ReturnType<typeof setInterval>;
  private activeTab: ShopTab = 'robot';

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
    const { world } = this.options;
    const fragment = document.createDocumentFragment();

    const balances = element('div', 'pc-shop-balances');
    balances.append(
      element('span', undefined, t('shop.coins', { coins: world.wallet.get('coins') })),
      element('span', undefined, t('shop.pearls', { pearls: world.wallet.get('pearls') })),
    );
    fragment.append(balances, this.renderTabs(), this.renderActiveCatalog());

    const delivery = element('section', 'pc-delivery');
    delivery.append(element('h2', undefined, t('shop.delivering')));
    const deliveryBody = element('div', 'pc-delivery-body');
    delivery.append(deliveryBody);
    fragment.append(delivery);
    body.replaceChildren(fragment);
    this.deliveryBody = deliveryBody;
    this.updateDelivery();
  }

  private renderTabs(): HTMLElement {
    const tabs = element('div', 'pc-shop-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const tab of SHOP_TABS) {
      const button = element('button', 'pc-shop-tab', t(tab.label));
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(tab.id === this.activeTab));
      button.classList.toggle('is-active', tab.id === this.activeTab);
      button.addEventListener('click', () => {
        this.activeTab = tab.id;
        this.renderShop();
      });
      tabs.append(button);
    }
    return tabs;
  }

  private renderActiveCatalog(): HTMLElement {
    switch (this.activeTab) {
      case 'robot':
        return this.renderRobotCatalog();
      case 'devices':
        return this.renderDeviceCatalog();
      case 'fish':
        return this.renderFishCatalog();
      case 'items':
        return this.renderPowerBankCatalog();
      case 'exchange':
        return this.renderExchange();
    }
  }

  private renderRobotCatalog(): HTMLElement {
    const { upgrades } = this.options.content;
    const catalog = element('div', 'pc-shop-catalog');
    for (const track of ['cargo', 'speed', 'vacuum'] as const) {
      this.appendItemOrMaximum(catalog, this.nextUpgrade(track), {
        kind: 'upgrade',
        track,
        level: upgrades[track].levels.length,
      });
    }

    const lastBattery = upgrades.batteries[upgrades.batteries.length - 1];
    if (lastBattery) {
      this.appendItemOrMaximum(catalog, this.nextBattery(), {
        kind: 'battery',
        id: lastBattery.id,
      });
    }
    const lastCharger = upgrades.chargers[upgrades.chargers.length - 1];
    if (lastCharger) {
      this.appendItemOrMaximum(catalog, this.nextCharger(), {
        kind: 'charger',
        id: lastCharger.id,
      });
    }
    return catalog;
  }

  private renderDeviceCatalog(): HTMLElement {
    const catalog = element('div', 'pc-shop-catalog');
    for (const type of Object.keys(this.options.content.upgrades.devices) as DeviceType[]) {
      const levels = this.options.content.upgrades.devices[type].levels;
      this.appendItemOrMaximum(catalog, this.nextDevice(type), {
        kind: 'device',
        type,
        level: levels.length,
      });
    }
    return catalog;
  }

  private renderFishCatalog(): HTMLElement {
    const { content, world } = this.options;
    const catalog = element('div', 'pc-shop-catalog');
    for (const species of content.fish.species) {
      const row = element('article', 'pc-catalog-row');
      this.appendImage(row, species.texture, t(species.name as StringKey));
      const details = element('div', 'pc-catalog-details');
      details.append(
        element('strong', 'pc-catalog-name', t(species.name as StringKey)),
        element(
          'span',
          'pc-catalog-stat',
          t('shop.growthRemaining', {
            time: formatRemainingTime(species.growSeconds),
          }),
        ),
        element('span', 'pc-catalog-price', t('shop.price', { price: species.price })),
        element(
          'span',
          'pc-catalog-delivery',
          t('shop.deliveryTime', {
            time: formatRemainingTime(species.deliverySeconds),
          }),
        ),
      );
      const canBuy = world.wallet.get('coins') >= species.price;
      const buy = element('button', 'pc-buy-button', t(canBuy ? 'shop.buy' : 'shop.notEnough'));
      buy.type = 'button';
      buy.disabled = !canBuy;
      buy.addEventListener('click', () => {
        world.orderFish(species.id, this.options.now());
        this.renderShop();
      });
      row.append(details, buy);
      catalog.append(row);
    }
    return catalog;
  }

  private renderPowerBankCatalog(): HTMLElement {
    const catalog = element('div', 'pc-shop-catalog');
    for (const definition of this.options.content.upgrades.powerBanks) {
      catalog.append(this.renderItemRow({ kind: 'powerBank', id: definition.id }));
    }
    return catalog;
  }

  private renderExchange(): HTMLElement {
    const { world, content } = this.options;
    const container = element('div', 'pc-exchange');
    container.append(
      element(
        'p',
        'pc-exchange-rate',
        t('shop.exchangeRate', {
          coins: content.balance.economy.pearlValueInCoins,
        }),
      ),
    );

    const pearls = world.wallet.get('pearls');
    const actions = element('div', 'pc-exchange-actions');
    const exchangeOne = element('button', 'pc-buy-button', t('shop.exchangeOne'));
    exchangeOne.type = 'button';
    exchangeOne.disabled = pearls < 1;
    exchangeOne.addEventListener('click', () => {
      world.exchangePearls(1);
      this.renderShop();
    });
    const exchangeAll = element('button', 'pc-buy-button', t('shop.exchangeAll', { pearls }));
    exchangeAll.type = 'button';
    exchangeAll.disabled = pearls < 1;
    exchangeAll.addEventListener('click', () => {
      world.exchangePearls(pearls);
      this.renderShop();
    });
    actions.append(exchangeOne, exchangeAll);
    container.append(actions, element('h2', undefined, t('shop.growingFish')));

    const growing = world.fish.filter((fish) => !fish.leaving && !fish.isGrown);
    if (growing.length === 0) {
      container.append(element('p', 'pc-no-orders', t('shop.noGrowingFish')));
      return container;
    }

    const list = element('div', 'pc-growing-list');
    for (const fish of growing) {
      const remaining = Math.max(0, fish.species.growSeconds - fish.ageSeconds);
      const cost = world.skipCost(remaining);
      const row = element('article', 'pc-growing-row');
      const details = element('div', 'pc-catalog-details');
      details.append(
        element('strong', undefined, t(fish.species.name as StringKey)),
        element(
          'span',
          'pc-catalog-stat',
          t('shop.growthRemaining', {
            time: formatRemainingTime(remaining),
          }),
        ),
      );
      const skip = element('button', 'pc-skip-button', t('shop.skipPearls', { pearls: cost }));
      skip.type = 'button';
      skip.disabled = pearls < cost;
      skip.addEventListener('click', () => {
        world.skipFishGrowth(fish.id);
        this.renderShop();
      });
      row.append(details, skip);
      list.append(row);
    }
    container.append(list);
    return container;
  }

  private appendItemOrMaximum(
    catalog: HTMLElement,
    item: OrderItem | undefined,
    maximumItem: OrderItem,
  ): void {
    if (item) {
      catalog.append(this.renderItemRow(item));
      return;
    }
    const presentation = presentItem(this.options.content, maximumItem);
    if (presentation) catalog.append(this.renderMaximumRow(presentation));
  }

  private renderItemRow(item: OrderItem): HTMLElement {
    const presentation = presentItem(this.options.content, item);
    const row = element('article', 'pc-catalog-row');
    if (!presentation) return row;
    this.appendImage(row, presentation.icon, presentation.name);
    const details = this.renderItemDetails(presentation);
    const canOrder = this.options.world.canOrderItem(item);
    const canAfford = this.options.world.wallet.get('coins') >= presentation.price;
    const buttonKey: StringKey = !canOrder
      ? 'shop.unavailable'
      : canAfford
        ? 'shop.buy'
        : 'shop.notEnough';
    const buy = element('button', 'pc-buy-button', t(buttonKey));
    buy.type = 'button';
    buy.disabled = !canOrder || !canAfford;
    buy.addEventListener('click', () => {
      this.options.world.orderItem(item, this.options.now());
      this.renderShop();
    });
    row.append(details, buy);
    return row;
  }

  private renderMaximumRow(presentation: ItemPresentation): HTMLElement {
    const row = element('article', 'pc-catalog-row');
    this.appendImage(row, presentation.icon, presentation.name);
    const details = element('div', 'pc-catalog-details');
    details.append(
      element('strong', 'pc-catalog-name', presentation.name),
      element('span', 'pc-catalog-level', t('shop.maximum')),
    );
    for (const stat of presentation.stats) {
      details.append(element('span', 'pc-catalog-stat', stat));
    }
    const maximum = element('button', 'pc-buy-button', t('shop.maximum'));
    maximum.type = 'button';
    maximum.disabled = true;
    row.append(details, maximum);
    return row;
  }

  private renderItemDetails(presentation: ItemPresentation): HTMLElement {
    const details = element('div', 'pc-catalog-details');
    details.append(element('strong', 'pc-catalog-name', presentation.name));
    if (presentation.level) {
      details.append(element('span', 'pc-catalog-level', presentation.level));
    }
    for (const stat of presentation.stats) {
      details.append(element('span', 'pc-catalog-stat', stat));
    }
    details.append(
      element('span', 'pc-catalog-price', t('shop.price', { price: presentation.price })),
      element(
        'span',
        'pc-catalog-delivery',
        t('shop.deliveryTime', {
          time: formatRemainingTime(presentation.deliverySeconds),
        }),
      ),
    );
    return details;
  }

  private appendImage(parent: HTMLElement, textureKey: string, alt: string): void {
    const texture = this.options.content.art.textures[textureKey];
    if (texture?.kind !== 'image') return;
    const image = element('img', 'pc-catalog-image');
    image.src = texture.file;
    image.alt = alt;
    parent.append(image);
  }

  private nextUpgrade(track: UpgradeTrack): OrderItem | undefined {
    const held = this.heldItem((item) => item.kind === 'upgrade' && item.track === track);
    if (held) return held;
    const levels = this.options.content.upgrades[track].levels;
    for (let level = 2; level <= levels.length; level++) {
      const item: OrderItem = { kind: 'upgrade', track, level };
      if (this.options.world.canOrderItem(item)) return item;
    }
    return undefined;
  }

  private nextBattery(): OrderItem | undefined {
    const held = this.heldItem((item) => item.kind === 'battery');
    if (held) return held;
    const definitions = this.options.content.upgrades.batteries;
    const current = definitions.findIndex(
      (definition) => definition.capacity === this.options.world.robot.battery.capacity,
    );
    const next = definitions[current + 1];
    return next && { kind: 'battery', id: next.id };
  }

  private nextCharger(): OrderItem | undefined {
    const held = this.heldItem((item) => item.kind === 'charger');
    if (held) return held;
    const definitions = this.options.content.upgrades.chargers;
    const current = definitions.findIndex(
      (definition) => !this.options.world.canOrderItem({ kind: 'charger', id: definition.id }),
    );
    const next = definitions[current + 1];
    return next && { kind: 'charger', id: next.id };
  }

  private nextDevice(type: DeviceType): OrderItem | undefined {
    const held = this.heldItem((item) => item.kind === 'device' && item.type === type);
    if (held) return held;
    const level =
      (this.options.world.devices.find((device) => device.type === type)?.level ?? 0) + 1;
    return this.options.content.upgrades.devices[type].levels[level - 1]
      ? { kind: 'device', type, level }
      : undefined;
  }

  private heldItem(predicate: (item: OrderItem) => boolean): OrderItem | undefined {
    for (const order of this.options.world.orders) {
      if (!isFishOrder(order) && predicate(order.item)) return order.item;
    }
    return this.options.world.items.find(({ item }) => predicate(item))?.item;
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
    const pearls = world.wallet.get('pearls');
    const list = element('ul', 'pc-order-list');
    for (const order of world.orders) {
      const row = element('li');
      if (isFishOrder(order)) {
        const species = content.fish.species.find((candidate) => candidate.id === order.speciesId);
        if (!species) continue;
        row.append(element('span', 'pc-order-name', t(species.name as StringKey)));
      } else {
        const presentation = presentItem(content, order.item);
        if (!presentation) continue;
        const name = element('span', 'pc-order-name', presentation.name);
        if (order.item.kind === 'upgrade' || order.item.kind === 'device') {
          name.append(element('small', undefined, t('shop.level', { level: order.item.level })));
        }
        row.append(name);
      }

      if (isDone(order.timer, current)) {
        row.append(element('span', 'pc-order-status', t('shop.arrived')));
      } else {
        const remaining = remainingSeconds(order.timer, current);
        const cost = world.skipCost(remaining);
        row.append(
          element(
            'span',
            'pc-order-status',
            t('shop.remaining', {
              time: formatRemainingTime(remaining),
            }),
          ),
        );
        const skip = element(
          'button',
          'pc-skip-button',
          t('shop.skipPearls', {
            pearls: cost,
          }),
        );
        skip.type = 'button';
        skip.disabled = pearls < cost;
        skip.addEventListener('click', () => {
          world.skipOrder(order.id, this.options.now());
          this.renderShop();
        });
        row.append(skip);
      }
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
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}
