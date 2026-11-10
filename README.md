# Sân Thể Thao — bản tích hợp MVC

**Bản demo final:** [Cách chạy và kịch bản trình bày](docs/BAN_DEMO_FINAL.md) · [Kết quả kiểm thử](docs/KIEM_THU_FINAL.md). Có ảnh cơ sở/sân, check-in và báo cáo thu/hoàn mô phỏng.

Node.js 24, Express, EJS, Mongoose/MongoDB Atlas. Giữ MVC ở thư mục gốc, không có `src`.

Có tài khoản khách và chủ sân chờ duyệt; đặt vãng lai bằng tên/SĐT; nhiều ô 30 phút rời nhau; giá thường/cao điểm; giữ tối đa 10 phút, trước khi ô đầu tiên bắt đầu; thanh toán **mô phỏng**; in/lưu PDF phiếu; chủ sân xử lý yêu cầu hủy/đổi và ghi nhận hoàn thủ công.

**Chưa nối QR/ngân hàng thật.** Hình QR không thể thanh toán; `DEMO_PAID` không phải xác minh tiền về. Xem [việc còn dở](docs/THANH_TOAN_CON_DANG_DO.md).

## Cài và chạy

```powershell
npm ci
```

Giữ `.env` riêng đang dùng; nếu chưa có, copy từ `.env.example` rồi điền `MONGODB_URI`, `DB_NAME`, `SESSION_SECRET` ít nhất 32 ký tự ngẫu nhiên và `PORT=3000`. **Xóa hoàn toàn key cũ `DEMO_MODE`**, kể cả khi nó bằng `false`; bản này dùng một hợp đồng `PAYMENT_MODE` trên server.

`PAYMENT_MODE` mặc định `off`. Để trình bày bằng dữ liệu tổng hợp, chọn `PAYMENT_MODE=demo`. Với `NODE_ENV=production`, demo còn yêu cầu `DEMO_DATA_ONLY=true` và `DB_NAME` tường minh, không rỗng. Cam kết dữ liệu không tự kiểm tra nội dung DB: phải dùng DB/tài khoản thử riêng, không dùng Atlas chung hoặc tên/SĐT/thông tin khách hàng thật. `live` hiện bị từ chối khi khởi động, chưa nối ngân hàng. Xem [hợp đồng chế độ thanh toán](docs/CHE_DO_THANH_TOAN.md). Atlas cần hỗ trợ transaction; MongoDB cục bộ cần replica set.

### Chuẩn bị production / Render

Build `npm ci`, start `npm start`, Node 24 qua `.node-version`, Web Service; server đọc `PORT` do host cấp và bind `0.0.0.0`. Không cần `NODE_VERSION` trên host trừ khi chủ động ghi đè bản Node. `GET /health` và `HEAD /health` kiểm tra sẵn sàng DB trước session/auth, trả 200 hoặc 503 và không chứa secret. Cookie production vẫn Secure/HttpOnly/SameSite=Lax và session lưu MongoStore.

Giữ các biến `RATE_LIMIT_*` trong `.env.example` để cấu hình giới hạn gửi form. `TRUST_PROXY_IPS` chỉ nhận danh sách IP/CIDR proxy đã được xác minh; để trống thì không tin các header chuyển tiếp. Cookie Secure qua proxy chỉ được cấp khi kết nối đến từ proxy tin cậy và báo HTTPS. Không đổi sang `trust proxy = 1` hoặc tin mọi IP để bỏ qua việc xác minh. Xem [hạn mức và proxy](docs/GIOI_HAN_YEU_CAU.md) và [hợp đồng chế độ thanh toán](docs/CHE_DO_THANH_TOAN.md); triển khai Render vẫn cần thử HTTPS/header/IP trên hạ tầng thực tế.

Đây là chuẩn bị code #81, **chưa có URL online hoặc kết quả nghiệm thu hosting**. Hướng dẫn #82 đã tích hợp tại [triển khai Render](docs/TRIEN_KHAI_RENDER.md); triển khai thực tế cần quyền hosting/DB demo và kiểm tra trên host.

### Nếu database có dữ liệu bản một giờ cũ

Dừng server và sao lưu database. Lệnh đầu chỉ xem trước, không ghi dữ liệu/index:

```powershell
npm run migrate
npm run migrate -- --apply
```

Migration giữ `_id`, tài khoản, tổng tiền và lịch cũ; mỗi lượt một giờ thành hai ô 30 phút. Đơn cũ là `LEGACY_RESERVED`, chưa ghi nhận tiền. Script xử lý index giờ nguyên cũ để đơn mới không va giá trị rỗng; chạy lại không tạo đơn/lock trùng. Xem [hướng dẫn](docs/HUONG_DAN_TICH_HOP.md).

### Database mới hoặc sau khi chuyển dữ liệu

```powershell
npm run seed
npm start
```

Seed thêm cơ sở/sân mẫu, không tạo tài khoản hoặc xóa dữ liệu. Mở http://localhost:3000.

