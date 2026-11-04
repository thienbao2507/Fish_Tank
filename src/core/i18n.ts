import type viStrings from '../data/strings.vi.json';

/** Khoá chuỗi hợp lệ, suy ra từ file ngôn ngữ — gõ sai khoá sẽ lỗi lúc typecheck. */
export type StringKey = keyof typeof viStrings;
export type Strings = Readonly<Record<string, string>>;
export type TranslateParams = Readonly<Record<string, string | number>>;

let dictionary: Strings = {};

export function initI18n(strings: Strings): void {
  dictionary = strings;
}

/** Lấy chuỗi hiển thị; `{ten}` trong chuỗi được thay bằng `params.ten`. */
export function t(key: StringKey, params?: TranslateParams): string {
  return translate(dictionary, key, params);
}

export function translate(strings: Strings, key: string, params?: TranslateParams): string {
  const template = strings[key];
  if (template === undefined) return key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
