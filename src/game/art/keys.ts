/**
 * Khoá texture mà code game dùng trực tiếp. Mỗi khoá phải có bản ghi trong src/data/art.json
 * (Preload kiểm tra). Texture của rác và cá lấy theo trường `texture` trong trash.json / fish.json.
 */
export const TextureKeys = {
  water: 'bg.water',
  air: 'env.air',
  surface: 'env.surface',
  sand: 'env.sand',
  wall: 'env.wall',
  station: 'station',
  robot: 'robot',
  foodPellet: 'food.pellet',
  dropCoin: 'drop.coin',
  dropPearl: 'drop.pearl',
  alert: 'icon.alert',
  button: 'ui.button',
  buttonOn: 'ui.button.on',
  iconVacuum: 'icon.vacuum',
  iconFood: 'icon.food',
  iconMedicine: 'icon.medicine',
  iconWater: 'icon.water',
  iconCoin: 'icon.coin',
  iconPearl: 'icon.pearl',
  iconCargo: 'icon.cargo',
} as const;
