# Hợp đồng chế độ thanh toán — #81

Tài liệu ngày 04/11/2026 cho phần chuẩn bị production/public-demo. Cấu hình này chưa chứng minh đã có service hoặc URL online; triển khai thật thuộc #82, nghiệm thu sau triển khai thuộc #83. [Hướng dẫn Render đang chuẩn bị ở PR #94](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/94) cần được cập nhật theo hợp đồng này khi tích hợp.

## Một nguồn quyết định trên server

`config/payment-mode.js` cung cấp `getPaymentConfig(env)` cho server, app locals và service thanh toán. `PAYMENT_MODE` là cờ duy nhất chọn chế độ; form, query, cookie hoặc JavaScript phía client không được bật/tắt nó. Các thao tác ghi tiền luôn kiểm tra cấu hình phía server, kể cả khi client tự gửi POST không có nút tương ứng trên UI.

| `PAYMENT_MODE` | Ý nghĩa hiện tại |
| --- | --- |
| Không khai báo hoặc `off` | Mặc định tắt việc tạo thanh toán mô phỏng mới. Không tạo `INITIAL_DEMO`/`EXTRA_DEMO` mới; cũng chưa có thanh toán thật |
| `demo` | Cho phép mô phỏng qua luồng có CSRF/quyền/hạn giữ/lock hợp lệ. Luôn ghi và hiển thị là mô phỏng |
| `live` | Giá trị dành cho #84, **hiện bị từ chối khi khởi động**. Chưa có ngân hàng/QR thật, không tự chuyển sang demo |

Giá trị ngoài hợp đồng làm cấu hình bị từ chối. Biến cũ **`DEMO_MODE` phải được xóa hoàn toàn** khỏi môi trường; chỉ đổi thành `DEMO_MODE=false` vẫn bị từ chối. Không giữ hai cờ để chọn chế độ trái nhau.

`off` chỉ chặn phát sinh mô phỏng mới, không xóa hoặc viết lại dữ liệu đã lưu. Phiếu/đơn từng có `DEMO_PAID` vẫn ghi rõ mô phỏng. Hủy đơn và ghi nhận hoàn thủ công theo quyền hiện có vẫn là các thao tác nghiệp vụ riêng; chúng không tự chuyển tiền. Đơn được duyệt đổi mà cần thu thêm qua `EXTRA_DEMO` cũng phải được mode cho phép trước khi hoàn tất thao tác.

## Điều kiện production public-demo

`NODE_ENV=production` cùng `PAYMENT_MODE=demo` chỉ hợp lệ khi **đồng thời** có:

- `DEMO_DATA_ONLY=true`;
- `DB_NAME` được khai báo tường minh, không rỗng hoặc chỉ có khoảng trắng.

Nếu `DEMO_DATA_ONLY` được khai báo, giá trị chỉ được là chuỗi `true` hoặc `false`. Thiếu điều kiện production/demo làm startup từ chối; không hạ `NODE_ENV` xuống development để chạy online.

`DEMO_DATA_ONLY=true` là **cam kết của người vận hành**, không phải bộ kiểm tra hoặc bộ lọc nội dung database. Operator phải cấp DB và tài khoản thử cô lập, xác minh đúng project/cluster/DB trước startup; không dùng DB thật/Atlas chung hoặc dữ liệu khách hàng riêng tư. Không đưa tên, số điện thoại hay thông tin của người thật vào dữ liệu demo. Các ràng buộc này áp dụng cả khi mode demo chạy cục bộ.

| Môi trường | Mode | Điều kiện thêm | Kết quả dự kiến |
| --- | --- | --- | --- |
| Bất kỳ | Không khai báo / `off` | Cấu hình còn lại hợp lệ | Tắt mô phỏng mới |
| Development/test | `demo` | Chỉ DB/tài khoản/dữ liệu tổng hợp | Cho mô phỏng; vẫn kiểm tra quyền/CSRF/giữ chỗ |
| Production | `demo` | `DEMO_DATA_ONLY=true`, `DB_NAME` tường minh | Cho public-demo với nhãn mô phỏng |
| Production | `demo` | Thiếu cam kết dữ liệu hoặc tên DB tường minh | Từ chối khởi động |
| Bất kỳ | `live`, mode sai, hoặc còn key `DEMO_MODE` | — | Từ chối khởi động |

Ví dụ **các biến không chứa secret** cho một DB demo đã được nhóm trưởng cấp; các giá trị cần được đối chiếu trước khi sử dụng:

```dotenv
NODE_ENV=production
PAYMENT_MODE=demo
DEMO_DATA_ONLY=true
DB_NAME=YOUR_DEDICATED_DEMO_DB
```

