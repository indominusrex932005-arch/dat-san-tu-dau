# Sân Thể Thao — bản tích hợp MVC

Node.js 24, Express, EJS, Mongoose/MongoDB Atlas. Giữ MVC ở thư mục gốc, không có `src`.

Có tài khoản khách và chủ sân chờ duyệt; đặt vãng lai bằng tên/SĐT; nhiều ô 30 phút rời nhau; giá thường/cao điểm; giữ tối đa 10 phút, trước khi ô đầu tiên bắt đầu; thanh toán **mô phỏng**; in/lưu PDF phiếu; chủ sân xử lý yêu cầu hủy/đổi và ghi nhận hoàn thủ công.

**Chưa nối QR/ngân hàng thật.** Hình QR không thể thanh toán; `DEMO_PAID` không phải xác minh tiền về. Xem [việc còn dở](docs/THANH_TOAN_CON_DANG_DO.md).

## Cài và chạy

```powershell
npm ci
```

Giữ `.env` riêng đang dùng; nếu chưa có, copy từ `.env.example`. Điền `MONGODB_URI`, `DB_NAME`, `SESSION_SECRET` ít nhất 32 ký tự ngẫu nhiên, `PORT=3000`. Đặt `DEMO_MODE=true` để trình bày. Không bật demo ở production. Atlas hỗ trợ transaction; MongoDB cục bộ cần replica set.

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

ADMIN duyệt OWNER → OWNER cấu hình sân/giá → CUSTOMER hoặc khách vãng lai chọn nhiều ô → giữ tối đa 10 phút, trước khi ô đầu tiên bắt đầu → QR minh họa → bấm thanh toán mô phỏng → phiếu có nhãn mô phỏng → In / Lưu PDF.

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

Không commit `.env`, mật khẩu, connection string có thông tin đăng nhập hoặc `node_modules`.
