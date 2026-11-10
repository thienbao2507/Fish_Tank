import type { Content } from '../core/content/loader';
import { t, type StringKey } from '../core/i18n';
import type { OrderItem } from '../core/world';

export interface ItemPresentation {
  readonly name: string;
  readonly icon: string;
  readonly level?: string;
  readonly stats: readonly string[];
  readonly price: number;
  readonly deliverySeconds: number;
}

/** Chuyển dữ liệu item thành chuỗi UI; luật mua/lắp vẫn hoàn toàn thuộc World. */
export function presentItem(content: Content, item: OrderItem): ItemPresentation | undefined {
  switch (item.kind) {
    case 'upgrade':
      return presentUpgrade(content, item.track, item.level);
    case 'battery': {
      const definition = content.upgrades.batteries.find((candidate) => candidate.id === item.id);
      if (!definition) return undefined;
      const name = t(definition.name as StringKey);
      return {
        name,
        icon: definition.icon,
        level: t('shop.nextType', { type: name }),
        stats: [t('shop.stat.battery', { capacity: definition.capacity })],
        price: definition.price,
        deliverySeconds: definition.deliverySeconds,
      };
    }
    case 'charger': {
      const definition = content.upgrades.chargers.find((candidate) => candidate.id === item.id);
      if (!definition) return undefined;
      const name = t(definition.name as StringKey);
      return {
        name,
        icon: definition.icon,
        level: t('shop.nextType', { type: name }),
        stats: [t('shop.stat.charger', { charge: definition.chargePerSecond })],
        price: definition.price,
        deliverySeconds: definition.deliverySeconds,
      };
    }
    case 'powerBank': {
      const definition = content.upgrades.powerBanks.find((candidate) => candidate.id === item.id);
      if (!definition) return undefined;
      return {
        name: t(definition.name as StringKey),
        icon: definition.icon,
        stats: [t('shop.stat.powerBank', { charge: definition.charge })],
        price: definition.price,
        deliverySeconds: definition.deliverySeconds,
      };
    }
    case 'device':
      return presentDevice(content, item.type, item.level);
  }
}

function presentDevice(
  content: Content,
  type: 'filter' | 'feeder' | 'auxCharger' | 'coral',
  levelNumber: number,
): ItemPresentation | undefined {
  switch (type) {
    case 'filter': {
      const definition = content.upgrades.devices.filter;
      const level = definition.levels[levelNumber - 1];
      return (
        level &&
        devicePresentation(definition, levelNumber, level, [
          t('shop.stat.filter', { percent: Math.round(level.pollutionReduction * 100) }),
        ])
      );
    }
    case 'feeder': {
      const definition = content.upgrades.devices.feeder;
      const level = definition.levels[levelNumber - 1];
      return (
        level &&
        devicePresentation(definition, levelNumber, level, [
          t('shop.stat.feeder', { seconds: level.intervalSeconds }),
        ])
      );
    }
    case 'auxCharger': {
      const definition = content.upgrades.devices.auxCharger;
      const level = definition.levels[levelNumber - 1];
      return (
        level &&
        devicePresentation(definition, levelNumber, level, [
          t('shop.stat.auxCharger', { charge: level.chargePerSecond }),
        ])
      );
    }
    case 'coral': {
      const definition = content.upgrades.devices.coral;
      const level = definition.levels[levelNumber - 1];
      return (
        level &&
        devicePresentation(definition, levelNumber, level, [
          t('shop.stat.coral', { drop: level.sadWaterDrop }),
        ])
      );
    }
  }
}

function devicePresentation(
  definition: { readonly name: string; readonly icon: string },
  levelNumber: number,
  level: { readonly price: number; readonly deliverySeconds: number },
  stats: readonly string[],
): ItemPresentation {
  return {
    name: t(definition.name as StringKey),
    icon: definition.icon,
    level: t('shop.nextLevel', { level: levelNumber }),
    stats,
    price: level.price,
    deliverySeconds: level.deliverySeconds,
  };
}

function presentUpgrade(
  content: Content,
  track: 'cargo' | 'speed' | 'vacuum',
  levelNumber: number,
): ItemPresentation | undefined {
  const levelLabel = t('shop.nextLevel', { level: levelNumber });
  switch (track) {
    case 'cargo': {
      const definition = content.upgrades.cargo;
      const level = definition.levels[levelNumber - 1];
      return (
        level && {
          name: t(definition.name as StringKey),
          icon: definition.icon,
          level: levelLabel,
          stats: [t('shop.stat.capacity', { capacity: level.capacity })],
          price: level.price,
          deliverySeconds: level.deliverySeconds,
        }
      );
    }
    case 'speed': {
      const definition = content.upgrades.speed;
      const level = definition.levels[levelNumber - 1];
      return (
        level && {
          name: t(definition.name as StringKey),
          icon: definition.icon,
          level: levelLabel,
          stats: [t('shop.stat.speed', { speed: level.maxSpeed })],
          price: level.price,
          deliverySeconds: level.deliverySeconds,
        }
      );
    }
    case 'vacuum': {
      const definition = content.upgrades.vacuum;
      const level = definition.levels[levelNumber - 1];
      return (
        level && {
          name: t(definition.name as StringKey),
          icon: definition.icon,
          level: levelLabel,
          stats: [
            t('shop.stat.vacuum', {
              radius: level.radius,
              pullSpeed: level.pullSpeed,
            }),
          ],
          price: level.price,
          deliverySeconds: level.deliverySeconds,
        }
      );
    }
  }
}
