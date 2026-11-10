# FishTank — Kế hoạch triển khai prototype

> Đặc tả: [spec.md](spec.md). File này là nguồn sự thật về **làm gì, theo thứ tự nào, khi nào là xong**.
> Trạng thái task: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong.

## 1. Quy tắc làm việc (chống "vibe code" lan man)

1. **Chỉ làm task có trong file này**, theo đúng thứ tự giai đoạn. Không làm trước task của giai đoạn sau.
2. **Ý tưởng phát sinh** → ghi vào [Backlog](#6-backlog) kèm lý do. Không làm ngay.
3. **Đổi thiết kế** → sửa `spec.md` trước, được duyệt, rồi mới sửa plan và code.
4. **Không thêm thư viện** ngoài [danh sách công nghệ](#2-quyết-định-kỹ-thuật) khi chưa hỏi.
5. **Mỗi task xong** phải: đạt tiêu chí hoàn thành (AC) của task; `npm run check` xanh; cập nhật trạng thái trong file này.
6. **Mỗi giai đoạn xong**: demo chạy được → người dùng duyệt → commit (message dạng `P1: <tóm tắt>`). Chưa duyệt thì không sang giai đoạn sau.
7. **Logic game nằm trong `src/core/`** (không import Phaser/DOM, có unit test). Scene/entity chỉ lo hiển thị và nhận input.
8. **Không hard-code số liệu** trong code; mọi số liệu ở `src/data/`.
9. **Không hard-code chuỗi hiển thị**; mọi chuỗi qua `t('key')` từ `src/data/strings.vi.json`.
10. Gặp vấn đề làm lệch kế hoạch (task quá lớn, thiết kế không khả thi) → dừng lại, báo và đề xuất cách xử lý, không tự đổi hướng.

## 2. Quyết định kỹ thuật

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| Engine | Phaser **4.2.1** (khóa version) | Bản ổn định mới nhất trên npm |
| Ngôn ngữ | TypeScript, `strict: true` | Bắt lỗi sớm |
| Build / dev server | Vite | Tải lại nhanh, `--host` để test trên điện thoại qua Wi‑Fi |
| Unit test | Vitest | Chạy chung cấu hình với Vite |
| Lint / format | ESLint (typescript-eslint) + Prettier | Có rule chặn `src/core` import Phaser/DOM |
| Kiểm tra dữ liệu | zod | JSON sai → báo lỗi rõ ngay khi tải |
| Vật lý | Tự viết trong `src/core` (chuyển động có quán tính, giới hạn bể, khoảng cách hút) | Test được bằng unit test, đủ cho P1. *(Đổi từ Arcade Physics ở P1; dùng Arcade nếu sau này cần va chạm phức tạp.)* |
| HUD, joystick | Vẽ bằng Phaser (scene UI chạy song song) | Đồng bộ với game, phản hồi chạm nhanh |
| Menu (shop, nhiệm vụ, offline) | DOM overlay (HTML/CSS) | Danh sách, cuộn, chữ dễ làm hơn; chạy tốt trong WebView |
| Độ phân giải logic | Cao 360, rộng 640–840 theo màn hình; `pixelArt: true` (nearest-neighbor) | Pixel art; phóng đúng ×2/×3 trên đa số điện thoại; máy dài không viền đen (spec 12.1) |
| Asset placeholder | Sinh texture bằng `Graphics.generateTexture` theo key, vẽ theo lưới pixel đúng kích thước sprite thật | Thay bằng PNG cùng kích thước chỉ cần đổi `art.json` |
| Font | SVN-Determination Sans (giấy phép chưa xác nhận), file font đóng gói trong `public/fonts/` | Font pixel, đủ dấu tiếng Việt, chạy offline |
| Lưu game | Interface `Storage` → localStorage (web), Capacitor Preferences (Android, P6) | Không phải sửa logic khi lên Android |
| Đóng gói Android | Capacitor (P6) | |

## 3. Kiến trúc

```
src/
  main.ts            # tạo Phaser.Game
  config.ts          # độ phân giải, cờ debug
  core/              # LOGIC THUẦN — không import phaser, không đụng DOM
    content/         # tải + validate dữ liệu (zod), kiểu dữ liệu
    time/            # Clock (giờ thực + hệ số tua debug), Timer, offline
    economy/         # Wallet (xu, ngọc), giá, đổi ngọc
    sim/             # battery, cargo, water, fish, threats
    progress/        # zones unlock, quests, daily gift
    save/            # schema có version, migration
    events.ts        # EventBus có kiểu
    i18n.ts          # t('key')
  game/              # PHASER
    scenes/          # Boot, Preload, Game (vẽ theo World), UI (HUD + điều khiển)
    hud/             # thông số, nút, thông báo
    input/           # joystick ảo
    art/             # khoá texture + bộ sinh texture placeholder
  ui/                # DOM overlay: shop, nhiệm vụ, màn offline
  platform/          # storage adapter (sau: ads/IAP stub)
  debug/             # panel debug
  data/              # JSON: balance, zones, fish, trash, threats, upgrades, items, quests, strings.vi
docs/                # spec.md, plan.md
```

**Luồng dữ liệu:** UIScene đọc joystick/bàn phím → ghi `ctx.input` → GameScene gọi `World.update(dt, input)` (`src/core/world.ts`, toàn bộ luật chơi) → World cập nhật state + phát event → GameScene/HUD vẽ lại theo state.
**Mở rộng nội dung:** thêm khu / loài cá / event = thêm bản ghi JSON (+ asset), không sửa code, trừ khi có cơ chế mới.

## 4. Định nghĩa "xong" (áp dụng mọi task)
- Đạt AC của task.
- `npm run check` (typecheck + lint + test) xanh.
- Không có lỗi trong console trình duyệt khi chơi phần vừa làm.
- Số liệu và chuỗi mới nằm trong `src/data/`.

## 5. Các giai đoạn

### P0 — Khởi tạo
Mục tiêu: dự án chạy được trên PC và điện thoại, có sẵn khung kiến trúc và công cụ kiểm tra.

- [x] **P0-01** Khởi tạo Vite + TypeScript strict + Phaser 4.2.1. Scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `check`.
  AC: `npm run dev` mở trang; `npm run build` thành công.
- [x] **P0-02** Tạo cấu trúc thư mục như mục 3 (thư mục chưa có code được tạo khi task cần tới). ESLint + Prettier; rule cấm `src/core/**` import `phaser` và dùng DOM.
  AC: thêm thử `import Phaser` vào `src/core` → `npm run lint` báo lỗi.
- [~] **P0-03** Màn hình pixel (spec 12.1): cao 360, rộng 640–840 theo tỉ lệ màn hình, `pixelArt: true`; màn hình hẹp hơn 16:9 có viền đen trên dưới; màn hình dọc → lớp phủ "Hãy xoay ngang thiết bị".
  AC: Chrome PC thử 16:9, 20:9, 4:3 → pixel sắc không nhòe, 20:9 không viền đen hai bên, 4:3 có viền trên dưới; điện thoại hiển thị đúng.
  *(PC: đạt cả 3 tỉ lệ. Điện thoại (gồm xoay máy và lớp phủ dọc): chờ người dùng kiểm tra.)*
- [x] **P0-04** Khung scene Boot → Preload → Game + UI (song song). Bộ sinh texture placeholder theo manifest, vẽ theo lưới pixel (robot ~32×20).
  AC: nền gradient phủ đủ chiều rộng hiện tại, một robot placeholder ở giữa, cạnh pixel sắc.
- [x] **P0-05** Nền tảng `core`: Clock (giờ thực + hệ số tua), EventBus có kiểu, RNG có seed, i18n `t()`, content loader + zod.
  AC: unit test cho Clock, RNG; JSON sai kiểu → lỗi chỉ rõ file và trường.
- [x] **P0-06** Panel debug (bật bằng `?debug=1`): FPS, giờ game, tua thời gian ×1/×10/×100.
  *(Điều chỉnh: nút cộng xu/ngọc chuyển sang P1-06, nút xóa save chuyển sang P5-06 — làm khi hệ thống tương ứng đã tồn tại.)*
  AC: không có `?debug=1` thì không hiện.
- [x] **P0-07** `CLAUDE.md` (lệnh, kiến trúc, quy tắc làm việc trỏ về file này), `README.md` ngắn (cách chạy).
  AC: làm theo README chạy được từ máy sạch.
- [x] **P0-08** Font pixel VT323: file font + giấy phép OFL trong `public/fonts/`, nạp xong font mới khởi động game; dùng cho lớp phủ xoay ngang (từ P1, mọi chữ trong game dùng font này; panel debug giữ font monospace). Bổ sung quy ước pixel art vào `CLAUDE.md`.
  AC: chữ tiếng Việt có dấu hiển thị bằng VT323 khi tắt mạng; không có request nào tới máy chủ font bên ngoài.

Demo P0: `npm run dev -- --host` → mở trên Chrome PC và Chrome điện thoại cùng Wi‑Fi.

### P1 — Robot và dọn rác
Mục tiêu: vòng lặp tối thiểu "dọn rác → về trạm → đổi xu".

- [x] **P1-01** Khu 1 (dữ liệu zone): kích thước thế giới, biên bể, mặt nước, đáy cát; camera bám robot, giới hạn trong khu.
  AC: robot không ra ngoài bể; camera không lộ ngoài biên.
- [~] **P1-02** Joystick ảo 8 hướng (nửa trái màn hình, hiện tại chỗ chạm) + WASD/mũi tên cho dev. Robot bơi 8 hướng, có quán tính nhẹ, quay mặt theo hướng.
  AC: điều khiển được trên điện thoại bằng một ngón; nhả tay thì robot trôi chậm lại.
  *(PC: bàn phím + cảm ứng giả lập đạt. Điện thoại thật: chờ người dùng kiểm tra.)*
- [x] **P1-03** Rác: loại rác trong `trash.json` (nổi / lơ lửng / chìm, giá trị xu, số ô chiếm trong khoang). Bộ sinh rác theo khu, có trần số lượng, luôn sinh lại.
  AC: rác ở đúng tầng nước theo loại; dọn hết thì rác sinh lại.
- [x] **P1-04** Pin (`core/sim/battery`) + chế độ hút: nút bật/tắt, bán kính hút, rác bị kéo về robot, hút tốn pin, pin 0 → hút tự tắt.
  AC: unit test pin; trên game, pin giảm chỉ khi hút đang bật.
- [x] **P1-05** Khoang chứa (`core/sim/cargo`): sức chứa theo ô; đầy → ngừng hút + thông báo.
  AC: unit test cargo; HUD hiện `x/y` đúng.
- [x] **P1-06** Trạm tái chế: robot vào vùng trạm → đổi rác thành xu (`core/economy/wallet`), sạc pin (bản đơn giản theo thời gian). Thêm nút debug cộng xu/ngọc.
  AC: unit test wallet (không âm, cộng/trừ đúng); xu tăng đúng tổng giá trị rác.
- [x] **P1-07** HUD: thanh pin, khoang, xu, ngọc; nút Hút có trạng thái bật/tắt rõ ràng. HUD và cụm nút bám mép trái/phải theo chiều rộng thực tế (640–840).
  AC: HUD cập nhật ngay khi giá trị đổi; không che joystick và cụm nút; đúng vị trí ở cả 16:9 và 20:9.

Demo P1: chơi trọn vòng dọn → đổi xu trên điện thoại.

- [x] **P1-Art** Theo yêu cầu ngày 2026-11-04: thay robot placeholder bằng tàu ngầm pixel art theo ảnh mẫu (thân vàng, kính xanh, khung tím), PNG trong suốt 48×48; cập nhật vùng giới hạn di chuyển theo sprite.
  Cập nhật theo phản hồi: kéo ngang thêm 15%, giữ chiều cao; vùng giới hạn 54×46. Lint hai file code thay đổi và 15 test loader/movement đạt; lần chạy check này bị chặn bởi lỗi TS2554 tại `UIScene.ts` đang được sửa đồng thời.
  AC: tải PNG qua manifest, quay mặt theo hướng bơi, không vượt biên bể; `npm run check` và `npm run build` xanh.
  *(Đã tích hợp asset và vùng giới hạn mới; `npm run check` đạt với 109 test, `npm run build` đạt; PNG trả HTTP 200 và có trong bản build. Chưa kiểm tra trực quan trong game do Browser không kết nối và lệnh Chrome bị chặn. Chi tiết asset và prompt: [submarine-art.md](submarine-art.md).)*
  *(Cập nhật 2026-11-09: ảnh vàng/tím ở trên đã được thay bằng tàu navy viền vàng 56×48 có chân vịt quay (spec 12.2, `scripts/art/pixelbolt/`). Đã kiểm tra trực quan trong game bằng ảnh chụp; vùng giới hạn 54×46 giữ nguyên.)*

### P2 — Cá và nước
Mục tiêu: cá sống trong bể, phản ứng với nước bẩn và việc chăm sóc.

- [x] **P2-01** Độ sạch nước theo khu (`core/sim/water`): giảm theo rác, thức ăn thừa (tảo thêm ở P4); tự hồi chậm khi sạch.
  AC: unit test công thức; hiển thị độ sạch trên HUD (tạm thời).
- [x] **P2-02** `fish.json`: 3 loài (giá, tốc độ đói, độ nhạy nước, xu/chu kỳ, tỉ lệ ngọc, thời gian lớn).
  AC: loader validate đủ trường.
- [x] **P2-03** Cá bơi: đi lang thang trong khu, tránh biên, bơi tới thức ăn gần nhất.
  AC: cá không kẹt ở biên/góc; nhìn tự nhiên.
- [x] **P2-04** Máy trạng thái cá (`core/sim/fish`): No, Bệnh, Vui → Buồn → Ốm → cảnh báo + đếm ngược → nhảy khỏi bể; nước sạch thì hồi phục dần.
  AC: unit test mọi chuyển trạng thái; cá nhảy ra có hiệu ứng và bị xóa khỏi save.
- [x] **P2-05** Nút Thức ăn: tốn xu, viên thức ăn chìm dần, cá ăn; thừa rơi xuống đáy → làm bẩn nước, tan sau một thời gian.
  AC: cho ăn quá nhiều làm độ sạch giảm thấy rõ.
- [x] **P2-06** Nút Thuốc: tốn xu, chữa cá ốm gần robot nhất trong bán kính.
  AC: không có cá ốm trong bán kính → nút mờ, không trừ xu.
- [x] **P2-07** Cá vui sinh xu (tỉ lệ nhỏ ra ngọc), rơi ra; robot chạm là nhặt; quá thời gian → tự cộng 50%.
  AC: unit test tỉ lệ (RNG seed) và quy tắc 50%.
  *(Ngọc không nhặt: 1 viên không chia đôi được nên tự cộng 50% giá trị quy ra xu = 500 xu. Chờ người dùng xác nhận.)*
- [x] **P2-08** Cảnh báo: icon trên đầu cá; mũi tên ở mép màn hình khi cá ngoài tầm nhìn.
  AC: mũi tên chỉ đúng hướng, biến mất khi cá vào khung hình.
- [x] **P2-09** Trạng thái khởi đầu game mới (số liệu trong `balance.json`): vài cá loài rẻ ở khu 1, ít xu.
  AC: game mới luôn chơi được ngay.
- [x] **P2-Art** Theo yêu cầu ngày 2026-11-05/06: áp dụng hướng mỹ thuật spec 12.4 cho khu 1 (chi tiết ở spec 12.2 và 12.4).
  - Nền nhiều lớp cuộn khác tốc độ, cây cỏ, tia nắng, vân sáng trên cát, mặt nước gợn, bong bóng, đàn cá hậu cảnh.
  - Nước đục, nắng tắt dần và hạt lơ lửng tăng theo độ sạch nước.
  - Đèn pha tàu ngầm; trạm kiểu xưởng ống đồng; viền tối 1px cho rác, xu, ngọc, thức ăn, cá.
  - Asset là PNG do `scripts/art/generate.mjs` sinh ra (`npm run art`).
  - Cập nhật 2026-11-06, chuyển sang HD-2D theo ảnh mẫu thứ ba:
    - các lớp nền mờ dần theo độ xa và tô theo màu nước;
    - màu ngả xanh dương–tím khi xuống sâu;
    - bloom trên camera (tắt được ở panel debug);
    - tiền cảnh tối, mờ;
    - sứa, san hô, hải quỳ, "đèn biển", phù du phát quang.

  AC: `npm run check` (199 test) và `npm run build` xanh. Đã soát bằng ảnh chụp Chrome headless trên PC (nhiều vị trí camera, nước sạch và bẩn, bloom bật/tắt).
  *(Chưa xem trên điện thoại thật, chưa đo FPS trên máy Android.)*

- [x] **P2-Art-2** Theo yêu cầu ngày 2026-11-06: hệ thống layer và góc nhìn 2.5D hộp bể phối cảnh (spec 12.5).
  - Phòng ngoài, kính sau, sàn lùi xa, thành bên hội tụ về điểm tụ đi theo camera; lớp nền đặt theo độ sâu.
  - Tia nắng, vân sáng mờ và mặt nước vẽ đè lên sinh vật; kính trước rõ dần khi tàu tới gần đầu khu.
  - Bóng đổ cho tàu, cá, rác, xu/ngọc.
  - Tilt-shift, vignette dạng filter camera, có công tắc debug.

  AC: `npm run check` (213 test) và `npm run build` xanh; có test cho các hàm thuần (phối cảnh, bóng đổ, độ rõ kính trước). Đã soát bằng ảnh chụp Chrome headless. *(Chưa xem trên điện thoại, chưa đo FPS; tilt-shift lấy 100 mẫu mỗi pixel, có thể nặng với máy yếu.)*

- [x] **P2-Art-3** Theo yêu cầu ngày 2026-11-06: layer cây cỏ và san hô.
  - Rạn dày gấp 4 lần, khoảng 30 loài sinh vật đáy.
  - Thêm lớp đá tảng gồ ghề.
  - **Mặt đáy lồi lõm** (spec mục 8, đổi cả luật chơi): `src/core/sim/terrain.ts`, `zones.json › terrain`.
  - Tàu ngầm navy viền vàng (Pixelbolt).

  AC: `npm run check` (259 test) và `npm run build` xanh. Đã soát bằng ảnh chụp Chrome headless. *(Chưa xem trên điện thoại, chưa đo FPS: số sprite trang trí tăng nhiều.)*

- [x] **P2-Depth** Theo yêu cầu ngày 2026-11-06: 3 làn sâu cho gameplay (spec 3.1, 12.5).
  - Luật đổi làn, tương tác cùng làn, cá đổi làn theo thức ăn.
  - Nút ▲▼ và phím Q/E; hiển thị phối cảnh theo làn; chỉ báo làn trên HUD.

  AC: `npm run check` và `npm run build` xanh; có test cho luật làn.

- [~] **P2-Iso: task 2.5D** (ghi ngày 2026-11-06). Đổi góc nhìn sang **HD-2D nhìn chéo từ trên xuống** như ảnh mẫu người dùng gửi: camera chúc khoảng 33° (dự kiến ban đầu 40–50°, đã hạ để thấy rõ chiều cao địa hình), đáy bể là mặt đất chính, nhân vật di chuyển trái/phải và xa/gần trên mặt đó.
  - **Bước 1, bản thử (làm trước, chưa đụng luật chơi thật):**
    - một scene riêng dựng đáy bể nhìn chéo: nền cát/đá tilemap 3/4, vài khối san hô và đá đứng trên đất, xếp vẽ theo y;
    - tàu bơi bằng joystick theo trái/phải và xa/gần; độ cao trong nước chỉ thể hiện bằng bóng đổ;
    - giữ hậu kỳ HD-2D (bloom, tilt-shift, vignette) và vân sáng nước.
  - **Bước 1 có thêm:** chụp ảnh và cho người dùng xem trên điện thoại.
  - Tiến độ bước 1 (2026-11-09): bản thử mở bằng `?iso=1` đã có cao nguyên, vách, hang, đền làm điểm nhấn, bóng đổ có hướng, 3 tầng chiều sâu, bố cục tự đặt (`src/game/iso/scenePlan.ts`). Sau đó thêm: bóng tiếp xúc và bóng đổ theo loại vật, tông màu tối, vân sáng dạng sóng, chùm tia nắng. Người dùng xem ảnh chụp và ưng, đã commit `31ee53e` (2026-11-09). Chưa thử joystick, chưa xem trên điện thoại, chưa đo FPS trên máy thật.
  - **Bước 2 (đang làm, người dùng duyệt 2026-11-09, thiết kế ở spec mục 18):**
    - [x] 2a. Luật trong `src/core`: mặt phẳng xa/gần, 3 tầng nước, vật cản, kèm test;
    - [x] 2b. Đưa game thật lên góc nhìn chéo: tàu, rác, cá, xu, trạm, HUD;
    - [~] 2c. Chơi thử, cân lại số liệu;
    - [ ] Sau: vẽ lại cá, rác, tàu theo góc 3/4.
  - Hiện trạng để so sánh: game đang nhìn ngang qua kính bể, trục dọc màn hình là độ cao trong nước, chiều sâu chỉ có 3 làn và parallax.

Demo P2: bỏ bê thì cá buồn → ốm → bỏ đi; chăm tốt thì cá sinh xu.

### PR — Căn phòng (spec 17, thống nhất ngày 2026-11-09)
Mục tiêu: nhân vật người đi lại trong phòng isometric, có ngày/đêm, vào được bể, ngủ được. Phần PC, giao hàng, Kho nằm ở P3. Vào giai đoạn này sau khi P2 đã demo, được duyệt và commit; P2-Iso độc lập, không chặn nhau.

- [x] **PR-01** Bản thử hình ảnh, chưa đụng luật chơi: scene phòng riêng mở bằng tham số URL, tường + sàn isometric, 5 khu đồ vật, nhân vật đi bằng joystick 4 hướng chéo, va chạm với đồ, xếp vẽ theo chiều sâu. Công thức chiếu isometric là hàm thuần có test.
  AC: chụp ảnh và người dùng duyệt (cả trên điện thoại) trước khi làm tiếp.
- [~] **PR-01b** Nâng cấp đồ họa căn phòng (yêu cầu ngày 2026-11-09, spec 17.5). Làm từng bước, xem ảnh rồi mới làm tiếp; không đổi gameplay, góc nhìn, kích thước phòng.
  - [~] Bước 1: góc PC (3 màn hình, case kính quạt RGB, bàn phím, tai nghe, LED).
  - [~] Bước 2: ba lớp ánh sáng, tủ đầu giường và đèn ngủ, chỉnh bloom riêng cho phòng.
  - [~] Bước 3: hồ cá nhiều lớp cảnh.
  - [~] Bước 4: bóng tiếp xúc, ambient occlusion, viền đồng bộ, chất liệu.
  - [~] Bước 5: kệ sách góc trong, chậu cây (có va chạm), mô hình, tranh.
  - [~] Bước 6: soát tỉ lệ, hạ cửa còn khoảng 66px, ảnh trước/sau, đo FPS. Đã hạ cửa và có ảnh ghép trước/sau; chưa xem trong game thật, chưa đo FPS, chờ người dùng duyệt.
  - [~] Bước 7: vòng góp ý 6 mục (góc PC to hơn và nới chân đế bàn đến gy 2, hồ cá dựng lớp theo chiều sâu, vệt phản chiếu trên sàn, giường, tỉ lệ nhân vật và thú bông, thảm và đồ phẳng giữa phòng). Đã xem trong game thật, chờ người dùng duyệt.
- [ ] **PR-02** Đồng hồ ngày/đêm (`src/core/time/`, số trong `balance.json`, đọc `ctx.clock.now()`): cửa sổ đổi trời, nắng ban mai, ánh sáng phòng theo giờ.
  AC: unit test đồng hồ; tua debug thấy trời đổi đủ sáng/trưa/chiều/tối.
- [~] **PR-03** (làm trước PR-02 theo yêu cầu ngày 2026-11-09) Chuyển cảnh phòng ↔ bể (`UIScene` tách HUD phòng/bể, nút hành động theo ngữ cảnh, nút về phòng, mở game vào phòng) và hàm tính vắng mặt trong `src/core/`: cá chỉ sinh xu có trần, không đói, không ốm, không bỏ đi.
  AC: unit test luật vắng mặt; ở phòng một lúc rồi vào bể thì nhận đúng xu tích luỹ, cá không đổi trạng thái.
- [ ] **PR-04** Giường: từ tối mới ngủ được, nhảy tới 6h sáng, cộng xu qua hàm vắng mặt của PR-03. Phần tua bộ đếm nối ở P3-01.
  AC: unit test (ban ngày không ngủ được; thời lượng bỏ qua đúng theo giờ lúc ngủ).

Demo PR: đi trong phòng, ngắm trời đổi qua cửa sổ, vào bể rồi về phòng nhận xu, ngủ qua đêm.

### P3 — Kinh tế và shop
Mục tiêu: có đủ vòng chi tiêu và nâng cấp qua PC trong phòng, có thời gian chờ và tua bằng ngọc.

- [~] **P3-01** (làm phần bộ đếm ngày 2026-11-09; giá tua bằng ngọc để P3-07) Hệ thống bộ đếm (`core/time/timers`): lưu bằng mốc thời gian (bắt đầu + thời lượng), tự hoàn tất khi offline; giá tua bằng ngọc theo thời gian còn lại. Tua được theo một khoảng thời gian để giường (PR-04) dùng.
  AC: unit test (kể cả trường hợp đóng game rồi mở lại sau thời lượng, và ngủ tua bộ đếm).
- [~] **P3-02** (bản cơ bản làm ngày 2026-11-09: desktop retro, icon Peeshop, chỉ bán 3 loài cá, trừ xu và ghi đơn "Đang giao"; chưa có thời gian giao và các tab khác) Trang "web đặt hàng" (DOM overlay), mở ở PC trong phòng; các tab Robot / Thiết bị / Cá / Vật phẩm / Đổi ngọc. Trả xu lúc đặt, mỗi món một thời gian giao trong dữ liệu.
  AC: mở/đóng được trên điện thoại; game tạm dừng khi trang mở; unit test đơn hàng (đủ xu mới đặt được, bộ đếm giao đúng thời lượng).
- [~] **P3-02b** Cửa phòng và Kho: hàng tới thì cửa sáng + thông báo; mở cửa lấy hết hàng đã tới vào Kho; nút Kho trên HUD bể mở được ở mọi chỗ.
  AC: unit test inventory; đặt hàng → chờ/ngủ → mở cửa → thấy hàng trong Kho.
- [~] **P3-03** Nâng cấp Lv1–5 trong `upgrades.json` (giá, thời gian giao, hiệu ứng): khoang chứa, tốc độ bơi, máy hút. Đặt mua linh kiện trên PC, lắp từ Kho có hiệu lực ngay.
  AC: unit test áp dụng hiệu ứng theo cấp; hiệu ứng thấy được trong game.
- [~] **P3-04** Pin theo loại, bộ sạc ở trạm (tốc độ sạc), sạc dự phòng (vật phẩm, dùng từ Kho). Tất cả đặt mua trên PC. Sạc ở trạm thay bằng bản dùng bộ đếm.
  AC: đổi pin thì dung lượng đổi; rời trạm giữa chừng giữ phần đã sạc.
- [~] **P3-05** Thiết bị đặt vào vị trí có sẵn: máy lọc, máy cho ăn tự động, trạm sạc phụ, san hô; Lv1–5. Đặt mua trên PC, chọn vị trí trống từ Kho, lắp xong ngay (thời gian giao thay thời gian lắp).
  AC: mỗi thiết bị có tác động đo được (lọc → nước bẩn chậm hơn; san hô → cá vui hơn…).
- [~] **P3-06** Mua cá: đặt trên PC, thả cá con từ Kho tại chỗ robot, thời gian làm quen/lớn rồi mới sinh xu.
  AC: không thả được khi khu đã đủ sức chứa.
- [~] **P3-07** Đổi ngọc → xu (1:1000) và tua thời gian bằng ngọc.
  AC: unit test; không có đường đổi xu → ngọc.

Demo P3: kiếm xu → nâng cấp → thấy robot/bể tốt lên; tua bằng ngọc hoạt động.

### MN — Menu (yêu cầu ngày 2026-11-10, spec 19)
- [~] **MN-01** Màn tiêu đề (bảng điều khiển, màn hình số liệu bể, cá bơi), menu tạm dừng (nút HUD + Esc), cài đặt hiệu ứng lưu localStorage, trang Hướng dẫn và Thông tin.
  AC: unit test lưu/nạp cài đặt; mở game vào màn tiêu đề; Bắt đầu vào phòng; tạm dừng ở phòng và bể; về màn tiêu đề rồi vào lại vẫn giữ ván.

### P4 — Mối đe dọa
- [ ] **P4-01** Hệ thống event/mối đe dọa theo `threats.json` (khu, lịch, cường độ, thời gian báo trước).
  AC: thêm một event mới chỉ bằng JSON.
- [ ] **P4-02** Đợt rác tràn: báo trước → rác đổ vào khu.
- [ ] **P4-03** Tảo độc: mọc ở điểm định sẵn, lan theo thời gian, giảm độ sạch nước, dọn bằng hút.
- [ ] **P4-04** Sinh vật gây hại: di chuyển, làm cá sợ / lây bệnh.
- [ ] **P4-05** Súng bong bóng: nút Bắn, theo hướng mặt, tốn pin, nhốt sinh vật → nổi lên → biến mất; xuyên qua cá; không tác dụng với tảo.
- [ ] **P4-06** Unit test cho lịch event, lan tảo, lây bệnh.

AC chung P4: bỏ qua mối đe dọa → nước bẩn nhanh hơn, cá buồn; xử lý xong → bể hồi phục.

### P5 — Thế giới và tiến trình
- [ ] **P5-01** 3 khu nối ngang trong `zones.json` (kích thước, rác, mối đe dọa, vị trí thiết bị, sức chứa cá). Camera giới hạn theo khu đã mở.
- [ ] **P5-02** Mở khu: khu trước sạch ≥ X% + trả xu + bộ đếm; cửa thông khu mở ra.
- [ ] **P5-03** Cá cố định trong khu được thả; sức chứa theo khu.
- [ ] **P5-04** Nhiệm vụ: 5–10 nhiệm vụ trong `quests.json`, màn danh sách, nhận thưởng xu/ngọc.
- [ ] **P5-05** Quà hằng ngày.
- [ ] **P5-06** Lưu/tải: tự động lưu (định kỳ, khi app ẩn, sau mỗi giao dịch); schema có version + migration. Thêm nút debug xóa save.
  AC: unit test migration; tải lại trang → trạng thái giữ nguyên.
- [ ] **P5-07** Tiến trình offline: khi mở lại, hoàn tất bộ đếm, cộng xu cá (có trần) bằng hàm tính vắng mặt của PR-03; màn "Trong lúc bạn vắng mặt".
  AC: tắt game, tua bằng debug/giả lập thời gian → kết quả đúng quy tắc offline.

Demo P5: chơi từ game mới tới mở được khu 3; tắt mở lại không mất gì.

### P6 — Hoàn thiện và Android
- [ ] **P6-01** Hiệu ứng âm thanh (hút, bắn, nhặt xu, cảnh báo), nút tắt/bật tiếng, mở khóa audio ở lần chạm đầu.
- [ ] **P6-02** Rà soát `balance.json`, chơi thử và chỉnh số cùng người dùng.
- [ ] **P6-03** Hiệu năng: object pooling cho rác, bong bóng, xu; kiểm tra trên máy Android thật.
- [ ] **P6-04** Capacitor Android: người dùng cài Android Studio + JDK mới (máy hiện có JDK 11, chưa có Android SDK/adb) theo hướng dẫn; thêm platform; storage adapter Capacitor; build APK debug.
- [ ] **P6-05** Hành vi Android: nút Back, tạm dừng khi app vào nền, lưu khi thoát.

Demo P6: cài APK lên máy Android, chơi trọn vòng.

## 6. Backlog
Ý tưởng phát sinh trong lúc làm, **chưa** nằm trong phạm vi. Chỉ đưa vào giai đoạn khi người dùng duyệt.

| Ý tưởng | Lý do | Ngày ghi |
|---|---|---|
| Va chạm cứng với props, méo sóng toàn màn hình, trục sâu trong gameplay | Phần "chưa làm" của bộ luật layer (spec 12.5) | 2026-11-06 |
| Vẽ props (lâu đài, tàu đắm, lũa) và animation cá/tàu bằng Pixelbolt | Pixelbolt 0.12.1 đã cài (spec 12.2) | 2026-11-06 |
| Đèn điểm động chiếu sáng cảnh (đèn pha, đèn trạm, sứa) bằng Lighting của Phaser 4 | Bước tiếp theo của HD-2D; tốn hiệu năng và phải bật lighting cho từng đối tượng | 2026-11-06 |

### Việc đang chờ người dùng quyết định
| Việc | Hiện trạng | Ngày ghi |
|---|---|---|
| Ngọc trai không nhặt, tự cộng sau 25 giây được bao nhiêu? (spec 4.4 ghi "50% giá trị" nhưng 1 viên không chia đôi được) | Đang quy ra xu: 1 ngọc × 1000 × 50% = **500 xu** (`World.collectDrop`). Phương án khác: 50% khả năng được nguyên viên, hoặc ngọc không tự cộng | 2026-11-04 |
| Tầm hút / tầm chữa bệnh sau khi đổi sang tàu ngầm lớn hơn (P1-Art) | Bán kính hút 36px chỉ vươn khỏi thân ~9–13px; tầm thuốc 48px. Chưa chỉnh, chờ người dùng chơi thử rồi quyết (`balance.json › robot.vacuum.radius`, `medicine.radius`) | 2026-11-05 |
| Kiểm tra trên điện thoại thật cho P0-03, P1-02 | Còn `[~]`, đã đạt trên PC + cảm ứng giả lập | 2026-11-05 |
| Duyệt hình ảnh P2-Art (HD-2D) trên điện thoại: màu, độ mờ các lớp, độ mạnh bloom, tiền cảnh, FPS | Đã soát bằng ảnh chụp trên PC. Chỉnh nhanh ở: đầu `Background.ts`, `env/bloom.ts`, `env/waterVisual.ts`; độ mờ/màu lớp nền ở `scripts/art/generate.mjs` | 2026-11-06 |

## 7. Ngoài phạm vi prototype
Xem [spec.md mục 15](spec.md#15-ngoài-phạm-vi-prototype).
