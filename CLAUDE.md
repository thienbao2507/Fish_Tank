# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dự án

FishTank — game 2D cho mobile (Android trước): người chơi điều khiển robot dọn một bể cá ô nhiễm, chăm sóc cá, nâng cấp và mở rộng bể. Đang làm prototype theo từng giai đoạn.

- Đặc tả đã chốt: `docs/spec.md`
- Kế hoạch, thứ tự task, trạng thái (checkbox): `docs/plan.md` — **nguồn sự thật về việc cần làm**

## Quy trình bắt buộc (chi tiết: `docs/plan.md` mục 1)

- Chỉ làm task có trong `docs/plan.md`, đúng thứ tự; đánh dấu checkbox khi xong. Ý tưởng phát sinh → ghi vào mục Backlog, không tự làm.
- Đổi thiết kế → sửa `docs/spec.md` trước và chờ người dùng duyệt.
- Không thêm dependency khi chưa hỏi.
- Hết mỗi giai đoạn: demo → người dùng duyệt → mới commit (`P<n>: <tóm tắt>`) và sang giai đoạn sau.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server tại http://localhost:5173 (thêm `?debug=1` để bật panel debug và `window.fishtank` = GameContext để soi/chỉnh state từ console) |
| `npm run dev:host` | Như trên, mở cho điện thoại cùng mạng Wi‑Fi |
| `npm run check` | typecheck + lint + test — phải xanh trước khi báo xong task |
| `npm run build` | typecheck rồi build vào `dist/` |
| `npx vitest run src/core/rng.test.ts` | Chạy một file test; thêm `-t "tên test"` để lọc theo tên |
| `npm run format` | Prettier |
| `npm run art` | Sinh lại PNG pixel art vào `public/art/gen/` từ `scripts/art/generate.mjs`; `npm run art -- <file.png>` xuất thêm ảnh xem trước các sprite nhỏ (phóng ×4) |
| `npx pixelbolt <validate\|inspect\|render> <recipe.json>` | Pixelbolt (devDependency ghim `0.12.1`): vẽ sprite từ recipe JSON. Dùng cho props và sinh vật có animation; xuất PNG ở scale 1 vào `public/art/gen/` (spec 12.2) |

## Kiến trúc

