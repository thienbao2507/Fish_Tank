import { z } from 'zod';

// Dùng strictObject: gõ sai tên trường trong JSON (vd. "colour") sẽ bị báo lỗi thay vì bị bỏ qua.

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Màu phải có dạng #rrggbb');
const positive = z.number().positive();
const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().min(0);
const alpha = z.number().min(0).max(1).optional();
const id = z.string().min(1);

// ---------- art.json ----------

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
    width: positiveInt,
    height: positiveInt,
    parts: z.array(shapePartSchema).min(1),
  }),
  z.strictObject({
    kind: z.literal('verticalGradient'),
    width: positiveInt,
    height: positiveInt,
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

// ---------- strings.vi.json ----------

export const stringsSchema = z.record(z.string(), z.string());

// ---------- balance.json ----------

export const balanceSchema = z.strictObject({
  startZone: id,
  startingCoins: nonNegativeInt,
  startingPearls: nonNegativeInt,
  robot: z.strictObject({
    /** Nửa kích thước hộp va chạm (px) — dùng để giữ robot trong nước. */
    halfWidth: positive,
    halfHeight: positive,
    maxSpeed: positive,
    acceleration: positive,
    deceleration: positive,
    batteryCapacity: positive,
    cargoCapacity: positiveInt,
    vacuum: z.strictObject({
      radius: positive,
      pullSpeed: positive,
      collectRadius: positive,
      drainPerSecond: positive,
    }),
  }),
  station: z.strictObject({
    chargePerSecond: positive,
  }),
});

// ---------- trash.json ----------

export const trashLayerSchema = z.enum(['float', 'mid', 'sink']);

export const trashTypeSchema = z.strictObject({
  id,
  /** Khoá texture trong art.json. */
  texture: id,
  /** float: nổi sát mặt nước · mid: lơ lửng giữa nước · sink: chìm xuống đáy. */
  layer: trashLayerSchema,
  /** Số xu nhận được khi tái chế. */
  value: nonNegativeInt,
  /** Số ô chiếm trong khoang. */
  slots: positiveInt,
  /** Bán kính (px) dùng để đặt vị trí và tính khoảng cách hút. */
  radius: positive,
});

export const trashSchema = z.strictObject({
  sinkSpeed: positive,
  driftSpeed: z.number().min(0),
  types: z.array(trashTypeSchema).min(1),
});

// ---------- zones.json ----------

const point = z.strictObject({ x: z.number(), y: z.number() });
const rect = z.strictObject({ x: z.number(), y: z.number(), width: positive, height: positive });

export const zoneSchema = z.strictObject({
  id,
  width: positiveInt,
  height: positiveInt,
  /** Mặt nước (y). Phía trên là không khí. */
  surfaceY: z.number().min(0),
  /** Mặt cát (y). Phía dưới là đáy cát. */
  floorY: positive,
  /** Bề dày thành bể hai bên (px). */
  wallWidth: z.number().min(0),
  station: rect,
  robotSpawn: point,
  trash: z.strictObject({
    initialCount: nonNegativeInt,
    maxCount: positiveInt,
    spawnIntervalSeconds: positive,
    /** Tỉ trọng sinh của từng loại rác (id trong trash.json). */
    weights: z.record(z.string(), positive),
  }),
});

export const zonesSchema = z.strictObject({
  zones: z.array(zoneSchema).min(1),
});

export type ShapePart = z.infer<typeof shapePartSchema>;
export type TextureDef = z.infer<typeof textureDefSchema>;
export type ArtManifest = z.infer<typeof artSchema>;
export type Balance = z.infer<typeof balanceSchema>;
export type TrashLayer = z.infer<typeof trashLayerSchema>;
export type TrashTypeDef = z.infer<typeof trashTypeSchema>;
export type TrashCatalog = z.infer<typeof trashSchema>;
export type ZoneDef = z.infer<typeof zoneSchema>;
