/**
 * Khoá texture mà code game dùng trực tiếp. Mỗi khoá phải có bản ghi trong src/data/art.json
 * (Preload kiểm tra). Texture của rác lấy theo trường `texture` trong trash.json.
 */
export const TextureKeys = {
  water: 'bg.water',
  air: 'env.air',
  surface: 'env.surface',
  sand: 'env.sand',
  wall: 'env.wall',
  station: 'station',
  robot: 'robot',
  button: 'ui.button',
  buttonOn: 'ui.button.on',
  iconVacuum: 'icon.vacuum',
  iconCoin: 'icon.coin',
  iconPearl: 'icon.pearl',
  iconCargo: 'icon.cargo',
} as const;
