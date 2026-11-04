import { z } from 'zod';

// Dùng strictObject: gõ sai tên trường trong JSON (vd. "colour") sẽ bị báo lỗi thay vì bị bỏ qua.

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Màu phải có dạng #rrggbb');
const positive = z.number().positive();
const alpha = z.number().min(0).max(1).optional();

export const shapePartSchema = z.discriminatedUnion('shape', [
  z.strictObject({
    shape: z.literal('rect'),
    x: z.number(),
    y: z.number(),
    w: positive,
    h: positive,
    color: hexColor,
    alpha,
  }),
  z.strictObject({
    shape: z.literal('roundRect'),
    x: z.number(),
    y: z.number(),
    w: positive,
    h: positive,
    r: z.number().min(0),
    color: hexColor,
    alpha,
  }),
  z.strictObject({
    shape: z.literal('circle'),
    x: z.number(),
    y: z.number(),
    r: positive,
    color: hexColor,
    alpha,
  }),
  z.strictObject({
    shape: z.literal('ellipse'),
    x: z.number(),
    y: z.number(),
    w: positive,
    h: positive,
    color: hexColor,
    alpha,
  }),
]);

/**
 * Một texture trong game. Prototype dùng `shapes`/`verticalGradient` (vẽ placeholder);
 * khi có asset thật chỉ cần đổi bản ghi đó sang `image` — code game không đổi.
 */
export const textureDefSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('shapes'),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    parts: z.array(shapePartSchema).min(1),
  }),
  z.strictObject({
    kind: z.literal('verticalGradient'),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    from: hexColor,
    to: hexColor,
    /** Số dải màu (kiểu pixel art). Bỏ trống = chuyển màu mượt. */
    steps: z.number().int().min(2).optional(),
  }),
  z.strictObject({
    kind: z.literal('image'),
    file: z.string().min(1),
  }),
]);

export const artSchema = z.strictObject({
  textures: z.record(z.string(), textureDefSchema),
});

export const stringsSchema = z.record(z.string(), z.string());

export type ShapePart = z.infer<typeof shapePartSchema>;
export type TextureDef = z.infer<typeof textureDefSchema>;
export type ArtManifest = z.infer<typeof artSchema>;
