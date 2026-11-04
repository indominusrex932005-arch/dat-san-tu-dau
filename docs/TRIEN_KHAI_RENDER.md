# Triển khai bản demo lên Render — #82

Refs #82. **Bản chuẩn bị ngày 04/11/2026, chưa triển khai, chưa có URL HTTPS hoặc kết quả kiểm thử online.** Source đối chiếu: `5c3e72d50a9802a1533a9ca7b17db0fb8fc3aa47`. Sau khi các phần nền merge, phải ghi lại SHA `main` thực sự đưa lên Render và cập nhật tài liệu theo hợp đồng mới.

## 1. Điều kiện mở triển khai

| Điều kiện | Trạng thái tại lúc chuẩn bị |
| --- | --- |
| #80: giới hạn POST và xác minh proxy/HTTPS | Chưa merge; phần đang làm ở PR #92 |
| #81: production + public-demo, hợp đồng env và health endpoint | Chưa merge; main hiện chưa có hợp đồng này |
| Quyền Render/GitHub và Atlas demo của nhóm trưởng | Chưa xác minh/cấp cho lượt deploy này |
| Service, vùng, gói, auto-deploy và DB demo đã chọn | Chưa chọn/chưa tạo |
| URL HTTPS, login/session, checkout/phiếu online | Chưa chạy |

Chỉ tiếp tục bước tạo service khi #80/#81 đã review/merge và nhóm trưởng bàn giao quyền phù hợp. Main hiện tại từ chối `NODE_ENV=production` cùng `DEMO_MODE=true` tại `app.js`; service thanh toán cũng chặn mô phỏng ở production. Hợp đồng public-demo phải đến từ #81. Không dùng `NODE_ENV=development` online hoặc đổi `DEMO_PAID` thành `PAID` để vượt điều kiện này.

## 2. Thiết lập Render cần bàn giao

