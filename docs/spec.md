# FishTank — Đặc tả prototype v0.1

> Chốt yêu cầu: 2026-11-04. Mọi thay đổi thiết kế phải sửa file này trước và được duyệt, rồi mới sửa code.
> Kế hoạch triển khai: [plan.md](plan.md).
> Cập nhật 2026-11-04: chốt phong cách pixel art (mục 11, 12, 16).
> Cập nhật 2026-11-05: hướng mỹ thuật (mục 12.4).
> Cập nhật 2026-11-06: áp dụng 12.4 cho khu 1; asset pixel art sinh bằng script (mục 12.2). Chuyển sang phong cách HD-2D: làm mờ theo lớp, bloom, tiền cảnh, màu ngả xanh dương–tím theo độ sâu (mục 12.4).

## 1. Tổng quan

| Mục | Nội dung |
|---|---|
| Thể loại | Quản lý bể cá có hành động, 2D, góc nhìn mặt cắt ngang bể (side view); căn phòng isometric (mục 17) |
| Vai trò người chơi | Một nhân vật người sống trong căn phòng có hồ cá (mua sắm, qua ngày); khi vào hồ thì điều khiển robot dọn bể đang ô nhiễm |
| Nền tảng đích | Android, màn hình ngang (landscape). Giai đoạn phát triển chạy và test trên trình duyệt |
| Mục tiêu trước mắt | Prototype chạy local, core loop hoàn chỉnh |
| Mục tiêu dài hạn | Game thương mại trên store |
| Nhân lực | 1 người (solo) |

## 2. Core loop

Bơi ra khu → bật hút dọn rác → khoang đầy / pin cạn → về trạm: rác đổi thành xu, sạc pin → về phòng đặt hàng trên PC (cá, thiết bị, nâng cấp) → chờ hàng hoặc đi ngủ → mở cửa nhận hàng vào Kho → vào bể thả cá, lắp thiết bị → bể sạch, cá vui sinh xu (đôi khi ngọc trai) → đủ điều kiện mở khu mới.

- Không có màn, không có khái niệm "lượt". Tiến trình lưu liên tục.
- Không có game over. Không có cơ chế nào trừ tiền người chơi đã có.

## 3. Robot

### 3.1 Điều khiển
- Bên trái: joystick ảo 8 hướng.
- Bên phải: các nút **Hút** (bật/tắt), **Bắn**, **Thức ăn**, **Thuốc**, **Sạc dự phòng**.
- **3 làn sâu** (2026-11-06, người dùng duyệt):
  - Bể có 3 làn: **Gần** (sát kính trước), **Giữa**, **Xa**, đánh số 0 / 1 / 2.
  - Hai nút **▲ Vào sâu / ▼ Ra gần** cạnh joystick; bàn phím **Q / E**. Mỗi lần bấm chuyển một làn; tàu trượt mượt sang làn mới trong 0,35 giây. HUD có 3 chấm báo làn hiện tại.
  - Hút rác, chữa cá ốm, nhặt xu/ngọc: chỉ với vật **cùng làn**. Khi đang trượt giữa hai làn thì tính theo làn gần nhất.
  - Thức ăn rơi ở làn của tàu; cá đói tự bơi sang làn có thức ăn để ăn.
  - Trạm chỉ đậu được ở làn Gần. Tàu xuất phát ở làn Gần.
  - Rác mới sinh ngẫu nhiên đều ở 3 làn. Cá bơi trong một làn và thỉnh thoảng đổi làn khi lang thang. Xu/ngọc rơi ở làn của con cá sinh ra nó.
  - Mặt đáy lồi lõm (mục 8) dùng chung cho cả 3 làn.

### 3.2 Hút và khoang chứa
- Chế độ hút bật/tắt bằng một lần chạm. Khi bật, robot tự hút rác trong bán kính quanh mình.
- Rác hút được nằm trong **khoang chứa** (có sức chứa giới hạn). Khoang đầy thì không hút thêm.
- Phải về **trạm tái chế** thì rác mới đổi thành xu.

### 3.3 Pin
| Hành động | Tốn pin |
|---|---|
| Bơi | Không |
| Hút | Nhiều |
| Bắn bong bóng | Ít (mỗi phát) |
| Thả thức ăn, cho thuốc | Không (tốn xu/vật phẩm) |

- Pin về 0: hút và bắn tự tắt; robot vẫn bơi, cho ăn, cho thuốc được. Không có hình phạt.
- **Loại pin**: mua pin loại khác (S / M / L / XL…) để tăng dung lượng.
- **Sạc ở trạm**: robot phải đậu ở trạm mới sạc; sạc mất thời gian; rời đi giữa chừng thì giữ phần đã sạc.
- **Bộ sạc ở trạm**: mua loại tốt hơn để sạc nhanh hơn.
- **Sạc dự phòng**: vật phẩm tiêu hao, nhiều loại (mức nạp khác nhau), dùng ngay giữa bể.

### 3.4 Súng bong bóng
- Bắn theo hướng robot đang quay mặt.
- Trúng sinh vật gây hại: nhốt trong bong bóng → bong bóng nổi lên mặt nước → biến mất.
- Bong bóng đi xuyên qua cá, không gây hại. Không có tác dụng với tảo độc.

## 4. Cá và nước

### 4.1 Nước
- Mỗi khu có **Độ sạch nước** 0–100%. Rác, tảo độc, thức ăn thừa làm chỉ số giảm.

