import type { ZodType } from 'zod';
import type { Strings } from '../i18n';
import { artSchema, stringsSchema, type ArtManifest } from './schemas';

/** Dữ liệu thô (chưa kiểm tra) của từng file trong src/data. */
export interface RawContent {
  readonly strings: unknown;
  readonly art: unknown;
}

/** Dữ liệu đã kiểm tra, dùng trong toàn game. */
export interface Content {
  readonly strings: Strings;
  readonly art: ArtManifest;
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

/** Kiểm tra toàn bộ dữ liệu; gom lỗi của mọi file rồi ném một ContentError duy nhất. */
export function loadContent(raw: RawContent): Content {
  const issues: string[] = [];
  const strings = parseFile('strings.vi.json', stringsSchema, raw.strings, issues);
  const art = parseFile('art.json', artSchema, raw.art, issues);
  if (strings === undefined || art === undefined) {
    throw new ContentError(issues);
  }
  return { strings, art };
}