- `src/core/` — logic thuần: mô phỏng, kinh tế, thời gian, nạp dữ liệu. ESLint chặn import Phaser, dùng DOM, hoặc import từ `game/ui/debug/platform` trong thư mục này. Mọi luật chơi nằm ở đây và có unit test (`*.test.ts` đặt cạnh file).
- `src/core/world.ts` — `World`: trạng thái một ván chơi (zone, robot, ví, rác `TrashField`, thức ăn `FoodField`, xu/ngọc rơi `DropField`, đàn cá `School`, độ sạch nước) và **toàn bộ luật chơi theo khung hình** (`update(dt, input, timeScale)`: di chuyển → trạm (đổi rác, sạc) → rác → máy hút → thức ăn → nước → cá (nhu cầu, bơi, ăn, sinh xu, bỏ đi) → nhặt/tự cộng xu). Hành động người chơi: `toggleVacuum`, `feed`, `giveMedicine`. Phát `toast`, `station:sold`, `drop:collected`, `fish:healed`, `fish:left` qua `EventBus<GameEvents>` (`src/core/events.ts`). Luật từng phần nằm ở `src/core/sim/*` (movement, battery, cargo, trash, water, food, drops, fish, school). Thêm luật mới vào đây, không viết trong scene.
- `src/game/` — Phaser, chỉ hiển thị và nhận input: `scenes/GameScene` vẽ theo state của World (rác, thức ăn, xu, cá đồng bộ qua `SpriteSync` theo `id`; chữ bay lên khi có event), `scenes/UIScene` (camera không cuộn) chứa HUD (`hud/`: thông số, `ActionButton` Hút/Thức ăn/Thuốc, thông báo, mũi tên chỉ cá ốm), joystick (`input/`), bàn phím, và ghi `ctx.input` mỗi khung hình; `art/` (khoá texture + vẽ placeholder); `env/Background` (toàn bộ môi trường khu theo phong cách HD-2D, spec 12.4: các lớp nền cuộn khác tốc độ, tiền cảnh, cây cỏ và sinh vật phát quang, tia nắng, bong bóng, phù du, nước đục theo độ sạch, viền tối màn hình; công thức theo độ sạch là hàm thuần trong `env/waterVisual.ts`, có test); `env/bloom.ts` (bloom trên camera, chỉ WebGL, bật/tắt qua `game.registry` khoá `BLOOM_KEY`, panel debug có nút); `env/postfx.ts` (tilt-shift + vignette dạng filter camera, cùng mẫu bật/tắt qua registry). Góc nhìn 2.5D hộp bể và thứ tự layer theo spec 12.5: công thức phối cảnh (`depthScale`, `layerPlacement`, `frontGlassAlpha`) là hàm thuần trong `env/perspective.ts`, bóng đổ (`shadowStyle`) trong `env/shadows.ts`, đều có test. Đèn pha tàu ngầm nằm trong `GameScene.syncRobot`.
- `scripts/art/` — công cụ Node (không dependency) vẽ pixel art bằng code và ghi PNG: `lib.mjs` (khung vẽ, dither Bayer, ghi PNG bằng `zlib`), `generate.mjs` (bảng màu `P` theo spec 12.4 + hàm vẽ từng asset, seed cố định).
- `src/ui/` — menu bằng DOM overlay (shop, nhiệm vụ…). HUD và joystick vẽ bằng Phaser trong UIScene.
- `src/platform/` — adapter phụ thuộc nền tảng (storage web ↔ Capacitor).
- `src/debug/` — panel debug DOM, chỉ hiện khi URL có `?debug=1`.
- `src/data/` — mọi số liệu và chuỗi hiển thị, dạng JSON.

Luồng khởi động (`src/main.ts`): `loadContent(rawContent)` kiểm tra toàn bộ JSON bằng zod (schema ở `src/core/content/schemas.ts`; sai → màn hình đỏ ghi `file › đường.dẫn.trường`) → `initI18n` → tạo `GameContext` (content, clock, rng) → `createGame` gắn context vào `game.registry` ở `preBoot`; scene lấy bằng `getContext(this)`.

### Quy ước

