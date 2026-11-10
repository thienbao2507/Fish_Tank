import type { ZodType } from 'zod';
import type { Strings } from '../i18n';
import { blockedBy } from '../sim/obstacles';
import { floorAt } from '../sim/terrain';
import {
  artSchema,
  balanceSchema,
  fishSchema,
  musicSchema,
  soundsSchema,
  stringsSchema,
  trashSchema,
  upgradesSchema,
  zonesSchema,
  type ArtManifest,
  type Balance,
  type FishCatalog,
  type MusicCatalog,
  type SoundCatalog,
  type TrashCatalog,
  type Upgrades,
  type ZoneDef,
} from './schemas';

/** Dữ liệu thô (chưa kiểm tra) của từng file trong src/data. */
export interface RawContent {
  readonly strings: unknown;
  readonly art: unknown;
  readonly sounds: unknown;
  readonly music: unknown;
  readonly balance: unknown;
  readonly zones: unknown;
  readonly trash: unknown;
  readonly fish: unknown;
  readonly upgrades: unknown;
}

/** Dữ liệu đã kiểm tra, dùng trong toàn game. */
export interface Content {
  readonly strings: Strings;
  readonly art: ArtManifest;
  readonly sounds: SoundCatalog;
  readonly music: MusicCatalog;
  readonly balance: Balance;
  readonly zones: readonly ZoneDef[];
  readonly trash: TrashCatalog;
  readonly fish: FishCatalog;
  readonly upgrades: Upgrades;
}

export class ContentError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Dữ liệu game không hợp lệ:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'ContentError';
    this.issues = issues;
  }
}

function parseFile<T>(
  file: string,
  schema: ZodType<T>,
  data: unknown,
  issues: string[],
): T | undefined {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    const path = issue.path.length > 0 ? issue.path.map(String).join('.') : '(gốc)';
    issues.push(`${file} › ${path}: ${issue.message}`);
  }
  return undefined;
}

function findDuplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of ids) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

