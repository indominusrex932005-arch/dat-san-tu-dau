# Triển khai bản demo lên Render — #82

Refs #82. **Cập nhật ngày 05/11/2026; giữ PR Draft. Chưa được bàn giao URL HTTPS, release SHA hoặc bằng chứng triển khai online.** Đây là hướng dẫn đã cập nhật, không phải xác nhận đã tạo service/DB hay hoàn thành #82.

Cập nhật nguồn ngày **06/11/2026**: main `e8133a77e28b352ca0286afd6b8613e7fb799e3c` đã có #95 (mode/health) và #98 qua #102 (payment intent core). Đây là SHA nguồn đã đọc, **không phải release SHA đang chạy**. Hợp đồng [chế độ thanh toán](CHE_DO_THANH_TOAN.md) đã có trên main. Mặc định chưa có adapter/người nhận được cấu hình; core payment intent không chứng minh QR hoặc ngân hàng hoạt động. #99–#101 còn được sửa/kiểm tra trên nhánh tích hợp; không coi chúng là một phần của release main này.

## 1. Điều kiện mở triển khai

| Điều kiện | Trạng thái hiện có |
| --- | --- |
| Limiter và resolver proxy của #80/#92 | Đã có trên main `e8133a7`; vẫn phải xác minh proxy thật của service |
| Production public-demo, mode và `/health` của #81/#95 | Đã merge #95; vẫn cần cấu hình và xác minh môi trường deploy thực |
| Quyền Render/GitHub, Atlas demo và executor bootstrap bảo mật | Chưa được xác minh/bàn giao cho lần deploy này |
| Service, vùng, gói, số instance, auto-deploy và DB demo | Chưa được chọn/xác minh |
| URL HTTPS, release SHA, deploy ID, kết quả thử từ thiết bị khác | Chưa bàn giao / chưa chạy |

Chỉ deploy release main được duyệt và đối chiếu lại SHA/config cuối. Main đã có limiter và hợp đồng public-demo của #95; không dùng `NODE_ENV=development` online để vượt điều kiện. Local test 181/181 và [CI #95](https://github.com/indominusrex932005-arch/dat-san-tu-dau/actions/runs/41927058743) ở source `b605408` là bằng chứng code/DB thử, **không phải kết quả HTTPS Render**.

## 2. Tạo Web Service và chọn phiên bản