### 4.2 Trạng thái cá
- Mỗi cá có thanh **No** và trạng thái **Bệnh**.
- Tâm trạng: **Vui → Buồn → Ốm → (cảnh báo + đếm ngược) → nhảy khỏi bể, mất hẳn**.
- Bệnh do nước bẩn kéo dài hoặc do sinh vật gây hại. Nước sạch lại thì cá tự hồi phục dần; cho thuốc thì khỏi nhanh.
- Cá ốm có cảnh báo: icon trên đầu cá + mũi tên ở mép màn hình chỉ hướng cá (khi cá ngoài tầm nhìn).

### 4.3 Chăm sóc
- **Thức ăn**: tốn xu; thả ra chìm dần; cá bơi tới ăn. Thức ăn thừa rơi xuống đáy và làm bẩn nước.
- **Thuốc**: tốn xu; chữa cá ốm ở gần robot.

### 4.4 Cá sinh tài nguyên
- Cá vui sinh **xu**, tỉ lệ nhỏ sinh **ngọc trai**. Tài nguyên rơi ra; robot bơi chạm vào là nhặt (không cần bật hút).
- Không nhặt sau một thời gian → tự cộng **50%** giá trị vào tài khoản.

### 4.5 Loài, nguồn cá, sức chứa
- Prototype có **3 loài**: rẻ và dễ nuôi / trung bình / đắt và khó tính (sinh nhiều xu, tỉ lệ ngọc cao hơn).
- Cá mua bằng xu, đặt qua PC (mục 17). Cá mua về là **cá con**, cần thời gian làm quen và lớn rồi mới sinh xu. Không có sinh sản.
- Mỗi khu có **giới hạn số cá**, kiểm tra lúc thả từ Kho (đặt mua không bị giới hạn). Cá ở cố định trong khu được thả.

## 5. Mối đe dọa
| Loại | Mô tả | Cách xử lý |
|---|---|---|
| Đợt rác tràn | Định kỳ, có báo trước, rác đổ vào khu | Hút |
| Tảo độc | Mọc trên đá/kính, lan dần, làm bẩn nước | Hút |
| Sinh vật gây hại | Di chuyển, làm cá sợ hoặc lây bệnh | Súng bong bóng |

- Bỏ qua mối đe dọa: nước bẩn nhanh hơn, cá buồn / ốm.
- Rác luôn sinh lại theo thời gian để người chơi luôn kiếm được xu (không bao giờ bị kẹt).

## 6. Kinh tế
### 6.1 Xu (tiền chính)
- Nguồn: tái chế rác, cá sinh ra, offline.
- Dùng cho mọi thứ: cá, thức ăn, thuốc, nâng cấp, thiết bị, pin, bộ sạc, sạc dự phòng, mở khu.

### 6.2 Ngọc trai (tiền premium)
- Đổi **một chiều**: 1 ngọc = 1000 xu. Không đổi xu ra ngọc.
- Dùng để tua nhanh thời gian chờ.
- Nguồn trong prototype: cá nhả (hiếm), quà hằng ngày, phần thưởng nhiệm vụ.
- Sau prototype: quảng cáo thưởng, mua vật phẩm (chưa làm; chừa sẵn chỗ trong kiến trúc).

## 7. Nâng cấp và thiết bị
| Nhóm | Mục | Kiểu |
|---|---|---|
| Robot | Khoang chứa, tốc độ bơi, máy hút (bán kính + tốc độ hút) | Lv1 → Lv5 |
| Robot | Pin | Mua loại pin |
| Trạm | Bộ sạc | Mua loại bộ sạc |
| Thiết bị bể | Máy lọc nước, máy cho ăn tự động, trạm sạc phụ, san hô/trang trí | Lv1 → Lv5 |

- Mọi thứ trong bảng đều đặt mua trên **PC trong phòng** dưới dạng hàng hoặc linh kiện (mục 17). Trạm trong bể chỉ còn đổi rác và sạc pin.
- Thiết bị đặt vào các **vị trí có sẵn** trong mỗi khu.
- Thời gian giao hàng **thay cho** thời gian lắp: hàng về Kho, bấm lắp là xong ngay.
- **Số liệu** (duyệt 2026-11-09): cấp, giá, thời gian giao nằm trong `src/data/upgrades.json`; vị trí đặt thiết bị trong `zones.json` (khu 1 có 6 chỗ).
- **Tác dụng thiết bị:** máy lọc giảm phần ô nhiễm tính vào nước; máy cho ăn tự thả thức ăn theo chu kỳ, mỗi lần trừ đúng giá thức ăn, hết xu thì dừng; trạm sạc phụ chỉ sạc, không đổi rác; san hô hạ ngưỡng nước làm cá buồn.
- **Sạc theo giờ thực:** đang đậu ở trạm thì sạc theo giờ thực, kể cả khi ẩn hoặc tắt game; rời trạm giữ phần đã sạc.
- **Tua bằng ngọc:** áp dụng cho đơn đang giao và cá con đang lớn; 1 ngọc cho mỗi 5 phút còn lại, làm tròn lên.

## 8. Bản đồ và khu vực
- Một bể lớn cố định, **3 khu nối theo chiều ngang**, mỗi khu rộng khoảng 2 màn hình:

| Khu | Đặc trưng | Mối đe dọa giới thiệu |
|---|---|---|
| 1. Đáy cát | Trạm chính, khu khởi đầu | Đợt rác tràn |
| 2. Rạn đá | | Tảo độc |
| 3. Hang tối | | Sinh vật gây hại |

- **Mặt đáy lồi lõm** (2026-11-06, người dùng duyệt đổi luật):
  - Mỗi khu khai báo các điểm độ cao đáy trong `zones.json` (`terrain`: cặp `[x, độ nhô]`, độ nhô 0–36px tính từ `floorY` lên trên). Giữa hai điểm nội suy mượt.
  - Vùng trạm luôn phẳng (độ nhô 0).
  - Tàu không xuống thấp hơn mặt đáy tại vị trí của nó: lấy điểm cao nhất dưới thân tàu, tàu bị đẩy lên khi bơi qua gò.
  - Rác chìm, thức ăn, xu/ngọc rơi đều nằm đúng trên mặt đáy tại chỗ rơi. Cá không bơi xuyên đáy. Bóng đổ in trên mặt đáy.