Seed bổ sung mẫu còn thiếu để tổng cộng có 4 cơ sở; nếu đã có từ 4 cơ sở thì giữ nguyên. DB trống có Demo MVC, Hải Châu, Thanh Khê và Sơn Trà. Trang chủ có ảnh đại diện và đường dẫn đến sân của từng cơ sở. OWNER quản lý ảnh trong form sửa cơ sở/sân; xem [cấu hình Cloudinary và hướng dẫn ảnh](docs/HINH_ANH_CO_SO_VA_SAN.md). Chưa cấu hình kho ảnh vẫn xem và đặt sân được với hình minh họa.

## Cấp ADMIN và chủ sân

1. Đăng ký một tài khoản khách riêng cho nhóm trưởng tại `/register`.
2. Dừng server, cấp ADMIN cho email đã đăng ký:

   ```powershell
   npm run admin:grant -- --email email-nhom-truong@example.com
   npm start
   ```

3. Chủ sân đăng ký tại `/register/owner`, chờ duyệt. ADMIN đăng nhập lại vào `/admin`, cấp cơ sở mẫu chưa có chủ hoặc tạo cơ sở từ hồ sơ đề nghị.
4. OWNER vào `/owner`, cấu hình sân/giờ/giá. Cơ sở chưa được cấp chủ sân/số liên hệ chưa nhận đơn mới. Mỗi chủ quản lý một cơ sở với nhiều sân.

OWNER đã được cấp cơ sở có thể mở **Lịch điều hành sân** tại `/owner/calendar`: xem tất cả sân theo ngày, trạng thái từng ô 30 phút và bảy ngày từ hôm nay. Đây là bảng chỉ đọc; [hợp đồng backend và kết quả thử](docs/HOP_DONG_LICH_DIEU_HANH.md) bàn giao cho phần UI tiếp theo.

## Luồng trình bày

Khi `PAYMENT_MODE=demo` và các điều kiện dữ liệu được đáp ứng: ADMIN duyệt OWNER → OWNER cấu hình sân/giá → CUSTOMER hoặc khách vãng lai chọn nhiều ô → giữ tối đa 10 phút, trước khi ô đầu tiên bắt đầu → QR minh họa → bấm thanh toán mô phỏng → phiếu có nhãn mô phỏng → In / Lưu PDF. Mode `off` chặn tạo thanh toán mô phỏng mới nhưng giữ nguyên nhãn các đơn/phiếu `DEMO_PAID` đã lưu.

Hạn giữ là mốc sớm hơn giữa 10 phút từ lúc tạo đơn và lúc ô đầu tiên bắt đầu, tính bằng thời gian UTC của máy chủ. Ví dụ chọn ô bắt đầu sau 3 phút thì chỉ giữ 3 phút. Từ đúng mốc hết hạn, đơn HOLD không được thanh toán để giữ lại sân. Đơn CONFIRMED và các ô đã xác nhận không bị tác vụ hết hạn HOLD giải phóng.

Khách có tài khoản xem `/my-bookings` và gửi yêu cầu hủy/đổi. OWNER xét duyệt, xử lý chênh lệch và ghi nhận hoàn thủ công. Khách vãng lai giữ link phiếu và gọi điện cơ sở; OWNER hủy sau khi tiếp nhận cuộc gọi.

Một đơn thuộc một sân/một ngày; giá snapshot từng ô. Đổi toàn đơn trong cùng cơ sở và giữ lịch cũ tới khi đổi thành công. Không tự áp phí 30.000đ hoặc mức hoàn 100%/50%. Link khách vãng lai không cấp quyền tự hủy/đổi.

## Kiểm tra

```powershell
npm run check
npm test
```

`check` chạy ESLint và biên dịch EJS. Test dùng DB tạm riêng trên MongoDB replica set cục bộ ở `127.0.0.1:27029` mặc định; CI tự tạo replica set. Không chạy test trên Atlas của nhóm.

- [Cách chạy, chuyển dữ liệu và luồng từng file](docs/HUONG_DAN_TICH_HOP.md)
- [QR/thanh toán thật còn dở](docs/THANH_TOAN_CON_DANG_DO.md)
- [Hợp đồng dữ liệu/route](docs/HOP_DONG_TICH_HOP.md)
- [Chuẩn bị triển khai Render và bàn giao demo — Draft, chưa có bàn giao online](docs/TRIEN_KHAI_RENDER.md)
- [Chế độ thanh toán và production public-demo](docs/CHE_DO_THANH_TOAN.md)
- [Hạn mức gửi form và cấu hình proxy](docs/GIOI_HAN_YEU_CAU.md)

Không commit `.env`, mật khẩu, connection string có thông tin đăng nhập hoặc `node_modules`.

## Bản mở rộng sân ghép và dịch vụ

Nhánh `feat/san-ghep-va-dich-vu` bổ sung tạo nhóm từ đơn đã thanh toán mô phỏng, đăng ký từng người, chia tiền khi chốt và yêu cầu nước/đồ thuê. Xem [luồng sử dụng, kiểm thử và giới hạn](docs/SAN_GHEP_VA_DICH_VU.md).

## Triển khai Vercel

Nhánh `feat/trien-khai-vercel` có entry point function và đóng gói EJS/static cho Vercel, bao gồm bản sân ghép. Xem [cấu hình, biến môi trường và cách kiểm tra sau deploy](docs/TRIEN_KHAI_VERCEL.md). Chưa có deployment Vercel được nghiệm thu.