- **Thêm file dữ liệu:** thêm schema (`strictObject`) → thêm trường vào `RawContent`/`Content` và `loadContent` → import trong `src/core/content/raw.ts`.
- **Chuỗi hiển thị:** chỉ qua `t('key')`. Kiểu của key suy ra từ `src/data/strings.vi.json`, nên key không tồn tại sẽ lỗi typecheck.
- **Texture:** code chỉ dùng khoá trong `src/game/art/keys.ts` (`keys.test.ts` kiểm mọi khoá có trong art.json). `src/data/art.json` khai báo mỗi khoá là `shapes`/`verticalGradient` (placeholder vẽ lúc chạy) hoặc `image` (PNG trong `public/`). Thay asset = đổi bản ghi JSON, không sửa code.
- **Asset pixel art sinh bằng code:** sửa hàm vẽ trong `scripts/art/generate.mjs` rồi `npm run art`; không sửa tay PNG trong `public/art/gen/` (lần chạy sau sẽ ghi đè). Asset mới: thêm hàm vẽ + tên vào `ASSETS`, bản ghi `image` trong art.json, khoá trong `keys.ts`. Lớp nền đọc chiều cao từ ảnh (`textures.getFrame`), nên đổi kích thước lớp nền không cần sửa code. Màu và độ mờ của lớp nền được vẽ sẵn theo vị trí của lớp trong thế giới: đổi `DISTANT_LIFT` / `RUINS_LIFT` / `ROCKS_SINK` trong `Background.ts` thì sửa cả `LAYOUT` trong `generate.mjs` rồi chạy lại `npm run art`. Blur theo lớp vẽ sẵn vào ảnh (`Pixels.blur`), không dùng filter lúc chạy; chỉ bloom chạy lúc chơi. Ngẫu nhiên trong phần trang trí dùng seed riêng (`DECOR_SEED` trong `Background.ts`), không lấy từ `ctx.rng` để không ảnh hưởng chuỗi ngẫu nhiên của luật chơi.
- **Pixel art / màn hình:** độ phân giải logic cao 360, rộng 640–840 theo tỉ lệ màn hình (`src/config.ts`, `src/game/viewport.ts`; `createGame.ts` gọi `setGameSize` khi có `RESIZE`). Không giả định chiều rộng cố định: đọc `this.scale.width` và nghe `Phaser.Scale.Events.RESIZE` (nhớ `off` khi scene shutdown). `pixelArt: true` đã bật.
- **Placeholder:** chỉ dùng `rect` ở toạ độ nguyên để cạnh sắc (circle/roundRect/ellipse bị khử răng cưa). Kích thước placeholder = kích thước sprite thật.
- **Font:** `UI_FONT_FAMILY` (SVN-Determination Sans, file trong `public/fonts/`, nạp bằng `FontFace` trong `main.ts` trước khi tạo game), cỡ `UI_FONT_SIZE` = 1000/75 ≈ 13,33px theo pixel logic: lưới pixel của font là 75/1000 em nên chỉ cỡ này (hoặc bội số) mới sắc nét; `addPixelText` còn lọc ngưỡng alpha để bỏ mép khử răng cưa. Mọi chữ Phaser tạo qua `addPixelText` (`src/game/hud/text.ts`). Panel debug dùng monospace.
- **Thời gian:** `World.update(dt, input, timeScale)`. Hành động trực tiếp (bơi, hút, pin, rác/thức ăn/xu rơi, cá bơi) dùng `dt` = delta khung hình (giây, GameScene kẹp tối đa 0.1s). Mô phỏng dài hạn (độ sạch nước, nhu cầu cá, chu kỳ sinh xu) dùng `dt × timeScale` — GameScene truyền `ctx.clock.scale` nên tua debug ×10/×100 làm chúng chạy nhanh. Mốc thời gian tuyệt đối (bộ đếm P3, offline P5) đọc `ctx.clock.now()`; không gọi `Date.now()` trong logic.
- **Số liệu gameplay:** `src/data/balance.json` (robot, máy hút, trạm, nước, luật cá, thức ăn, thuốc, xu rơi, cá khởi đầu), `zones.json` (kích thước khu, trạm, cấu hình sinh rác), `trash.json` (loại rác + mức ô nhiễm), `fish.json` (loài cá). Loader kiểm tra chéo giữa các file (id, texture, khoá chuỗi tên cá, startZone, startingFish…).
- **Danh sách vật thể → sprite:** dùng `SpriteSync` (`src/game/SpriteSync.ts`) khớp theo `id`; không tự quản lý Map sprite trong scene.
- **Ngẫu nhiên:** luôn qua `ctx.rng` (có seed) để test tái hiện được.

## Lưu ý kỹ thuật

- Dùng **Phaser 4**, không phải Phaser 3: nhiều API v3 đã đổi hoặc bị bỏ. Trước khi dùng API lạ, tra `node_modules/phaser/skills/<chủ-đề>/SKILL.md` (có `v3-to-v4-migration`). Ví dụ: `Graphics.fillGradientStyle` không vào được `generateTexture`, nên gradient được vẽ bằng canvas texture.
- TypeScript giữ ở 6.0.x vì typescript-eslint chưa hỗ trợ TS ≥ 6.1.
- `vite.config.ts` đặt `base: './'` để bản build chạy được trong WebView của Capacitor (P6).
- `.gitattributes` ép LF (máy phát triển bật `core.autocrlf`).