- Mở khu mới: khu trước sạch ≥ X% + trả xu + chờ thời gian.
- Mở khu mang lại thêm chỗ nuôi cá, vị trí đặt thiết bị, rác giá trị hơn.

## 9. Thời gian và offline
- Bộ đếm theo **giờ thực**, vẫn chạy khi tắt game: sạc pin, giao hàng, cá làm quen / lớn, mở khu.
- Offline **chỉ có lợi**: cá sinh xu (có trần), không đói, không ốm, không bỏ đi.
- **Khi nhân vật ở phòng**, bể tính theo đúng luật offline; quay lại bể thì nhận phần xu tích luỹ. Ngủ, ở phòng và offline dùng chung một luật tính.
- **Luật tính vắng mặt** (2026-11-09): chỉ cá đang vui mới sinh xu, theo `coinValue / coinIntervalSeconds` của loài, không ra ngọc. Thời gian tính tối đa `balance.json › absence.maxSeconds` (tạm 3600 giây). Trạng thái cá và nước giữ nguyên trong lúc vắng.
- **Đồng hồ ngày/đêm** riêng của game: 1 ngày game ≈ 24 phút thực (số trong `balance.json`), chạy theo giờ thực nên vẫn trôi khi tắt game. Chia sáng / trưa / chiều / tối.
- **Giờ trong ngày** (duyệt 2026-11-10): sáng 6–11, trưa 11–14, chiều 14–20, tối 20–6; cửa sổ chuyển trời hoàng hôn từ 17:00 (`balance.json › day.duskFrom`). Chưa có lưu game thì mỗi lần mở game đồng hồ bắt đầu lúc 08:00 (khi có lưu game ở P5 thì chạy tiếp theo giờ thực). Trời qua cửa sổ, nắng ban mai và độ sáng các đèn trong phòng đổi dần theo giờ; HUD phòng hiện giờ.
- **Ngủ được từ 20:00 tới trước 6:00**, bỏ qua tới 6:00; ngủ lúc 20:00 bỏ đúng 10 giờ game = 10 phút thực. Khoảng bỏ qua tua đơn hàng đang giao và cá con đang lớn; xu cá cộng theo luật vắng mặt khi vào lại bể. Ban ngày bấm Ngủ thì báo giờ được ngủ.
- **Ngủ** (mục 17): từ tối mới ngủ được, nhảy tới 6h sáng hôm sau. Khoảng bị bỏ qua (tối đa khoảng 10 phút thực) tua luôn các bộ đếm và cộng xu cá như offline. Bộ đếm dài vẫn cần ngọc để tua.
- Rủi ro người chơi chỉnh giờ máy: chấp nhận ở prototype; xử lý khi có monetization.

## 10. Nhiệm vụ và quà hằng ngày
- 5–10 nhiệm vụ (ví dụ: "Dọn 50 rác", "Chữa 3 con cá"), khai báo bằng dữ liệu, có màn hình danh sách đơn giản; thưởng xu / ngọc.
- Quà hằng ngày: thưởng khi mở game mỗi ngày.

## 11. UI / HUD
- Màn hình ngang. Màn hình dọc → hiện thông báo yêu cầu xoay ngang.
- Dưới trái: joystick. Dưới phải: cụm nút (Hút to nhất; quanh là Bắn, Thức ăn, Thuốc, Sạc dự phòng).
- Mép trên: thanh pin, khoang (dạng `12/20`), xu, ngọc trai.
- Trong bể có thêm nút **Kho** (góc trên trái) và nút **về phòng** (trong cụm nút phải, vùng ngón cái, không sát nút Hút). HUD ở phòng gồm joystick, xu, ngọc, giờ trong ngày và một nút hành động theo ngữ cảnh đặt trong vùng ngón cái phải (không sát mép màn hình).
- HUD và cụm nút bám theo mép trái/phải thực tế của màn hình (chiều rộng thay đổi theo máy, xem mục 12.1).
- Theo dõi cá gặp nguy: icon trên đầu cá + mũi tên ở mép màn hình. Không có minimap.
- Ngôn ngữ prototype: **tiếng Việt**. Mọi chuỗi hiển thị nằm trong file ngôn ngữ riêng.
- Font: **SVN-Determination Sans** (font pixel, đủ dấu tiếng Việt), đóng gói kèm game để chạy offline. Giấy phép chưa xác nhận, phải làm rõ trước khi phát hành.

## 12. Đồ họa và âm thanh

### 12.1 Phong cách: pixel art
- Độ phân giải logic: **cao 360 pixel**, **rộng 640–840** tùy tỉ lệ màn hình:
  - Màn hình 16:9 → 640×360.
  - Điện thoại dài hơn (19.5:9, 20:9, 21:9) → nhìn rộng hơn, tối đa 840 (thấy thêm phần bể hai bên), không viền đen.
  - Màn hình vuông hơn 16:9 (tablet) → giữ 640×360, có viền đen trên dưới.
- Phóng to kiểu nearest-neighbor (pixel sắc, không nhòe). Điện thoại 720p / 1080p phóng đúng ×2 / ×3; máy có độ phân giải lẻ chấp nhận pixel hơi không đều.
- Lưới 16px. Tàu ngầm của người chơi dùng sprite 48×48 theo ảnh mẫu được yêu cầu ngày 2026-11-04; cá 16–28px, rác 8–16px. Texture được khai báo trong `src/data/art.json`.