/** Kiểm tra liên kết giữa các file và các ràng buộc mà schema từng file không diễn tả được. */
function crossCheck(content: Content, issues: string[]): void {
  const textureKeys = new Set(Object.keys(content.art.textures));
  const trashIds = new Set(content.trash.types.map((type) => type.id));

  for (const duplicate of findDuplicates(content.trash.types.map((type) => type.id))) {
    issues.push(`trash.json › types: id "${duplicate}" bị trùng`);
  }
  content.trash.types.forEach((type, index) => {
    if (!textureKeys.has(type.texture)) {
      issues.push(
        `trash.json › types.${index}.texture: không có texture "${type.texture}" trong art.json`,
      );
    }
  });

  for (const duplicate of findDuplicates(content.zones.map((zone) => zone.id))) {
    issues.push(`zones.json › zones: id "${duplicate}" bị trùng`);
  }
  content.zones.forEach((zone, index) => {
    const at = `zones.json › zones.${index}`;
    if (!(zone.surfaceY < zone.floorY && zone.floorY <= zone.height)) {
      issues.push(`${at}: cần surfaceY < floorY ≤ height`);
    }
    let terrainValid = true;
    zone.terrain?.forEach(([x], terrainIndex) => {
      if (x < 0 || x > zone.width) {
        issues.push(`${at}.terrain.${terrainIndex}.0: x phải nằm trong [0, ${zone.width}]`);
        terrainValid = false;
      }
      if (terrainIndex > 0 && x <= (zone.terrain?.[terrainIndex - 1]?.[0] ?? x)) {
        issues.push(`${at}.terrain.${terrainIndex}.0: x phải tăng dần`);
        terrainValid = false;
      }
    });

    const { station, robotSpawn } = zone;
    const obstacles = zone.obstacles ?? [];
    const deviceSlots = zone.deviceSlots ?? [];
    obstacles.forEach((obstacle, obstacleIndex) => {
      if (
        obstacle.x - obstacle.width / 2 < 0 ||
        obstacle.x + obstacle.width / 2 > zone.width ||
        obstacle.y - obstacle.height / 2 < zone.surfaceY ||
        obstacle.y + obstacle.height / 2 > zone.floorY
      ) {
        issues.push(`${at}.obstacles.${obstacleIndex}: vật cản nằm ngoài khu`);
      }
    });
    if (
      station.x < 0 ||
      station.y < 0 ||
      station.x + station.width > zone.width ||
      station.y + station.height > zone.height
    ) {
      issues.push(`${at}.station: trạm nằm ngoài khu`);
    }
    if (
      blockedBy(
        obstacles,
        station.x + station.width / 2,
        station.y + station.height / 2,
        station.width / 2,
        station.height / 2,
      )
    ) {
      issues.push(`${at}.station: trạm nằm trong vật cản`);
    }
    if (terrainValid) {
      const stationXs = [
        station.x,
        ...(zone.terrain ?? [])
          .map(([x]) => x)
          .filter((x) => x > station.x && x < station.x + station.width),
        station.x + station.width,
      ];
      if (stationXs.some((x) => floorAt(zone, x) !== zone.floorY)) {
        issues.push(`${at}.station: mặt đáy trong khoảng x của trạm phải bằng floorY`);
      }
    }
    if (
      robotSpawn.x < 0 ||
      robotSpawn.x > zone.width ||
      robotSpawn.y < zone.surfaceY ||
      (terrainValid &&
        robotSpawn.y > floorAt(zone, robotSpawn.x) - content.balance.robot.halfHeight)
    ) {
      issues.push(`${at}.robotSpawn: điểm xuất phát phải nằm trong nước`);
    }
    if (blockedBy(obstacles, robotSpawn.x, robotSpawn.y, 0, 0)) {
      issues.push(`${at}.robotSpawn: điểm xuất phát nằm trong vật cản`);
    }
    if (zone.id === 'zone1' && deviceSlots.length !== 6) {
      issues.push(`${at}.deviceSlots: zone1 phải có đúng 6 vị trí`);
    }
    deviceSlots.forEach((slot, slotIndex) => {
      const slotAt = `${at}.deviceSlots.${slotIndex}`;
      if (slot.x < 0 || slot.x > zone.width || slot.y < zone.surfaceY || slot.y > zone.floorY) {
        issues.push(`${slotAt}: vị trí phải nằm trong khu`);
      }
      if (blockedBy(obstacles, slot.x, slot.y, 0, 0)) {
        issues.push(`${slotAt}: vị trí nằm trong vật cản`);
      }
      if (
        slot.x >= station.x &&
        slot.x <= station.x + station.width &&
        slot.y >= station.y &&
        slot.y <= station.y + station.height
      ) {
        issues.push(`${slotAt}: vị trí nằm trong trạm`);
      }
      for (let otherIndex = 0; otherIndex < slotIndex; otherIndex++) {
        const other = deviceSlots[otherIndex];
        if (other && Math.hypot(slot.x - other.x, slot.y - other.y) < 80) {
          issues.push(`${slotAt}: phải cách vị trí ${otherIndex} ít nhất 80`);
        }
      }
    });
    if (zone.trash.initialCount > zone.trash.maxCount) {
      issues.push(`${at}.trash: initialCount không được lớn hơn maxCount`);
    }
    if (Object.keys(zone.trash.weights).length === 0) {
      issues.push(`${at}.trash.weights: cần ít nhất một loại rác`);
    }
    for (const trashId of Object.keys(zone.trash.weights)) {
      if (!trashIds.has(trashId)) {
        issues.push(
          `${at}.trash.weights.${trashId}: không có loại rác "${trashId}" trong trash.json`,
        );
      }
    }
  });

  if (!content.zones.some((zone) => zone.id === content.balance.startZone)) {
    issues.push(
      `balance.json › startZone: không có khu "${content.balance.startZone}" trong zones.json`,
    );
  }

  const speciesIds = new Set(content.fish.species.map((species) => species.id));
  for (const duplicate of findDuplicates(content.fish.species.map((species) => species.id))) {
    issues.push(`fish.json › species: id "${duplicate}" bị trùng`);
  }
  content.fish.species.forEach((species, index) => {
    if (!textureKeys.has(species.texture)) {
      issues.push(
        `fish.json › species.${index}.texture: không có texture "${species.texture}" trong art.json`,
      );
    }
    if (content.strings[species.name] === undefined) {
      issues.push(
        `fish.json › species.${index}.name: không có chuỗi "${species.name}" trong strings.vi.json`,
      );
    }
  });
  content.balance.startingFish.forEach((entry, index) => {
    if (!speciesIds.has(entry.species)) {
      issues.push(
        `balance.json › startingFish.${index}.species: không có loài "${entry.species}" trong fish.json`,
      );
    }
  });

  const { upgrades } = content;
  const namedItems = [
    upgrades.cargo,
    upgrades.speed,
    upgrades.vacuum,
    ...upgrades.batteries,
    ...upgrades.chargers,
    ...upgrades.powerBanks,
    ...Object.values(upgrades.devices),
  ];
  namedItems.forEach((item, index) => {
    if (content.strings[item.name] === undefined) {
      issues.push(
        `upgrades.json › item.${index}.name: không có chuỗi "${item.name}" trong strings.vi.json`,
      );
    }
    if (!textureKeys.has(item.icon)) {
      issues.push(
        `upgrades.json › item.${index}.icon: không có texture "${item.icon}" trong art.json`,
      );
    }
  });
  for (const duplicate of findDuplicates(upgrades.batteries.map((item) => item.id))) {
    issues.push(`upgrades.json › batteries: id "${duplicate}" bị trùng`);
  }
  for (const duplicate of findDuplicates(upgrades.chargers.map((item) => item.id))) {
    issues.push(`upgrades.json › chargers: id "${duplicate}" bị trùng`);
  }
  for (const duplicate of findDuplicates(upgrades.powerBanks.map((item) => item.id))) {
    issues.push(`upgrades.json › powerBanks: id "${duplicate}" bị trùng`);
  }

  const firstCargo = upgrades.cargo.levels[0];
  const firstSpeed = upgrades.speed.levels[0];
  const firstVacuum = upgrades.vacuum.levels[0];
  const firstBattery = upgrades.batteries.find((item) => item.id === 'S');
  const firstCharger = upgrades.chargers.find((item) => item.id === 'basic');
  if (firstCargo?.capacity !== content.balance.robot.cargoCapacity) {
    issues.push('upgrades.json › cargo.levels.0.capacity: phải khớp balance.robot.cargoCapacity');
  }
  if (firstSpeed?.maxSpeed !== content.balance.robot.maxSpeed) {
    issues.push('upgrades.json › speed.levels.0.maxSpeed: phải khớp balance.robot.maxSpeed');
  }
  if (
    firstVacuum?.radius !== content.balance.robot.vacuum.radius ||
    firstVacuum.pullSpeed !== content.balance.robot.vacuum.pullSpeed
  ) {
    issues.push('upgrades.json › vacuum.levels.0: phải khớp balance.robot.vacuum');
  }
  if (firstBattery?.capacity !== content.balance.robot.batteryCapacity) {
    issues.push('upgrades.json › batteries.S.capacity: phải khớp balance.robot.batteryCapacity');
  }
  if (firstCharger?.chargePerSecond !== content.balance.station.chargePerSecond) {
    issues.push('upgrades.json › chargers.basic.chargePerSecond: phải khớp balance.station');
  }
}

