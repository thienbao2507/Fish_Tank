import type { ZodType } from 'zod';
import type { Strings } from '../i18n';
import {
  artSchema,
  balanceSchema,
  stringsSchema,
  trashSchema,
  zonesSchema,
  type ArtManifest,
  type Balance,
  type TrashCatalog,
  type ZoneDef,
} from './schemas';

/** Dữ liệu thô (chưa kiểm tra) của từng file trong src/data. */
export interface RawContent {
  readonly strings: unknown;
  readonly art: unknown;
  readonly balance: unknown;
  readonly zones: unknown;
  readonly trash: unknown;
}

/** Dữ liệu đã kiểm tra, dùng trong toàn game. */
export interface Content {
  readonly strings: Strings;
  readonly art: ArtManifest;
  readonly balance: Balance;
  readonly zones: readonly ZoneDef[];
  readonly trash: TrashCatalog;
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
    const { station, robotSpawn } = zone;
    if (
      station.x < 0 ||
      station.y < 0 ||
      station.x + station.width > zone.width ||
      station.y + station.height > zone.height
    ) {
      issues.push(`${at}.station: trạm nằm ngoài khu`);
    }
    if (
      robotSpawn.x < 0 ||
      robotSpawn.x > zone.width ||
      robotSpawn.y < zone.surfaceY ||
      robotSpawn.y > zone.floorY
    ) {
      issues.push(`${at}.robotSpawn: điểm xuất phát phải nằm trong nước`);
    }
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
}

/** Kiểm tra toàn bộ dữ liệu; gom lỗi của mọi file rồi ném một ContentError duy nhất. */
export function loadContent(raw: RawContent): Content {
  const issues: string[] = [];
  const strings = parseFile('strings.vi.json', stringsSchema, raw.strings, issues);
  const art = parseFile('art.json', artSchema, raw.art, issues);
  const balance = parseFile('balance.json', balanceSchema, raw.balance, issues);
  const zones = parseFile('zones.json', zonesSchema, raw.zones, issues);
  const trash = parseFile('trash.json', trashSchema, raw.trash, issues);

  if (!strings || !art || !balance || !zones || !trash) {
    throw new ContentError(issues);
  }

  const content: Content = { strings, art, balance, zones: zones.zones, trash };
  crossCheck(content, issues);
  if (issues.length > 0) {
    throw new ContentError(issues);
  }
  return content;
}