### 12.2 Asset
- Mọi texture khai báo trong `src/data/art.json`, mỗi khoá là một trong ba loại: `shapes` / `verticalGradient` (placeholder vẽ lúc chạy, đúng kích thước sprite thật) hoặc `image` (PNG nền trong suốt trong `public/`). Thay asset bằng cách đổi bản ghi trong `art.json`, không sửa code.
- **Asset sinh bằng code** (từ 2026-11-06): nền, cây cỏ, hiệu ứng, trạm, cá, rác, xu/ngọc, thức ăn là PNG do `scripts/art/generate.mjs` vẽ (`npm run art`), ghi vào `public/art/gen/`. Script dùng bảng màu 12.4 và seed cố định nên chạy lại cho ra đúng các file cũ; không cần thư viện ngoài. Nút, icon HUD vẫn là placeholder `shapes`.
- **Sprite vẽ bằng Pixelbolt** (từ 2026-11-06, devDependency `pixelbolt@0.12.1` ghim cố định): dùng cho props, sinh vật có animation, đồ bám kính, hạt phát quang. Recipe JSON lưu trong repo, xuất PNG ở scale 1 vào `public/art/gen/`. Các lớp nền vẫn do `generate.mjs` vẽ, vì chúng được tô màu theo độ sâu và làm mờ theo khoảng cách.
- Kích thước hiện tại: cá guppy 19×13, neon 17×10, thần tiên 21×26; rác 8–16px (đã gồm viền 1px); xu, ngọc 8×8; trạm 48×40 (bằng vùng trạm trong `zones.json`). Bán kính va chạm vẫn lấy từ `fish.json` / `trash.json`, không theo kích thước ảnh.
- Thay bằng ảnh vẽ tay về sau: giữ kích thước sprite; các lớp nền đọc chiều cao từ ảnh nên đổi kích thước lớp nền không cần sửa code.
- Tàu ngầm (thiết kế mới 2026-11-06, theo ảnh mẫu người dùng gửi): **thân xanh navy, viền vàng**, quay mặt sang phải (ảnh mẫu quay trái, vẽ lật lại).
  - Mũi tàu là đèn pha tròn lớn có vành vàng.
  - Ba cửa sổ tròn vành vàng; một sọc vàng chạy dọc thân, cuối sọc có vạch chéo gần đuôi.
  - Tấm thông gió và ba khe sáng vàng nằm dưới sọc.
  - Tháp có cửa sổ phát sáng vàng; ống ngắm cong, mắt kính hướng về phía trước; tay vịn vàng trên lưng.
  - Thanh trượt dạng ống dưới bụng.
  - Đuôi thuôn, có vây trên và vây dưới viền vàng, chân vịt vàng 3 cánh.
  - Sprite sheet vẽ bằng Pixelbolt, mỗi frame **56×48** vẽ ở tỉ lệ 1 (không kéo giãn).
  - Animation chân vịt quay 4 frame: quay nhanh khi tàu bơi, chậm khi đứng yên.
  - Kích thước hiển thị và vùng giới hạn di chuyển 54×46 giữ như cũ.
  - Ảnh cũ `public/art/submarine.png` (thân vàng, khung tím) giữ lại trong repo, không còn dùng.

### 12.3 Âm thanh
- Prototype: hiệu ứng âm thanh, có nhạc nền (duyệt 2026-11-10). Nguồn chỉ lấy file giấy phép **CC0**, ghi nguồn từng file trong `public/audio/CREDITS.md`. Danh sách cue và file nằm trong `src/data/sounds.json`.
- Gắn tiếng cho: trong bể (máy hút lặp khi bật, nhặt xu/ngọc, bán rác, cho ăn, chữa cá, đổi tầng), cảnh báo (pin cạn, khoang đầy, thiếu xu, khu đủ cá, cá ốm, cá bỏ đi), giao diện và phòng (bấm nút, tạm dừng, mua hàng, lắp đồ, hàng tới, mở cửa), âm nền nhỏ lặp trong bể và trong phòng. Tiếng bắn làm cùng súng bong bóng (P4-05).
- **Nhạc nền:** 3 bài trong `public/audio/music/` (I Hope · Bread · Into the Deep) phát nối nhau theo thứ tự rồi quay lại bài đầu, chạy liên tục qua màn tiêu đề, phòng và bể (đổi cảnh không phát lại từ đầu). Phát bằng thẻ audio kiểu stream để không giải mã cả bài vào bộ nhớ. Cài đặt có công tắc "Nhạc nền" riêng; tắt "Tiếng" thì tắt cả nhạc; âm lượng theo mức chung. Ẩn tab thì nhạc tạm dừng.
- Tạm dừng thì dừng mọi tiếng trừ tiếng bấm nút. Phaser tự mở khoá âm thanh ở lần chạm đầu (màn tiêu đề).

### 12.4 Hướng mỹ thuật
- Hai ảnh mẫu người dùng gửi ngày 2026-11-05 (bể cá tàn tích rêu phong, nắng vàng ấm, xưởng ống đồng) là **key art**: đích về không khí, màu sắc, ánh sáng. Không dùng trực tiếp làm asset; mọi thứ vẽ lại thành pixel art theo 12.1 (640–840×360, nearest-neighbor).
- Nhân vật giữ tàu ngầm theo 12.2: PNG 48×48, hiển thị rộng hơn 15%, vùng giới hạn di chuyển 54×46. Không đổi luật di chuyển.
- **Phong cách HD-2D** (cập nhật 2026-11-06 theo ảnh mẫu thứ ba: hang biển xanh dương–tím, tiền cảnh tối, sinh vật phát quang):
  - Sprite lớp chơi (tàu ngầm, cá, rác, xu, trạm, cây cỏ đáy) vẫn là pixel art sắc nét.
  - Chiều sâu tạo bằng độ nét theo lớp (DOF): lớp càng xa càng mờ, tiền cảnh cũng mờ; chỉ lớp chơi sắc nét.
  - Phối cảnh không khí: lớp xa nhạt và hoà vào màu nước; lớp gần tối và đậm hơn.
  - Bloom cho nguồn sáng: tia nắng, mặt nước, đèn pha, ánh lửa trạm, sinh vật phát quang, xu.
  - Blur của các lớp nền được vẽ sẵn vào ảnh (không tốn GPU). Bloom chạy lúc chơi trên camera (cần WebGL), có công tắc tắt khi máy yếu.
