# Hướng dẫn bản tích hợp và luồng MVC

## Chuyển từ bản cũ

Giữ `.env`, `.git` và dữ liệu. Cài bằng `npm ci`; cần Atlas hoặc MongoDB replica set để giữ nhiều ô trong transaction. Không thêm thư mục src.

Nếu đã có dữ liệu bản một giờ: dừng server, sao lưu DB, chạy `npm run migrate` để xem trước, rồi `npm run migrate -- --apply` khi kết quả đúng dữ liệu mong đợi. Apply có thay đổi cấu trúc/index, không xóa đơn cũ. Không chạy các lệnh lên database khác do nhầm DB_NAME.

Index `{court,date,startHour}` cũ vẫn tồn tại dù bỏ khỏi file Model. Nếu không chuyển, nhiều đơn mới thiếu startHour có thể đụng giá trị rỗng. Migration chuyển lượt cũ thành hai ô, giữ `_id`, user và tổng tiền, đánh dấu `LEGACY_RESERVED`/`UNPAID`, tạo lock giữ lịch và xử lý index cũ. Chạy lại không tạo trùng. Tài khoản cũ là CUSTOMER; cơ sở chưa có chủ cần ADMIN cấp.

## Tài khoản và quyền

| Loại | Cách tạo | Quyền |
|---|---|---|
| CUSTOMER | `/register` | Đặt, xem đơn mình, gửi yêu cầu hủy/đổi |
| Vãng lai | Tên/SĐT trên form đặt | Đặt, xem/lưu phiếu qua link riêng; gọi cơ sở để hủy |
| OWNER chờ | `/register/owner` | Xem trạng thái, chưa sửa sân |
| OWNER đã duyệt | ADMIN cấp cơ sở | Sân/giá/đơn/yêu cầu của đúng cơ sở |
| ADMIN | `npm run admin:grant -- --email ...` | Duyệt/cấp cơ sở cho chủ sân |

Hồ sơ chủ sân mới chỉ kiểm tra định dạng, chưa OTP hoặc xác minh pháp lý. Người duyệt đối chiếu trước khi cấp quyền. Không đăng ký ADMIN qua web.

## Mỗi file làm gì và nối với file nào?

| File/thư mục | Vai trò |
|---|---|
| server.js | Kết nối DB, kiểm tra cấu trúc/replica set, chờ index, tạo MongoStore rồi gọi app và mở cổng |
| app.js | EJS/static/body/session → người dùng/CSRF → routes → xử lý lỗi |
| middlewares/auth.middleware.js | Tìm user từ session; requireAuth/requireOwner/requireAdmin kiểm tra quyền |
| middlewares/csrf.middleware.js | Tạo token form và kiểm tra mọi POST |
| controllers/auth.controller.js | Đăng ký khách/chủ sân chờ duyệt, băm mật khẩu, login/session/logout |
| controllers/admin.controller.js | Duyệt và cấp cơ sở trong transaction |
| controllers/owner.controller.js | Sân/giá/đơn đúng cơ sở; gọi service xử lý yêu cầu |
| controllers/court.controller.js | Đọc sân/lịch, truyền slots sang View |
| controllers/booking.controller.js | Nhận form, xử lý link khách, checkout/phiếu/lịch sử/yêu cầu |
| services/booking.service.js | Giữ nhiều ô, hết hạn, mô phỏng tiền, quyền xem, yêu cầu và hoàn thủ công |
| domain/booking-rules.js | Ô 30 phút, giờ Việt Nam, giá thường/cao điểm |
| models/ | User, Facility, Court, Booking, SlotLock, Payment, BookingRequest và index |
| views/ | Dữ liệu controller → HTML; không quyết định tiền đã nhận hoặc giá cuối |
| public/js và public/css | Chọn ô, đồng hồ, in phiếu, bố cục; server kiểm tra lại |
| scripts/chuyen-du-lieu-v2.js | Dry-run/apply dữ liệu cũ |
| scripts/cap-quyen-admin.js | Cấp ADMIN cho email đã đăng ký |
| scripts/tao-du-lieu-demo.js | Tạo sân mẫu, không tạo tài khoản/xóa DB |

## Luồng đặt và lưu phiếu

```text
POST /bookings → app đọc body/session → CSRF
→ route → controller → service kiểm tra khách/sân/ngày/ô/giá
→ transaction Booking HOLD + tất cả SlotLock
→ checkout đếm 10 phút
→ POST demo-payment khi DEMO_MODE=true
→ kiểm tra quyền, hạn và đủ lock → CONFIRMED/DEMO_PAID
→ phiếu từ Booking thật, ghi mô phỏng → In / Lưu PDF
```

Khách có tài khoản gắn Booking.user. Khách vãng lai có hash token xem riêng. Mã đơn/SĐT không cấp quyền quản lý; token vãng lai không cho tự hủy/đổi.

Giá được lưu từng ô lúc đặt; đổi bảng giá không thay đơn cũ. Các ô rời nhau không làm giữ ô nằm giữa. Giữ đủ mọi ô hoặc không giữ ô nào. Hết hạn không được thanh toán để lấy lại sân.

## Hủy/đổi và hoàn thủ công

Khách có tài khoản gửi yêu cầu cho đơn của mình. OWNER đúng cơ sở duyệt hoặc từ chối. Đổi toàn đơn trong cùng cơ sở; lịch cũ giữ tới khi lịch mới được cấp thành công. Chủ sân xử lý chênh lệch và nhập khoản hoàn; không tự áp chính sách phí/hoàn.

Khách vãng lai gọi số điện thoại cơ sở; OWNER hủy sau khi tiếp nhận. Chủ sân tự chuyển hoàn bên ngoài rồi ghi nhận trên web; chức năng không chuyển tiền tự động. Đơn mô phỏng vẫn phải ghi đúng là mô phỏng.

## Bài thử để trình bày

1. Đăng ký tài khoản nhóm trưởng, dùng script cấp ADMIN, đăng nhập lại.
2. Đăng ký OWNER, kiểm tra trạng thái chờ; ADMIN duyệt và cấp cơ sở mẫu.
3. OWNER sửa giá/giờ, tạo/sửa sân. Thử OWNER khác không được sửa cơ sở này.
4. Khách chọn hai ô rời nhau qua mốc cao điểm; kiểm tra tổng giá và ô ở giữa vẫn trống.
5. Hai cửa sổ đặt cùng ô: chỉ một đơn giữ được. Đơn quá hạn không được thanh toán; ô mở lại.
6. Thanh toán mô phỏng, in/lưu PDF phiếu có nhãn mô phỏng.
7. Khách gửi yêu cầu hủy/đổi, OWNER xử lý và ghi nhận hoàn. Đổi bị trùng giữ nguyên lịch cũ.
8. Khách vãng lai đặt tên/SĐT, giữ link phiếu và gọi điện để hủy; không có quyền tự hủy.

Phần QR/ngân hàng còn dở và hình minh họa nằm ở [THANH_TOAN_CON_DANG_DO.md](THANH_TOAN_CON_DANG_DO.md).
