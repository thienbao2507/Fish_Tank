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
  z.strictObject({
    kind: z.literal('spritesheet'),
    file: z.string().min(1),
    frameWidth: positiveInt,
    frameHeight: positiveInt,
  }),
]);

export const artSchema = z.strictObject({
  textures: z.record(z.string(), textureDefSchema),
});

// ---------- strings.vi.json ----------

export const stringsSchema = z.record(z.string(), z.string());

// ---------- sounds.json ----------

const soundDefSchema = z.strictObject({
  file: z.string().min(1),
  volume: z.number().min(0).max(1),
  loop: z.boolean(),
  cooldownMs: nonNegativeInt,
});

export const soundsSchema = z.strictObject({
  vacuum: soundDefSchema,
  coin: soundDefSchema,
  pearl: soundDefSchema,
  sell: soundDefSchema,
  feed: soundDefSchema,
  heal: soundDefSchema,
  lane: soundDefSchema,
  warn: soundDefSchema,
  fishSick: soundDefSchema,
  fishLeft: soundDefSchema,
  click: soundDefSchema,
  pause: soundDefSchema,
  buy: soundDefSchema,
  install: soundDefSchema,
  delivery: soundDefSchema,
  door: soundDefSchema,
  ambTank: soundDefSchema,
  ambRoom: soundDefSchema,
});

// ---------- balance.json ----------

const ratio = z.number().min(0).max(1);
const percent = z.number().min(0).max(100);