- **Bảng màu theo độ sâu:** gần mặt nước giữ nước teal và nắng vàng ấm; càng xuống sâu càng ngả xanh dương–tím. Các nhóm màu: rêu xanh, đá xám ấm, san hô hồng/tím, đồng gỉ (máy móc); điểm nhấn phát quang cam, hồng, tím, cyan.
- **Lớp cảnh (parallax):** rất xa → xa (tàn tích) → giữa (đá rêu) → lớp chơi (1.0) → **tiền cảnh** (cuộn nhanh hơn camera, tối, mờ). Tiền cảnh chừa vùng chơi: dưới đáy chỉ là dải đá/san hô thấp phủ phần cát, thêm vài sợi tảo tối mảnh vươn cao; không che giữa màn hình. Nền dạng module ghép/lặp theo chiều rộng khu, không vẽ một bức tĩnh.
- **Sinh vật phát quang:** sứa cam trôi lơ lửng, san hô/hải quỳ phát sáng dưới đáy, phù du sáng li ti.
- **Độ đọc gameplay:** nền dịu và tối hơn, ít chi tiết nhỏ; rác, xu, ngọc, cá ốm, thức ăn có độ tương phản cao và viền tối 1px.
- **Nước theo độ sạch:** nước càng bẩn càng đục và ngả màu, tia nắng yếu đi; nước sạch thì trong, nắng rõ.
- **Hiệu ứng khác:** tia nắng, lấp lánh mặt nước, bong bóng, đèn lồng phát sáng.
- **Trạm tái chế:** phong cách xưởng ống đồng, bánh răng, đèn lồng.
- **Bể kính luôn hiện** (đổi 2026-11-06, xem 12.5): khung bể, kính sau, thành bên, kính trước; phòng bên ngoài mờ tối phía sau.

**Đã áp dụng cho khu 1 (2026-11-06)** — code ở `src/game/env/Background.ts`, công thức theo độ sạch ở `src/game/env/waterVisual.ts`:
- Lớp cảnh, từ xa tới gần (hệ số cuộn ngang; trục dọc luôn 1 để các lớp bám đáy bể; "mờ" là độ lệch chuẩn Gaussian vẽ sẵn vào ảnh, đơn vị px logic):
  - rừng tảo bẹ và tháp (0.1, mờ 2.2) + 4 quầng sáng cyan cộng sáng (0.15);
  - tàn tích: cầu vòm, đền mái vòm có cửa sổ phát sáng, cột gãy (0.2, mờ 1.3);
  - đàn cá nhỏ và 3 sứa mờ ở hậu cảnh (0.35);
  - đá xây phủ rêu xen đá tròn (0.5, mờ 0.7);
  - tia nắng xiên (0.6);
  - lớp chơi, sắc nét: cát, vân sáng trên cát, cây cỏ, 5 sứa cam phát sáng, mặt nước, thành bể (1.0);
  - tiền cảnh (1.3, mờ 1.2–1.4): dải đá/san hô tối dưới đáy (chỉ phủ phần cát, có đốm phát quang) và 3 sợi tảo tối mảnh vươn cao, đung đưa.
- Các lớp nền được tô theo màu nước tại đúng độ cao của chúng (phối cảnh không khí): lớp càng xa càng hoà vào nước.
- **Cây cỏ và rặn san hô** (cập nhật 2026-11-06 theo 3 ảnh mẫu người dùng gửi: rừng tảo bẹ cao, rặn san hô rực rỡ, tảo vàng có túi khí):
  - Mọc thành **rạn dày** rộng khoảng 100–180px, xen khoảng cát trống hẹp khoảng 30–70px để rác trên đáy vẫn thấy; chừa vùng quanh trạm. Bố cục theo seed riêng.
  - Mật độ gấp 4 lần bản đầu (người dùng yêu cầu ngày 2026-11-06).
  - Khoảng 30 loại sinh vật đáy, theo ảnh mẫu thứ 4 (rạn san hô rực rỡ bám trên đá xanh tối). Ngoài các loại đã có, thêm: san hô bàn, quạt biển, roi biển, san hô cột, san hô nấm, san hô bong bóng, polyp sao, zoanthid, san hô sừng nai, san hô phủ xanh, bọt biển thùng, bọt biển bình, trai khổng lồ, sao biển, nhím biển, giun lông vũ, giun cây thông, tảo nho, rau diếp biển.
  - **Đá gồ ghề:** mặt đáy lớp chơi là đất cát lồi lõm theo `terrain` (mục 8), có mỏm đá xanh tối bám san hô ở các gò cao. Phía sau thêm một lớp đá tảng gồ ghề lớn.
  - Hàng xa (z 0.5): tảo bẹ cao 90–130px, phần lớn là bóng tối, mép lá bắt sáng, đung đưa chậm.
  - Hàng giữa (z 0.25): tảo vàng phân nhánh có túi khí, xen san hô nhánh.
  - Hàng chơi (z 0), cao tối đa khoảng 42px: san hô nhánh tím/hồng/cam, san hô não vàng, san hô quả cầu hồng, cỏ biển xanh, bọt biển ống cam, cùng các sinh vật phát quang bên dưới.