Chọn **New → Web Service**, kết nối đúng repo qua Git provider. Express/EJS có server nên cần Web Service. Các trường cấu hình theo [hướng dẫn Express](https://render.com/docs/deploy-node-express-app) và [Web Services](https://render.com/docs/web-services):

| Trường | Giá trị chuẩn bị; cần xác nhận trước deploy |
| --- | --- |
| Repository | `indominusrex932005-arch/dat-san-tu-dau` |
| Branch | `main`, sau merge #80/#81; ghi SHA được duyệt |
| Root Directory | Gốc repo, nơi có `package.json` và `server.js`; không nhập đường dẫn Windows trên máy cá nhân |
| Language / Runtime | Node |
| Node version | Chốt một bản `24.x.y` đã kiểm thử bằng `NODE_VERSION`; ghi patch thực tế từ build log |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| `PORT` | Để host cấp; server phải đọc `process.env.PORT` và nhận kết nối từ bên ngoài container |
| Region | Đề xuất Singapore để gần người dùng Việt Nam; **chưa chọn** |
| Compute / instance | Đề xuất Free, một instance nếu hạn mức phù hợp; **chưa chọn** |
| Auto-Deploy | Đề xuất Off trong lượt đầu; deploy thủ công SHA đã được duyệt |
| Health Check Path | **Chờ đường dẫn thật được #81 bàn giao**, kiểm tra phản hồi trước khi cấu hình |

Render ưu tiên `NODE_VERSION` hơn file phiên bản/package engines; không dựa vào default thay đổi theo thời điểm tạo service. Xem [Node version](https://render.com/docs/node-version). Singapore là một [vùng được hỗ trợ](https://render.com/docs/regions); đây là đề xuất, chưa phải thiết lập đã thực hiện.

Free có thể ngủ sau 15 phút không có traffic, đánh thức khoảng một phút, và có thể restart. Free không có shell/one-off jobs hoặc persistent disk; dữ liệu cần lưu trong Atlas. Kiểm tra hạn mức trong workspace trước khi chọn. Gói trả phí, disk hoặc outbound IP riêng phải được nhóm trưởng chốt trước. Xem [giới hạn Free](https://render.com/docs/free).

## 3. Environment và secrets

Nhập bí mật trực tiếp vào **Environment** của service hoặc cơ chế quản lý secret được nhóm trưởng cấp. Không đưa giá trị thật vào PR/issue, ảnh, log, shell history hoặc Git. Bảng dưới chỉ là placeholder, không phải cấu hình dùng được ngay:

| Biến | Giá trị mẫu / nguồn |
| --- | --- |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `<APPROVED_24_X_Y>` |
| `MONGODB_URI` | `mongodb+srv://<DEMO_DB_USER>:<URL_ENCODED_PASSWORD>@<DEMO_CLUSTER>/` |
| `DB_NAME` | `<DEDICATED_DEMO_DB_NAME>`; luôn khai báo rõ, không dùng fallback DB development |
| `SESSION_SECRET` | `<PRIVATE_RANDOM_VALUE_AT_LEAST_32_CHARACTERS>`; dùng ổn định qua restart/deploy |
| Mode public-demo | **Chờ tên biến và giá trị chính thức của #81**; chưa tự đặt cờ mới |
| Rate limit / proxy | Lấy đúng tên biến, ngưỡng và hợp đồng proxy sau merge #80/#81 |

`DEMO_MODE` là cờ cũ trong source được đọc, không phải cấu hình production public-demo đã được duyệt. Sau #81, đối chiếu lại app locals, server, service và nhãn checkout/phiếu bằng cùng một hợp đồng. Không cấu hình thanh toán live hoặc thông tin ngân hàng thật trong lượt demo này.

## 4. Atlas demo riêng, backup và khởi tạo

1. Nhóm trưởng tạo/cấp **project và cluster demo riêng**, DB/tài khoản/dữ liệu tổng hợp riêng; xác minh cluster hỗ trợ replica set/transaction. Ghi project/cluster/DB được chọn trong biên bản nội bộ. Không lấy URI hoặc dữ liệu Atlas chung làm đường tắt.
2. Cấp database user chỉ với quyền đọc/ghi, collection/index cần thiết trên DB demo; quyền vận hành backup/migration tách riêng nếu cần. Giới hạn truy cập đúng cluster. Tài khoản Atlas quản trị và database user là hai loại khác nhau: [Database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).
3. Lấy CIDR hiện tại ở **service Render → Connect → Outbound**, thêm đúng các dải cần thiết vào Atlas IP access list. Chỉ thêm IP máy vận hành khi cần rồi thu hồi sau công việc. CIDR Render được dùng chung trong vùng, nên vẫn phải xác thực DB user; không mặc định mở `0.0.0.0/0`. Xem [Render outbound IPs](https://render.com/docs/outbound-ip-addresses) và [Atlas IP access list](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
4. Trước mọi thao tác ghi, đối chiếu lại project/cluster/`DB_NAME`, dừng nhận ghi và sao lưu DB demo nếu đã có dữ liệu. Atlas Free không có Cloud Backup; dùng `mongodump`/`mongorestore` theo [hướng dẫn backup Atlas](https://www.mongodb.com/docs/atlas/backup-restore-cluster/). Lưu backup ngoài repo/ảnh/log, xác minh restore vào DB thử riêng trước khi coi backup hợp lệ.

Ví dụ backup chỉ chứa placeholder; người vận hành được cấp quyền chuẩn bị file cấu hình riêng và bảo vệ quyền đọc của file đó:

```text
mongodump --config="<PRIVATE_DUMP_CONFIG_PATH>" --db="<DEMO_DB_NAME>" --archive="<PRIVATE_BACKUP_PATH>" --gzip
```

`--config` giúp giữ URI/password ngoài tham số dòng lệnh; đây là cách được [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/mongodump/#--config) hỗ trợ. Không commit file cấu hình hoặc tệp backup.

**`npm start` không phải kiểm tra DB chỉ đọc.** `server.js` kiểm tra tương thích rồi gọi `Model.init()` và `expireHolds()` trước khi mở cổng; có thể tạo index/dọn HOLD. Xác minh đích, backup và kế hoạch ghi trước khi chạy startup, kể cả khi dự kiến startup sẽ bị chặn do mode.

Các lệnh sau chạy ở gốc repo trên **executor bảo mật đã được nhóm trưởng cấp**, với env demo được inject riêng. Free Render không có shell; nếu chưa có executor phù hợp thì dừng bootstrap, không thêm route nâng quyền công khai hoặc đưa migration/seed vào build/start:

```powershell
npm ci
npm run migrate
```

`migrate` mặc định dry-run, đọc và báo kế hoạch. Với DB mới phải xác nhận không có dữ liệu v1 cần chuyển; không chạy `--apply` khi không có migration cần làm. Với DB v1 phải review lỗi, số bản ghi, index dự kiến đổi và backup. Chỉ khi kế hoạch cần migration, đúng đích, đã dừng ghi và được duyệt mới chạy:

```powershell
npm run migrate -- --apply
npm run migrate
```

Apply có ghi dữ liệu và thay index; dry-run sau đó xác minh không còn việc/lỗi cần xử lý. Khi DB đã sẵn sàng, có thể nạp dữ liệu tổng hợp bằng:

```powershell
npm run seed
```

Seed hiện thêm cơ sở/sân mẫu, không tạo tài khoản và không xóa dữ liệu. Cơ sở mẫu ban đầu chưa có owner và số điện thoại rỗng; cần cấp OWNER đã duyệt và số liên hệ hợp lệ trước khi thử đặt sân. Không chạy các lệnh này vào Atlas dùng chung.

Để cấp ADMIN, đăng ký một **tài khoản CUSTOMER demo riêng** qua `/register`, dừng app/ghi khi vận hành, rồi dùng phương thức có sẵn trên cùng DB demo:

```powershell
npm run admin:grant -- --email "<REGISTERED_DEMO_ADMIN_EMAIL>"
```

Đăng xuất/đăng nhập lại, mở `/admin`, duyệt OWNER thử và cấp cơ sở/số liên hệ. ADMIN không được tạo bằng form công khai. Quy trình và ý nghĩa lệnh nằm trong [hướng dẫn tích hợp](HUONG_DAN_TICH_HOP.md).

## 5. Deploy và kiểm tra HTTPS thực tế

Sau khi đủ điều kiện, chọn service/branch/env/SHA đã duyệt và deploy thủ công. Theo dõi Build/Deploy/Runtime logs, giữ phần lỗi đã lọc; không chia sẻ URI, cookie, CSRF hoặc query token của checkout/phiếu. Render cấp TLS và chuyển HTTP sang HTTPS theo [tài liệu TLS](https://render.com/docs/tls).

Health endpoint do #81 bàn giao phải trả trạng thái sẵn sàng phù hợp, không có secret/dữ liệu người dùng. Cấu hình đúng path thật và xác minh lần đầu; Render dùng HTTP health check để kiểm tra instance và có thể restart khi không đáp ứng. Xem [Health Checks](https://render.com/docs/health-checks). Không dùng một trang đăng nhập/404 làm bằng chứng DB khỏe.

| Thử nghiệm cần ghi SHA, thời gian và bằng chứng đã lọc | Trạng thái hiện tại |
| --- | --- |
| URL `https://<SERVICE>.onrender.com` mở được từ thiết bị/mạng khác | Chưa chạy |
| Health, DB demo đúng đích, startup/migration/index checks thành công | Chưa chạy |
| Login → refresh → chuyển trang vẫn giữ phiên; logout thu hồi phiên; cookie Secure/HttpOnly/SameSite và CSRF đúng sau proxy HTTPS | Chưa chạy |
| Giữ sân → checkout → thanh toán mô phỏng → phiếu đều có nhãn demo; không gọi ngân hàng thật | Chưa chạy |
| Request thường/vượt giới hạn theo #80, key proxy không tin header giả | Chưa chạy |
| Restart/deploy lại: session trong MongoStore, secret ổn định; HOLD hết hạn/CONFIRMED và lock đúng | Chưa chạy |
| Cold start theo gói đã chọn: đo thời gian mở từ mạng khác, ghi lỗi hoặc gián đoạn thật | Chưa chạy |

Không thay kết quả online bằng lint, CI hoặc HTTP localhost. Xem [phần thanh toán còn dở](THANH_TOAN_CON_DANG_DO.md) khi mô tả bản demo.

## 6. Log, cập nhật và rollback

Khi cập nhật, ghi SHA đang chạy/SHA mới, chạy `npm run check` và `npm test` trên replica thử cục bộ; review schema/migration trước khi merge. Deploy thủ công sau khi duyệt; chỉ cân nhắc **After CI Checks Pass** khi smoke test ổn và nhóm trưởng chốt. Auto-deploy cần kết nối Git provider; đối chiếu cả bước test thật trong CI trước khi cho rollout. Xem [Deploys](https://render.com/docs/deploys).

Nếu cần rollback, tạm dừng rollout, chọn một deploy thành công còn tương thích DB và hợp đồng public-demo của #81 tại **Deploys → Rollback**; ghi SHA/build và kiểm tra lại env/health/login/checkout. Render tái dùng một số cấu hình của deploy đích, gồm env; đối chiếu `DB_NAME`, chế độ và secret bằng giao diện riêng để bảo đảm vẫn đúng DB demo. Rollback Dashboard tắt auto-deploy; rollback API không tự tắt. Build được giữ có giới hạn; việc quay code không hoàn tác dữ liệu/schema MongoDB. Chỉ restore DB theo backup/kế hoạch riêng được duyệt, không tự chạy migration ngược. Xem [Rollbacks](https://render.com/docs/rollbacks).

## 7. Bàn giao cho #83

Người deploy điền sau khi chạy thực tế: URL HTTPS; SHA live; Render service/vùng/plan/số instance; Node patch; auto-deploy đã chọn; health path; mã nhận diện DB demo không chứa URI; thời điểm backup/migration/admin bootstrap; kết quả từng ca ở bảng trên; thời gian cold-start/restart; ảnh đã lọc nhãn demo và lỗi còn mở. Không điền secret hoặc link phiếu chứa token.

Hiện chưa có service/DB được xác minh, chưa có URL online và chưa có các kết quả nghiệm thu này. Chuyển bộ bằng chứng thực tế sang #83 khi đã triển khai; deploy xanh riêng lẻ chưa chứng minh toàn luồng đạt. Giữ `Refs #82` cho tới khi đủ điều kiện hoàn thành và được nhóm trưởng review.