Trên Render chọn **New → Web Service**, nối đúng Git provider/repo. Express/EJS cần server Node. Các trường dưới đây là cấu hình dự kiến, chưa phải service đã tạo: [Express deploy](https://render.com/docs/deploy-node-express-app), [Web Services](https://render.com/docs/web-services).

| Trường | Giá trị cần dùng/xác nhận |
| --- | --- |
| Repository / Branch | `indominusrex932005-arch/dat-san-tu-dau`, `main` sau merge #95; đối chiếu release SHA đầy đủ |
| Root Directory / Runtime | Gốc repo có `package.json`, `server.js`; Node, không nhập đường dẫn Windows |
| Node version | `.node-version` của #95 đặt `24`; ghi patch thực tế từ build log |
| Build / Start | `npm ci` / `npm start` |
| Host / Port | Server bind `0.0.0.0`, đọc `PORT` Render cấp; không hardcode 3000 trên hosting |
| Region | Singapore là đề xuất để nhóm trưởng chọn; **chưa chọn** |
| Compute / instance | Free, một instance là đề xuất nếu phù hợp hạn mức; **chưa chọn** |
| Auto-Deploy | Đề xuất Off ở lượt đầu và deploy thủ công SHA được duyệt; **chưa cấu hình** |
| Health Check Path | `/health` sau tích hợp #95; xác minh GET 200 trước nghiệm thu |

Không cần `NODE_VERSION` nếu dùng `.node-version`; biến này có ưu tiên cao hơn file nên phải xóa hoặc đối chiếu mọi override cũ. Không dựa vào default theo ngày tạo service. [Node version](https://render.com/docs/node-version).

Free có thể ngủ sau 15 phút idle, đánh thức khoảng một phút và có thể restart; không có Shell, one-off jobs hoặc persistent disk. Chỉ dùng cho demo theo lựa chọn được duyệt, lưu bền vững trong Atlas. Kiểm tra usage/giới hạn workspace; gói trả phí hoặc outbound IP riêng cần nhóm trưởng chốt trước, không tự nâng cấp. [Giới hạn Free](https://render.com/docs/free).

## 3. Cấu hình môi trường, proxy và limiter

Nhập `MONGODB_URI` và `SESSION_SECRET` trực tiếp trong Environment/secret store của host hoặc executor bảo mật được cấp. Không đưa giá trị thật vào Git, issue/PR, ảnh, log, tham số dòng lệnh hay shell history. Bảng này chỉ chứa placeholder:

| Biến | Hợp đồng sau #95 |
| --- | --- |
| `NODE_ENV` | `production` |
| `PAYMENT_MODE` | Mặc định `off`; chọn tường minh `demo` cho lượt public-demo được duyệt. `live` hiện từ chối startup |
| `DEMO_DATA_ONLY` | Production/demo bắt buộc `true`; nếu khai báo chỉ nhận chuỗi `true` hoặc `false` |
| `DB_NAME` | `<DEDICATED_DEMO_DB_NAME>`, khai báo tường minh, không rỗng/không chỉ khoảng trắng |
| `MONGODB_URI` | `mongodb+srv://<DEMO_DB_USER>:<URL_ENCODED_PASSWORD>@<DEMO_CLUSTER>/`; giá trị thật nhập riêng |
| `SESSION_SECRET` | `<PRIVATE_RANDOM_VALUE_AT_LEAST_32_CHARACTERS>`; giữ ổn định qua restart/deploy |
| `TRUST_PROXY_IPS` | Danh sách IP/CIDR proxy **đã xác minh**, cách nhau bằng dấu phẩy; trống nghĩa không tin header chuyển tiếp |

**Xóa hẳn key `DEMO_MODE` khỏi Environment và mọi nguồn cấu hình cũ; `DEMO_MODE=false` vẫn bị từ chối.** Production/demo cần đồng thời `DEMO_DATA_ONLY=true` và `DB_NAME` tường minh. Cam kết env không kiểm tra nội dung DB: chỉ DB/tài khoản/dữ liệu tổng hợp cô lập, không Atlas chung, tên/SĐT hoặc dữ liệu khách thật. Không cấu hình tài khoản ngân hàng, KYC, merchant hoặc thanh toán live trong lần demo này. Mode off chặn mô phỏng INITIAL/EXTRA mới nhưng giữ nhãn `DEMO_PAID` cũ và nghiệp vụ hủy/hoàn thủ công theo quyền.

Giữ resolver IP/CIDR của #92/#95, không đổi thành hop 1, tin mọi IP hoặc lấy loopback `127.0.0.1/32` của fixture local làm cấu hình Render. Operator phải xác minh các hop và việc proxy xử lý `X-Forwarded-For`/`X-Forwarded-Proto`/`X-Forwarded-Host`, kể cả đường truy cập nội bộ/trực tiếp. Nếu chưa xác minh được, để trống theo mặc định an toàn và chưa mở demo: cookie Secure sau proxy có thể không được cấp, mọi người có thể chung quota IP proxy. **CIDR outbound dùng cho Atlas ở mục 4 không phải danh sách inbound proxy để điền `TRUST_PROXY_IPS`.** [Hợp đồng limiter/proxy ở main đã đọc](https://github.com/indominusrex932005-arch/dat-san-tu-dau/blob/180a3c586f86276778f9f5492e998f64688016a0/docs/GIOI_HAN_YEU_CAU.md), [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/).

Đủ **10 biến limiter** trong mẫu #95, có thể bỏ để dùng default; không tự hạ ngưỡng trên service dùng chung để thử 429:

```dotenv
RATE_LIMIT_LOGIN_WINDOW_SECONDS=900
RATE_LIMIT_LOGIN_IP_MAX=60
RATE_LIMIT_LOGIN_ACCOUNT_IP_MAX=8
RATE_LIMIT_REGISTER_WINDOW_SECONDS=900
RATE_LIMIT_REGISTER_IP_MAX=12
RATE_LIMIT_REGISTER_OWNER_WINDOW_SECONDS=900
RATE_LIMIT_REGISTER_OWNER_IP_MAX=12
RATE_LIMIT_BOOKINGS_WINDOW_SECONDS=600
RATE_LIMIT_BOOKINGS_IP_MAX=60
RATE_LIMIT_BOOKINGS_ACTOR_MAX=12
```

Chỉ POST `/login`, `/register`, `/register/owner`, `/bookings` có limiter sau session/auth/CSRF, trước controller. Login dùng IP và email+IP; bookings dùng IP và user/session. POST đến controller vẫn tính quota dù validation sai; CSRF 403 và 429 không trừ quota. 429 có `Retry-After`, không ghi nghiệp vụ. `*_WINDOW_SECONDS`: số nguyên 1–86400; `*_MAX`: 1–100000. Bộ đếm RAM riêng từng instance/reset khi restart, chưa phải quota chia sẻ nhiều instance. Ca 429 chỉ chạy trên service/khung thử cô lập, ngân sách nhỏ và policy đã được duyệt trong #83.

## 4. Atlas demo riêng, backup và bootstrap

1. Nhóm trưởng cấp project/cluster, DB, user và dữ liệu demo riêng; xác minh replica set/transaction và đích thực tế trước mọi lệnh/startup. Không sao chép dữ liệu khách hoặc URI Atlas chung.
2. Database user chỉ có quyền cần thiết trên DB demo; quyền backup/migration tách nếu cần. Database user khác tài khoản quản trị Atlas. [Database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).
3. Lấy dải CIDR của **service → Connect → Outbound** rồi cấu hình Atlas IP access list. Chỉ thêm IP máy vận hành trong thời gian cần; không mặc định `0.0.0.0/0`. Outbound có thể dùng chung trong vùng, vẫn cần xác thực DB user. [Render outbound IPs](https://render.com/docs/outbound-ip-addresses), [Atlas IP access list](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
4. Dừng writer, backup DB nếu đã có dữ liệu; lưu riêng ngoài repo và xác minh restore vào DB thử khác. Atlas Free không có Cloud Backup; chọn phương án dump/restore phù hợp gói thực tế. [Backup Atlas](https://www.mongodb.com/docs/atlas/backup-restore-cluster/).

Ví dụ backup không chứa bí mật: operator chuẩn bị config riêng, giới hạn quyền đọc và giữ ngoài repo/history. `--config` tránh đưa URI/password vào tham số lệnh. [mongodump](https://www.mongodb.com/docs/database-tools/mongodump/#--config).

```text
mongodump --config="<PRIVATE_DUMP_CONFIG_PATH>" --db="<DEMO_DB_NAME>" --archive="<PRIVATE_BACKUP_PATH>" --gzip
```

`npm start` **không phải kiểm tra DB chỉ đọc**: sau guard cấu hình, server vẫn kiểm tra tương thích/replica set, chờ `Model.init()` và dọn HOLD bằng `expireHolds()`. Cần xác minh đích/backup/kế hoạch ghi trước startup. Không tự tạo index hoặc migrate Atlas chung.

Chạy các lệnh dưới tại gốc repo trên **executor bảo mật được cấp**, env demo được inject riêng. Free không có Shell; chưa có executor phù hợp thì dừng bootstrap. Không thêm route nâng ADMIN, đưa seed/migration vào build/start hoặc tự chọn gói trả phí để có Shell.

```powershell
npm ci
npm run migrate
```

Lệnh migrate mặc định dry-run. DB mới: xác nhận không có dữ liệu v1 cần chuyển, không apply vô cớ. DB v1: review lỗi/số bản ghi/index dự kiến, backup và dừng writer; chỉ apply khi đúng đích/kế hoạch đã được duyệt, rồi dry-run lại:

```powershell
npm run migrate -- --apply
npm run migrate
```

Khi cấu trúc DB đã sẵn sàng, nạp dữ liệu tổng hợp nếu cần:

```powershell
npm run seed
```

Seed chỉ thêm cơ sở/sân mẫu, không tạo tài khoản hoặc xóa DB. Cơ sở mẫu chưa có owner/SĐT liên hệ hợp lệ chưa nhận đơn. Đăng ký CUSTOMER demo riêng tại `/register`, dừng app/writer khi vận hành rồi cấp ADMIN bằng phương thức hiện có trên đúng DB demo:

```powershell
npm run admin:grant -- --email "<REGISTERED_DEMO_ADMIN_EMAIL>"
```

Đăng nhập lại vào `/admin`, duyệt OWNER thử và cấp cơ sở/SĐT; OWNER cấu hình sân/giờ/giá. ADMIN không đăng ký qua form công khai. [Hướng dẫn tích hợp](HUONG_DAN_TICH_HOP.md).

## 5. Deploy và smoke test online

Sau khi đủ điều kiện, deploy thủ công release SHA được duyệt; đối chiếu repo/branch/commit trong Render và theo dõi Build/Deploy/Runtime logs. Chỉ giữ log đã lọc, không URI/cookie/CSRF/link guest. Render cấp TLS; phải thử HTTPS thực từ thiết bị/mạng khác, không coi native HTTP localhost gắn header HTTPS là bằng chứng online. [TLS](https://render.com/docs/tls).

Health path sau #95 là **`/health`**: GET trả `200 {"status":"ok"}` khi DB sẵn sàng hoặc `503 {"status":"unavailable"}`; HEAD cùng status, không body. Endpoint đặt trước session/auth/CSRF, không tạo session/cookie; DB ping giới hạn driver 2 giây, các probe đồng thời dùng chung ping đang chạy, không lộ URI/tên DB/user. Không dùng `/login` hoặc 404 làm bằng chứng DB khỏe. [Health Checks](https://render.com/docs/health-checks).

Cookie production phải Secure/HttpOnly/SameSite=Lax; phiên nằm trong MongoStore, CSRF/auth và limiter vẫn hoạt động sau proxy thực. Lưu kết quả với release SHA/thời gian/browser/thiết bị; chỉ chụp nội dung đã loại thanh địa chỉ/query/token, không xuất HAR/cookie jar. PDF tắt header/footer URL trước lưu, kiểm tra metadata và nhãn demo; không lưu bản thô có token rồi mới che.

| Ca online cần bằng chứng của đúng release | Thực tế / trạng thái hiện tại |
| --- | --- |
| HTTPS từ thiết bị/mạng khác; home/cơ sở/sân và CSS tải được | Chưa chạy; chưa có URL bàn giao |
| Health GET/HEAD, đúng DB demo, startup/index checks | Chưa chạy |
| Login → refresh/navigation giữ phiên, cookie và CSRF qua proxy; logout thu hồi session/cookie cũ | Chưa chạy |
| Hai mạng khách có nhận diện IP độc lập; header giả không đổi quyền HTTPS/IP quota | Chưa chạy; proxy service chưa được xác minh |
| POST thường/403 CSRF/429 với ngân sách được duyệt, Retry-After và không ghi nghiệp vụ khi bị chặn | Chưa chạy |
| Giữ nhiều ô → checkout → mô phỏng → receipt/PDF có nhãn; replay không nhân Payment, không `PAID` thật | Chưa chạy |
| Restart trước hạn: giữ deadline cũ, session còn hợp lệ; sau hạn: không hồi sinh HOLD | Chưa chạy; cần cửa sổ operator |
| CONFIRMED/DEMO_PAID và lock/Payment còn nguyên sau restart; kiểm tra số lượng bằng xác nhận DB chỉ đọc | Chưa chạy |
| Cold start đúng gói: ghi idle/wake/độ trễ thật; không dùng ping/cron để giả nghiệm thu ngủ | Chưa chạy; gói service chưa chốt |

Tách restart thủ công **trước hạn** khỏi cold start Free sau idle 15 phút: mọi HOLD tối đa 10 phút từ trước lần ngủ đó phải hết hạn, không kỳ vọng còn giữ chỗ. CONFIRMED/Payment bền vững và session chưa quá TTL phải còn; UI không đủ chứng minh số bản ghi, cần operator xác nhận chỉ đọc đã lọc. Không dùng CI/local làm PASS cho bảng này.

## 6. Cập nhật và rollback

Trước cập nhật, ghi SHA đang chạy/SHA mới, chạy `npm run check` và `npm test` trên DB replica thử; review thay đổi schema/migration/mode và khả năng rollback. Auto-deploy chỉ bật theo lựa chọn nhóm trưởng sau smoke test, không coi CI xanh là đã kiểm tra hosting. [Deploys](https://render.com/docs/deploys).

Nếu lỗi, dừng rollout và chọn deploy thành công còn tương thích DB/config tại **Deploys → Rollback**. Ghi SHA/deploy ID, đối chiếu lại mode, DB_NAME, proxy và secret bằng giao diện riêng rồi thử health/login/checkout. Render dùng lại một số config của deploy đích, gồm env; không quay về bản legacy thiếu hợp đồng public-demo bằng cách đổi cờ tùy tiện. Rollback Dashboard tắt auto-deploy; API không tự tắt, build artifact có giới hạn lưu. **Rollback code không hoàn tác MongoDB/schema/Payment**; restore DB chỉ theo backup/kế hoạch được duyệt, không tự migration ngược. [Rollbacks](https://render.com/docs/rollbacks).

## 7. Bàn giao #82 → #83

Chỉ điền bằng chứng từ lần deploy thật, không chép source SHA hoặc URL mẫu thành release live:

| Metadata / kết quả cần bàn giao | Hiện trạng |
| --- | --- |
| URL origin HTTPS công khai, không query/fragment | **Chưa bàn giao** |
| Release SHA đầy đủ 40 ký tự, đối chiếu GitHub commit và Render deploy | **Chưa bàn giao** |
| Render deploy ID, ngày/giờ + múi giờ, người thực hiện | **Chưa bàn giao** |
| Source repo/origin/branch đã xác minh cho deploy; dự kiến repo nêu ở mục 2 | **Chưa bàn giao xác nhận của lần deploy** |
| Service ID, region, compute plan, số instance, Node patch, auto-deploy | **Chưa bàn giao / chưa chốt** |
| Health path `/health`, kết quả GET/HEAD và logs startup đã lọc | Path theo hợp đồng #95; **kết quả online chưa chạy** |
| Alias DB demo, replica set/transaction, proxy/hạn mức thực tế; không URI/secret/IP riêng tư trong PR | **Chưa bàn giao** |
| Backup/restore thử, migration/seed/ADMIN đã thực hiện trên đúng DB | **Chưa chạy / chưa có xác nhận** |
| Browser/OS, viewport 390px/1366px, thiết bị vật lý/mạng khác, ảnh/PDF an toàn | **Chưa chạy / chưa có bằng chứng** |
| Kết quả từng ca, restart/cold start, lỗi và ca hoãn/người quyết định | **Chưa chạy / chưa có bằng chứng** |

Chuyển bộ metadata và bằng chứng thực sang [#83 / PR #96](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/96), cập nhật cùng URL/release SHA và giữ rõ ca đã/chưa chạy. **#82 chưa đủ bằng chứng hoàn thành; PR #94/#96 giữ Draft**, chờ nhóm trưởng review. Không đóng issue hoặc công bố online chỉ vì đã có hướng dẫn, deploy xanh hay CI đạt.