- Bản trước đó (giữ lại để tham khảo) rải cây đều dọc đáy theo seed riêng, chừa khoảng trống quanh trạm, không có viền để vật tương tác nổi hơn:
  - tảo bẹ, rotala đung đưa;
  - san hô, bọt biển, cỏ, sỏi;
  - phát quang: san hô hồng, hải quỳ tím đầu cyan, "đèn biển" nấm cyan.
- Bloom toàn màn hình trên camera (`src/game/env/bloom.ts`): ngưỡng 0.72, độ loang 3, mức trộn 0.6. Chỉ chạy với WebGL. Tắt/bật ở panel debug (mục Hiệu ứng); người chơi chưa có công tắc.
- Theo độ sạch nước (0–100):
  - lớp phủ đục: từ 85 trở lên thì trong; mờ tối đa 0.38 khi nước bẩn hết mức;
  - tia nắng và vân sáng: đậm nhất khi nước sạch, yếu dần khi bẩn;
  - hạt lơ lửng: 15% khi sạch, tăng lên đủ cả khi bẩn.
- Thêm ngoài danh sách gốc:
  - đèn pha ở mũi tàu ngầm, nằm trên lớp đục và rõ hơn khi nước bẩn;
  - bong bóng sủi thành dòng từ vài điểm dưới đáy;
  - ánh lửa nhấp nháy ở cửa trạm;
  - phù du phát sáng li ti, nhấp nháy;
  - tối nhẹ ở viền màn hình (màu navy–tím).
- Chưa làm: đèn điểm động chiếu sáng cảnh (Lighting của Phaser 4).

### 12.5 Layer và góc nhìn 2.5D
Theo bộ luật layer người dùng gửi ngày 2026-11-06 (viết cho 3D), chuyển sang Phaser 2D và thêm cảm giác **hộp bể 2.5D**.

**Góc nhìn: hộp bể phối cảnh, một điểm tụ**
- Như đứng ngoài bể nhìn hơi chúc xuống. Điểm tụ nằm giữa màn hình theo chiều ngang, cao hơn tâm màn hình một chút, và đi theo camera.
- Người chơi thấy:
  - kính sau nhỏ và mờ ở cuối hộp;
  - mặt sàn cát lùi từ mép dưới vào tới chân kính sau;
  - hai thành bên ở hai đầu khu, hội tụ về điểm tụ (chỉ thấy khi camera tới gần đầu khu).
- Độ sâu `z`: 0 là mặt phẳng chơi, 1 là kính sau. Vật ở độ sâu `z` thu nhỏ theo `s(z)` và trôi theo camera với hệ số `s(z)` cả ngang lẫn dọc.
- Các lớp nền 12.4 (rừng tảo, tàn tích, đá) mỗi lớp được gán một độ sâu, chân lớp đặt đúng lên hình chiếu của sàn tại độ sâu đó.
- Cây cỏ và props trên sàn xếp thành vài hàng ở các độ sâu khác nhau. Hàng càng xa càng nhỏ và càng hoà vào màu nước.
- Sprite lớp chơi (`z = 0`) giữ tỉ lệ 1 và sắc nét. Chỉ được thu nhỏ theo tỉ lệ lẻ với lớp đã mờ sẵn hoặc hàng cây cỏ xa đã hoà màu nước.
- **Gameplay không đổi:** tàu, cá, rác, xu nằm trên mặt phẳng chơi; luật di chuyển và va chạm giữ nguyên.

**Thứ tự vẽ (sau ra trước)**

| # | Layer | Khu 1 |
|---|---|---|
| 0 | Phòng ngoài | Ảnh phòng tối, mờ mạnh (kệ, đèn, cửa sổ). Thấy rõ ở dải không khí trên mặt nước, qua nước chỉ lờ mờ. Không nhận caustics |
| 1 | Hộp bể phía sau | Kính sau (ám màu nước, đường keo silicon, vệt rêu mờ), mặt sàn lùi xa, hai thành bên |
| 2 | Nền xa | Nước, rừng tảo, tàn tích, đá rêu (như 12.4), đặt theo độ sâu |
| 3–4 | Props, cây cỏ | Trạm, cây cỏ và sinh vật trang trí theo hàng sâu, cát lớp chơi |
| 5 | Sinh vật | Rác, xu/ngọc, thức ăn, cá, tàu ngầm |
| 6 | Khối nước | Lớp đục theo độ sạch, tia nắng, lớp vân sáng mờ phủ toàn vùng nước (cá và vật cũng "nhận" caustics; không bám đúng hình từng vật) |
| 7 | Hạt | Bong bóng, bụi, phù du, đèn pha |
| 8 | Mặt nước | Gợn sáng và quầng sáng mặt nước, vẽ đè lên sinh vật |
| – | Tiền cảnh | Dải đá đáy và tảo mảnh (như 12.4) |
| 9 | Kính trước | Khung bể trên (viền nhựa tối), mép kính ở hai đầu khu, vệt phản chiếu chéo, bọt bám kính, rêu ở góc dưới. **Rõ dần khi tàu tới gần hai đầu khu**, giữa bể gần như vô hình. Không bị lớp đục phủ lên |
| 10 | Hậu kỳ | Bloom (có sẵn). **Tilt-shift nhẹ:** mép trên và mép dưới màn hình nhòe nhẹ, giữa nét (tàu luôn nét vì camera đi theo). **Vignette** chuyển sang filter camera. Mỗi hiệu ứng có công tắc trong panel debug |
| 11 | UI | HUD ở UIScene, không bị hậu kỳ tác động |

