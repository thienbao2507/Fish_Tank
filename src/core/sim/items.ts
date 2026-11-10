import type {
  BatteryId,
  ChargerId,
  DeviceType,
  PowerBankId,
  UpgradeTrack,
  Upgrades,
} from '../content/schemas';

export type OrderItem =
  | { readonly kind: 'upgrade'; readonly track: UpgradeTrack; readonly level: number }
  | { readonly kind: 'battery'; readonly id: BatteryId }
  | { readonly kind: 'charger'; readonly id: ChargerId }
  | { readonly kind: 'powerBank'; readonly id: PowerBankId }
  | { readonly kind: 'device'; readonly type: DeviceType; readonly level: number };

export interface ItemOffer {
  readonly name: string;
  readonly price: number;
  readonly deliverySeconds: number;
}

/** Lấy giá/thời gian của đúng món; undefined đồng nghĩa item không có trong catalog. */
export function itemOffer(upgrades: Upgrades, item: OrderItem): ItemOffer | undefined {
  switch (item.kind) {
    case 'upgrade': {
      const track = (upgrades as Partial<Record<UpgradeTrack, Upgrades[UpgradeTrack]>>)[item.track];
      if (!track) return undefined;
      const level = Number.isInteger(item.level) ? track.levels[item.level - 1] : undefined;
      return level && { name: track.name, price: level.price, deliverySeconds: level.deliverySeconds };
    }
    case 'battery': {
      const found = upgrades.batteries.find((candidate) => candidate.id === item.id);
      return found && {
        name: found.name,
        price: found.price,
        deliverySeconds: found.deliverySeconds,
      };
    }
    case 'charger': {
      const found = upgrades.chargers.find((candidate) => candidate.id === item.id);
      return found && {
        name: found.name,
        price: found.price,
        deliverySeconds: found.deliverySeconds,
      };
    }
    case 'powerBank': {
      const found = upgrades.powerBanks.find((candidate) => candidate.id === item.id);
      return found && {
        name: found.name,
        price: found.price,
        deliverySeconds: found.deliverySeconds,
      };
    }
    case 'device': {
      const device = upgrades.devices[item.type];
      if (!device) return undefined;
      const level = Number.isInteger(item.level) ? device.levels[item.level - 1] : undefined;
      return level && {
        name: device.name,
        price: level.price,
        deliverySeconds: level.deliverySeconds,
      };
    }
  }
}

export function itemKey(item: OrderItem): string {
  switch (item.kind) {
    case 'upgrade':
      return `upgrade:${item.track}:${item.level}`;
    case 'device':
      return `device:${item.type}:${item.level}`;
    default:
      return `${item.kind}:${item.id}`;
  }
}

export function sameItem(a: OrderItem, b: OrderItem): boolean {
  return itemKey(a) === itemKey(b);
}