export const balanceSchema = z.strictObject({
  startZone: id,
  startingCoins: nonNegativeInt,
  startingPearls: nonNegativeInt,
  /** Cá có sẵn khi bắt đầu game mới (thả vào startZone). */
  startingFish: z.array(z.strictObject({ species: id, count: positiveInt })),
  economy: z.strictObject({
    /** Tỉ giá 1 ngọc trai = ? xu (spec 6.2). */
    pearlValueInCoins: positiveInt,
    /** Số giây chờ có thể tua bằng một ngọc trai. */
    skipSecondsPerPearl: positiveInt,
  }),
  absence: z.strictObject({
    /** Thời gian tối đa được tính xu khi rời bể (giây). */
    maxSeconds: positive,
  }),
  water: z.strictObject({
    /** Độ sạch tiến về mức mục tiêu với tốc độ này (% mỗi phút game). */
    changePerMinute: positive,
  }),
  fish: z.strictObject({
    /** Thời gian chuyển hết một tầng nước (giây). */
    laneSwitchSeconds: positive,
    startFullness: percent,
    /** No dưới mức này → đói (Buồn). */
    hungryBelow: percent,
    /** No dưới mức này thì cá đi tìm thức ăn. */
    seekFoodBelow: percent,
    /** Nước dưới mức này → Buồn. */
    sadWaterBelow: percent,
    /** Nước dưới mức này → mất máu. */
    dirtyWaterBelow: percent,
    /** Máu dưới mức này → Ốm. */
    sickHealthBelow: percent,
    /** Mất máu mỗi phút khi nước bẩn hoàn toàn (nhân với độ nhạy của loài). */
    healthLossPerMinute: positive,
    /** Mất máu mỗi phút khi đói lả (No = 0). */
    starvationLossPerMinute: positive,
    /** Hồi máu mỗi phút khi nước không bẩn và cá không đói lả. */
    recoveryPerMinute: positive,
    /** Ốm liên tục bao lâu (giây game) thì cá nhảy khỏi bể. */
    leaveAfterSeconds: positive,
    senseFoodRadius: positive,
    eatRadius: positive,
    /** Tốc độ cá nhảy lên khỏi mặt nước khi bỏ đi (px/giây). */
    jumpSpeed: positive,
    /** Thời gian cá bỏ đi tăng một đơn vị độ cao z (giây). */
    leaveRiseSeconds: positive,
  }),
  lanes: z.strictObject({
    /** Thời gian rác chìm rơi qua mỗi tầng nước (giây). */
    trashFallSeconds: positive,
    /** Thời gian thức ăn rơi qua mỗi tầng nước (giây). */
    foodFallSeconds: positive,
    /** Thời gian xu/ngọc rơi qua mỗi tầng nước (giây). */
    dropFallSeconds: positive,
  }),
  food: z.strictObject({
    price: nonNegativeInt,
    /** Số viên thả ra mỗi lần bấm. */
    pellets: positiveInt,
    /** No tăng thêm khi ăn một viên. */
    nutrition: positive,
    sinkSpeed: positive,
    /** Thức ăn thừa nằm dưới đáy bao lâu thì tan (giây). */
    dissolveSeconds: positive,
    /** Mức ô nhiễm của mỗi viên thức ăn thừa dưới đáy. */
    pollution: z.number().min(0),
    /** Độ toả ngang khi thả (px). */
    spread: z.number().min(0),
  }),
  medicine: z.strictObject({
    price: nonNegativeInt,
    /** Chỉ chữa được cá ốm trong bán kính này quanh robot. */
    radius: positive,
    healTo: percent,
  }),
  drops: z.strictObject({
    sinkSpeed: positive,
    /** Robot chạm trong khoảng nới thêm này quanh thân là nhặt được. */
    pickupMargin: z.number().min(0),
    /** Không nhặt sau chừng này giây → tự cộng một phần. */
    autoCollectSeconds: positive,
    /** Tỉ lệ được cộng khi tự cộng (spec 4.4: 50%). */
    autoCollectRatio: ratio,
  }),
  robot: z.strictObject({
    /** Tỉ lệ hiển thị theo chiều ngang của tàu ngầm. */
    displayScaleX: positive.default(1),
    /** Nửa kích thước hộp va chạm (px) — dùng để giữ robot trong nước. */
    halfWidth: positive,
    halfHeight: positive,
    maxSpeed: positive,
    acceleration: positive,
    deceleration: positive,
    /** Thời gian lặn từ đáy tới mặt nước (giây). */
    diveSeconds: positive,
    /** Chênh lệch độ sâu tối đa để robot tương tác với vật. */
    depthReach: positive,
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
    /** Robot phải sát đáy tới mức này mới đậu hoặc dùng trạm sạc phụ. */
    dockMaxZ: z.number().min(0),
  }),
  devices: z.strictObject({
    auxChargerRadius: positive,
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
  /** Mức ô nhiễm nước mà món rác này gây ra khi còn trong bể. */
  pollution: z.number().min(0),
});

export const trashSchema = z.strictObject({
  sinkSpeed: positive,
  driftSpeed: z.number().min(0),
  types: z.array(trashTypeSchema).min(1),
});

// ---------- zones.json ----------

const point = z.strictObject({ x: z.number(), y: z.number() });
const rect = z.strictObject({ x: z.number(), y: z.number(), width: positive, height: positive });
const obstacle = z.strictObject({
  /** Tâm vật cản trên mặt phẳng. */
  x: z.number(),
  y: z.number(),
  width: positive,
  height: positive,
});

export const zoneSchema = z.strictObject({
  id,
  width: positiveInt,
  height: positiveInt,
  /** Số cá tối đa trong khu. */
  fishCapacity: positiveInt,
  /** Biên trên của mặt phẳng di chuyển. */
  surfaceY: z.number().min(0),
  /** Biên dưới của mặt phẳng di chuyển. */
  floorY: positive,
  /** Các điểm [x, độ nhô] mô tả mặt đáy; độ nhô tính bằng px lên trên floorY. */
  terrain: z.array(z.tuple([z.number(), z.number().min(0).max(36)])).optional(),
  /** Bề dày thành bể hai bên (px). */
  wallWidth: z.number().min(0),
  station: rect,
  robotSpawn: point,
  /** Các vị trí đặt thiết bị có sẵn; tọa độ là điểm chân của sprite. */
  deviceSlots: z.array(point),
  obstacles: z.array(obstacle).optional(),
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

// ---------- fish.json ----------

export const fishSpeciesSchema = z.strictObject({
  id,
  /** Khoá chuỗi tên loài trong strings.vi.json. */
  name: id,
  texture: id,
  /** Giá mua (xu) — dùng ở P3. */
  price: nonNegativeInt,
  /** Thời gian giao từ Peeshop tới cửa (giây). */
  deliverySeconds: positive,
  radius: positive,
  /** Tốc độ bơi (px/giây). */
  speed: positive,
  /** No giảm mỗi phút game. */
  hungerPerMinute: positive,
  /** Độ nhạy với nước bẩn (nhân vào mức mất máu). */
  waterSensitivity: positive,
  /** Cá vui sinh tài nguyên mỗi chừng này giây game. */
  coinIntervalSeconds: positive,
  coinValue: positiveInt,
  /** Xác suất lần sinh đó là ngọc trai thay vì xu. */
  pearlChance: ratio,
  /** Thời gian cá con lớn (giây) — dùng ở P3. */
  growSeconds: positive,
});

export const fishSchema = z.strictObject({
  species: z.array(fishSpeciesSchema).min(1),
});

// ---------- upgrades.json ----------

const purchaseFields = {
  price: nonNegativeInt,
  deliverySeconds: z.number().min(0),
};
const itemFields = {
  /** Khoá chuỗi tên trong strings.vi.json. */
  name: id,
  /** Khoá texture trong art.json. */
  icon: id,
};

const cargoLevelSchema = z.strictObject({
  capacity: positiveInt,
  ...purchaseFields,
});
const speedLevelSchema = z.strictObject({
  maxSpeed: positive,
  ...purchaseFields,
});
const vacuumLevelSchema = z.strictObject({
  radius: positive,
  pullSpeed: positive,
  ...purchaseFields,
});
const batterySchema = z.strictObject({
  id: z.enum(['S', 'M', 'L', 'XL']),
  ...itemFields,
  capacity: positive,
  ...purchaseFields,
});
const chargerSchema = z.strictObject({
  id: z.enum(['basic', 'fast', 'ultra']),
  ...itemFields,
  chargePerSecond: positive,
  ...purchaseFields,
});
const powerBankSchema = z.strictObject({
  id: z.enum(['small', 'large']),
  ...itemFields,
  charge: positive,
  ...purchaseFields,
});

export const upgradesSchema = z.strictObject({
  cargo: z.strictObject({
    ...itemFields,
    levels: z.array(cargoLevelSchema).length(5),
  }),
  speed: z.strictObject({
    ...itemFields,
    levels: z.array(speedLevelSchema).length(5),
  }),
  vacuum: z.strictObject({
    ...itemFields,
    levels: z.array(vacuumLevelSchema).length(5),
  }),
  batteries: z.array(batterySchema).length(4),
  chargers: z.array(chargerSchema).length(3),
  powerBanks: z.array(powerBankSchema).length(2),
  devices: z.strictObject({
    filter: z.strictObject({
      ...itemFields,
      levels: z
        .array(
          z.strictObject({
            pollutionReduction: z.number().min(0).max(1),
            ...purchaseFields,
          }),
        )
        .length(5),
    }),
    feeder: z.strictObject({
      ...itemFields,
      levels: z
        .array(z.strictObject({ intervalSeconds: positive, ...purchaseFields }))
        .length(5),
    }),
    auxCharger: z.strictObject({
      ...itemFields,
      levels: z
        .array(z.strictObject({ chargePerSecond: positive, ...purchaseFields }))
        .length(5),
    }),
    coral: z.strictObject({
      ...itemFields,
      levels: z
        .array(z.strictObject({ sadWaterDrop: positive, ...purchaseFields }))
        .length(5),
    }),
  }),
});

export type ShapePart = z.infer<typeof shapePartSchema>;
export type TextureDef = z.infer<typeof textureDefSchema>;
export type ArtManifest = z.infer<typeof artSchema>;
export type SoundCatalog = z.infer<typeof soundsSchema>;
export type SoundCue = keyof SoundCatalog;
export type Balance = z.infer<typeof balanceSchema>;
export type Upgrades = z.infer<typeof upgradesSchema>;
export type UpgradeTrack = 'cargo' | 'speed' | 'vacuum';
export type BatteryId = Upgrades['batteries'][number]['id'];
export type ChargerId = Upgrades['chargers'][number]['id'];
export type PowerBankId = Upgrades['powerBanks'][number]['id'];
export type DeviceType = keyof Upgrades['devices'];
export type TrashLayer = z.infer<typeof trashLayerSchema>;
export type TrashTypeDef = z.infer<typeof trashTypeSchema>;
export type TrashCatalog = z.infer<typeof trashSchema>;
type ParsedZoneDef = z.infer<typeof zoneSchema>;
/**
 * Loader luôn trả fishCapacity; để optional ở type công khai nhằm giữ tương thích các fixture
 * tối giản cũ vốn chỉ cần một phần hình học của khu.
 */
export type ZoneDef = Omit<ParsedZoneDef, 'fishCapacity' | 'deviceSlots'> & {
  readonly fishCapacity?: ParsedZoneDef['fishCapacity'];
  readonly deviceSlots?: ParsedZoneDef['deviceSlots'];
};
export type FishSpeciesDef = z.infer<typeof fishSpeciesSchema>;
export type FishCatalog = z.infer<typeof fishSchema>;
export type FishRules = Balance['fish'];
export type FoodRules = Balance['food'];
export type DropRules = Balance['drops'];