`MONGODB_URI` và `SESSION_SECRET` nhập bằng cơ chế secret riêng của host, không gửi vào issue/PR/ảnh/log. Giữ `SESSION_SECRET` ổn định qua restart để session hợp lệ không mất vì đổi khóa. `.env.example` chỉ là mẫu, không chứa giá trị bí mật dùng được.

## Chuẩn bị chạy trên Render

Giữ Node **24**, MVC ở gốc repo; build `npm ci`, start `npm start`. Chọn Web Service cho Express/EJS. Server bind `0.0.0.0` và đọc `PORT` do host cấp, không hardcode cổng 3000 cho hosting. Repo có `.node-version` đặt `24` để Render chọn dòng Node này; không cần thêm `NODE_VERSION` trừ khi chủ động ghi đè bằng bản đã kiểm thử. Biến `NODE_VERSION` có ưu tiên cao hơn file, nên phải đối chiếu nếu host đã có sẵn. Xem [Express deploy](https://render.com/docs/deploy-node-express-app), [Web Services](https://render.com/docs/web-services) và [Node version](https://render.com/docs/node-version).

Startup vẫn kiểm tra tương thích DB/replica set, chờ index và dọn HOLD theo luật hiện có. Đây không phải lệnh chỉ đọc: phải xác minh đúng DB demo và kế hoạch backup/migration trước khi mở server. Không tự migrate hoặc tạo index trên Atlas dùng chung. Lệnh migration mặc định dry-run, apply riêng theo [hướng dẫn tích hợp](HUONG_DAN_TICH_HOP.md).

Phiên dùng **MongoStore**, cookie `Secure` ở production, `HttpOnly`, `SameSite=Lax`, cùng CSRF/auth hiện có. Nhánh #81 dựa trên main `5c3e72d` giữ `trust proxy = 1` ở production; đây chưa phải kết luận cấu hình proxy/limiter cuối cùng cho Render. Khi tích hợp #80/PR #92, phải giữ resolver địa chỉ IP/CIDR đã được kiểm thử và cấu hình đúng proxy thật; không ghi đè resolver đó trở lại số hop 1 khi merge. `TRUST_PROXY_IPS` thuộc phần #80, chưa phải biến được code #81 sử dụng nên không có trong `.env.example` của nhánh này.

Express yêu cầu cách trust proxy khớp đường đi của request; số hop có rủi ro nếu tồn tại đường ngắn hơn dự kiến. Trước #82 phải kiểm tra HTTPS/cookie và key IP của limiter qua proxy, kể cả header giả. Xem [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/) và [ví dụ xác thực của Render](https://render.com/articles/how-to-implement-authentication-and-authorization). Không coi một ví dụ hop 1 là bằng chứng đã kiểm thử toàn bộ hạ tầng.

## Health endpoint và bằng chứng nghiệm thu

`GET /health` và `HEAD /health` là endpoint công khai, đặt trước session/auth/CSRF để không tạo session cho health probe. Khi DB sẵn sàng, GET trả HTTP `200` với `{"status":"ok"}`; khi không sẵn sàng, trả HTTP `503` với `{"status":"unavailable"}`. HEAD dùng cùng status và không có response body. DB ping có timeout driver 2 giây; các probe đồng thời dùng chung lần ping đang chạy. Phản hồi không có URI, tên DB, secret hoặc dữ liệu người dùng. Render hỗ trợ HTTP health path để xét readiness và restart instance; xem [Health Checks](https://render.com/docs/health-checks).

Trước bàn giao #82 cần ghi SHA đã thử, chạy check/test trên DB thử riêng và đối chiếu tối thiểu: production/demo hợp lệ; off chặn POST mô phỏng ban đầu và thu thêm; client không đổi mode; cấu hình sai/live/legacy bị từ chối; session/CSRF/cookie HTTPS còn hoạt động; health không tạo session hoặc lộ thông tin. Nhãn `DEMO_PAID` trên dữ liệu cũ phải còn đúng khi đổi sang off. Kết quả local/CI không thay thử HTTPS/thiết bị khác trên hosting.

## Ranh giới dành cho #84

#84 phải mở rộng **cùng** cấu hình `PAYMENT_MODE` khi đã có hợp đồng nhà cung cấp, xác minh callback/đối soát và kiểm thử giao dịch. Không thêm một cờ thứ hai để bật live, không tin client báo đã trả tiền và không biến dữ liệu `DEMO_PAID` cũ thành `PAID`. Hiện `live` vẫn từ chối startup; xem [phần thanh toán còn dở](THANH_TOAN_CON_DANG_DO.md).