/** Kiểm tra toàn bộ dữ liệu; gom lỗi của mọi file rồi ném một ContentError duy nhất. */
export function loadContent(raw: RawContent): Content {
  const issues: string[] = [];
  const strings = parseFile('strings.vi.json', stringsSchema, raw.strings, issues);
  const art = parseFile('art.json', artSchema, raw.art, issues);
  const sounds = parseFile('sounds.json', soundsSchema, raw.sounds, issues);
  const music = parseFile('music.json', musicSchema, raw.music, issues);
  const balance = parseFile('balance.json', balanceSchema, raw.balance, issues);
  const zones = parseFile('zones.json', zonesSchema, raw.zones, issues);
  const trash = parseFile('trash.json', trashSchema, raw.trash, issues);
  const fish = parseFile('fish.json', fishSchema, raw.fish, issues);
  const upgrades = parseFile('upgrades.json', upgradesSchema, raw.upgrades, issues);

  if (!strings || !art || !sounds || !music || !balance || !zones || !trash || !fish || !upgrades) {
    throw new ContentError(issues);
  }

  const content: Content = {
    strings,
    art,
    sounds,
    music,
    balance,
    zones: zones.zones,
    trash,
    fish,
    upgrades,
  };
  crossCheck(content, issues);
  if (issues.length > 0) {
    throw new ContentError(issues);
  }
  return content;
}