- **Bóng đổ:** tàu ngầm, cá, rác và xu/ngọc đổ một bóng mềm xuống cát ngay dưới vị trí của nó.
  - Vật càng sát đáy, bóng càng đậm và gọn; càng xa đáy, bóng càng mờ và loe rộng.
  - Bóng giúp người chơi biết vật đang ở độ cao nào.
  - Hạt, kính và mặt nước không đổ bóng.
- **Trong suốt:** sprite không có pixel bán trong suốt. Chỉ nước, kính, bong bóng và hạt dùng alpha hoặc cộng sáng.
- **Không áp dụng ở bản 2D:** sắp xếp theo chiều sâu 3D, instancing.
- **Chưa làm:**
  - va chạm cứng với props (đổi luật chơi trong core);
  - méo sóng toàn màn hình.
- **Trục sâu trong gameplay** (2026-11-06): 3 làn theo mục 3.1.
  - Độ sâu phối cảnh của làn Gần / Giữa / Xa là z = 0 / 0.3 / 0.6, tức kích thước khoảng 100% / 85% / 74%.
  - Vật ở làn xa hơn ám màu nước nhiều hơn, trôi theo camera đúng phối cảnh, và luôn bị vật ở làn gần hơn vẽ đè lên.
  - Hàng cây chơi (z = 0) che chân các vật ở làn sau. Bóng đổ in trên mặt đáy của làn đó.

## 13. Lưu game
- Tự động lưu trên máy, 1 slot. Dữ liệu lưu có số phiên bản để nâng cấp định dạng về sau.
- Không tài khoản, không online, không chat. Ràng buộc app trẻ em: **không áp dụng**.

## 14. Số liệu
- Mọi số liệu (giá, dung lượng pin, thời gian chờ, tốc độ đói, tỉ lệ ngọc, ngưỡng X%…) nằm trong `src/data/`, đặt tạm và chỉnh khi chơi thử (giai đoạn P6).

## 15. Ngoài phạm vi prototype
Quảng cáo, mua hàng trong app, store, online, lưu đám mây, độ khó, iOS, nhiều ngôn ngữ, chống chỉnh giờ máy, sinh sản cá.

## 16. Quyết định còn mở
| Mục | Hạn chót |
|---|---|
| Định dạng animation / sprite sheet (vd. xuất từ Aseprite) | Khi bắt đầu vẽ asset thật |
| "Mua vật phẩm được ngọc trai" là nạp tiền thật hay quà khi mua trong game | Khi làm monetization |

## 17. Căn phòng
Cảnh "ngôi nhà" của nhân vật người. Mở game vào thẳng căn phòng.

### 17.1 Các khu
| Khu | Chức năng |
|---|---|
| Giường | Ngủ để tua thời gian (mục 9) |
| PC | Đứng gần hiện nút "Dùng máy tính", mở màn hình desktop phong cách retro (kiểu XP, tự vẽ, không dùng logo, tên hay ảnh nền của Windows). Icon **Peeshop** là trang "lên web đặt hàng": mua mọi thứ (cá, phụ kiện, thiết bị bể, pin, bộ sạc, sạc dự phòng, linh kiện nâng cấp robot). Bản đầu (2026-11-09) chỉ bán 3 loài cá |
| Cửa phòng | Nơi nhận hàng. Tính năng khác của cửa để sau |
| Hồ cá | Đi vào cảnh bể; trong bể có nút quay về phòng |
| Cửa sổ | Xem trời theo giờ trong ngày, nắng ban mai chiếu vào phòng. Tính năng khác để sau |

### 17.2 Điều khiển
- Dùng joystick như trong bể. Đứng gần đồ vật thì hiện một nút hành động theo ngữ cảnh ("Ngủ", "Đặt hàng"...).

### 17.3 Đặt hàng và giao hàng
- Trả xu lúc đặt. Mỗi món có thời gian giao riêng, khai báo trong dữ liệu: đồ rẻ khoảng 1 phút thực, đồ đắt khoảng 10 phút. Cá (2026-11-09, `fish.json › deliverySeconds`): cá bảy màu 60 giây, neon 180 giây, thần tiên 600 giây.
- Thời gian giao là bộ đếm giờ thực: vẫn chạy khi tắt game, ngủ tua được, ngọc tua được.
- Hàng tới thì cửa sáng lên và có thông báo. Mở cửa là lấy hết hàng đã tới vào Kho.
- Thức ăn và thuốc không qua giao hàng: vẫn bấm nút trừ xu ngay trong bể.

### 17.4 Kho (inventory)
- Mở bằng nút Kho trên HUD bể, ở đâu trong bể cũng được. Prototype không giới hạn số ô.
- Cá: thả tại chỗ robot (không thả được khi khu đã đủ sức chứa; khu 1 chứa 20 con, `zones.json › fishCapacity`). Cá thả từ Kho là cá con: nhỏ hơn, lớn dần theo thời gian ở trong bể, chưa sinh xu (kể cả xu lúc vắng) tới khi đủ `growSeconds`. Cá khởi đầu là cá lớn.
- Thiết bị: chọn một vị trí trống có sẵn trong khu.
- Sạc dự phòng: dùng ngay.
- Linh kiện robot: bấm lắp, có hiệu lực ngay.

### 17.5 Hình ảnh
- Isometric, phòng cắt góc với hai bức tường và sàn hình thoi, gói trong một màn hình, không cuộn camera.
- Nhân vật cao khoảng 32–40px, đi 4 hướng chéo; đồ vật và nhân vật xếp vẽ theo chiều sâu.
- Ảnh mẫu người dùng gửi ngày 2026-11-09 là **key art**: đích về không khí, màu sắc, ánh sáng. Vẽ lại thành pixel art theo 12.1, chi tiết đơn giản hơn ảnh. Không đưa nhân vật có bản quyền trong ảnh vào game (thú bông Totoro thay bằng linh vật tự thiết kế).
- **Phong cách** (2026-11-09): Modern Tech Bedroom + Cozy HD-2D, phòng cá nhân của một developer. Góc PC và hồ cá là hai điểm nhấn.
- **Ánh sáng tách lớp:** ba nguồn PC (xanh lạnh), hồ cá (xanh ngọc), đèn ngủ (vàng ấm) là ba ảnh PNG cộng sáng phủ lên cả phòng, vẽ sẵn theo mặt sàn và tường, nhân vật cũng được hắt sáng. Không dùng Lighting của Phaser. Độ mạnh từng lớp là số để PR-02 đổi theo giờ.
- **Tủ đầu giường** cạnh giường (có va chạm) mang đèn ngủ.

## 18. Góc nhìn chéo cho cảnh bể
Người dùng duyệt ngày 2026-11-09. Mục này **thay thế** phần "3 làn sâu" ở 3.1, "Mặt đáy lồi lõm" ở mục 8 và hộp bể nhìn ngang ở 12.5 khi bản mới chạy xong.

- **Điều khiển:** joystick (trái) đi trái/phải và xa/gần trên mặt đáy. **Lặn liên tục** (duyệt 2026-11-10): giữ ▲ thì nổi lên, giữ ▼ thì lặn xuống, thả tay thì dừng ở độ sâu đó; bàn phím giữ Q/E. Độ sâu từ đáy (0) tới mặt nước (2), đi hết mất `balance.json › robot.diveSeconds` (1,5 giây); chạm đáy hoặc mặt thì dừng. Nút ▲▼ nằm bên phải cạnh cụm nút hành động, có thanh đo độ sâu.
- **Tương tác theo độ sâu:** hút rác, chữa cá, nhặt xu/ngọc khi độ sâu của tàu và vật chênh nhau dưới `robot.depthReach` (1 tầng). Rác, cá, thức ăn, xu vẫn nằm ở các độ cao 0/1/2 như trước; thức ăn thả ở đúng độ sâu của tàu.
- **Bản đồ khu 1:** 1024×1024 đơn vị, bố cục theo bản thử (cao nguyên, hang, đền). Trạm đặt trên đáy gần chỗ xuất phát, chỉ đậu được khi tàu sát đáy (`station.dockMaxZ`, 0,25).
- **Rác:** nổi ở tầng Mặt, lơ lửng ở tầng Giữa, cả hai trôi chậm trên mặt phẳng. Rác chìm nằm ở tầng Đáy; rác chìm mới sinh rơi dần từ tầng Mặt xuống.
- **Thức ăn:** thả ở tầng của tàu, chìm dần xuống tầng Đáy; cá đói tự tới chỗ thức ăn và đúng tầng của nó mới ăn được.
- **Cá:** bơi tự do trên mặt phẳng, thỉnh thoảng đổi tầng.
- **Xu/ngọc:** rơi từ chỗ cá xuống tầng Đáy; luật tự cộng sau thời hạn giữ nguyên.
- **Vật cản:** vách, đền và khối đá lớn chặn tàu và cá ở cả 3 tầng; mặt cao nguyên chỉ để ngắm. Rác không sinh trong vùng bị chặn. Có lối cát để đi vòng.
- **Hiển thị:** theo bản thử `?iso=1`. Tầng thể hiện bằng độ cao của vật và bóng đổ xuống đáy.
- **Mặt nước:** khi tàu lên gần mặt (độ sâu trên 1,6) màn hình gợn sóng và nhòe nhẹ, mạnh dần tới mặt nước, tắt khi lặn xuống; có công tắc trong Cài đặt.

## 19. Menu (duyệt 2026-11-10)
- **Màn tiêu đề**, mở game là vào đây: nền là lòng bể pixel nhìn qua kính (`menu.backdrop`, rộng 840 để phủ mọi tỉ lệ màn hình), có cá bơi qua lại, bọt khí nổi, tia nắng. Logo chữ pixel "FishTank" (`menu.logo`), không có dòng phụ.
- Menu chính nằm trong một **bảng điều khiển bể cá** bằng kim loại (`menu.panel`, nine-slice), nút `menu.button` (nine-slice, khung 0 thường, khung 1 đang chọn): **Bắt đầu** (vào phòng), **Cài đặt**, **Hướng dẫn**, **Thông tin**. Trên bảng có màn hình nhỏ (`menu.screen`) hiện số liệu thật của bể: tên khu, độ sạch nước, số cá / sức chứa, xu.
- **Menu tạm dừng:** nút `menu.pause` ở HUD cả phòng lẫn bể, phím `Esc`. Gồm Tiếp tục, Cài đặt, Về màn tiêu đề. Game dừng hẳn khi menu mở; trạng thái ván chơi giữ nguyên khi về màn tiêu đề rồi bấm Bắt đầu lại.
- **Cài đặt:** công tắc (`menu.toggle`) Phát sáng (bloom), Làm mờ tiêu điểm (tilt-shift), Viền tối, Gợn mặt nước. Thêm công tắc **Tiếng** và 3 mức **âm lượng** (Nhỏ / Vừa / To). Lưu bằng `localStorage`, nạp lại khi mở game.
- **Hướng dẫn:** 3 trang ngắn (điều khiển; vòng chơi dọn rác → đổi xu → chăm cá → mua sắm; phòng và PC). **Thông tin:** phiên bản, ghi công font.
- Chưa có nút "Chơi tiếp" vì chưa có lưu game (P5-06).
