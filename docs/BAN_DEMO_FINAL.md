# Bản demo final — ngày 07/11/2026

## Phạm vi đã thống nhất

Nhóm chọn thanh toán **mô phỏng** cho buổi trình bày. Các nút thu/hoàn và báo cáo mô phỏng không chứng minh có tiền ngân hàng. `PAYMENT_MODE=live` vẫn bị chặn. Giữ kiến trúc MVC ở gốc dự án.

## Cập nhật máy để chạy

Sau khi PR bản final đã merge vào main, mở Terminal tại thư mục có `package.json`:

```powershell
git status
git switch main
git pull --ff-only origin main
npm ci
npm run dev
```

Nếu `git status` báo có thay đổi riêng, lưu/commit chúng trên nhánh riêng trước khi đổi nhánh. Đừng xóa file của thành viên để kéo code.

Trong `.env` riêng, **xóa dòng `DEMO_MODE` cũ**, kể cả `false`. Cấu hình các giá trị này bên cạnh `MONGODB_URI` và `SESSION_SECRET` riêng đang sử dụng:

```dotenv
NODE_ENV=development
PORT=3000
PAYMENT_MODE=demo
DB_NAME=dat_san_demo
```

Dùng DB thử riêng và thông tin tổng hợp để trình bày. Nếu DB thử chưa có dữ liệu thì cần seed và cấp lại tài khoản/quyền tại DB đó; đổi `DB_NAME` không tự sao chép dữ liệu từ DB cũ. Không gửi `.env` thật qua GitHub. Mở http://localhost:3000; `/health` trả `{"status":"ok"}` khi DB sẵn sàng.

Nếu không có nút **Mô phỏng thanh toán toàn bộ**, kiểm tra `PAYMENT_MODE=demo` và khởi động lại server. QR minh họa không quét để chuyển tiền. Nhánh payment intent/webhook đã tích hợp có kiểm thử adapter giả lập, nhưng server mặc định chưa cấu hình nhà cung cấp; luồng trình bày dùng nút mô phỏng hiện có.

## Chuẩn bị bốn cơ sở

Dừng server, xác nhận đang chọn đúng DB thử rồi chạy **một lần**:

```powershell
npm run seed
```

- DB trống: tạo 4 cơ sở, mỗi cơ sở 2 sân.
- DB có 1–3 cơ sở: giữ nguyên chúng và thêm mẫu còn thiếu để đạt tổng 4.
- DB đã có từ 4 cơ sở: không thêm, không xóa để ép về 4.
- Chạy lại không đổi chủ sân, tên đã sửa, ảnh, số điện thoại, giá, đơn hoặc tài khoản cũ. Chạy một tiến trình seed khi không có người khác đang tạo cơ sở.
- Cơ sở mới chưa có chủ và liên hệ: ADMIN phải cấp cho OWNER, OWNER kiểm tra số liên hệ. Cơ sở chưa sẵn sàng vẫn hiện để xem nhưng chưa nhận đặt.

Seed không chạy tự động lúc mở web. Code/PR có script không có nghĩa Atlas của nhóm đã được nạp dữ liệu.

## Tài khoản cho buổi trình bày

1. Đăng ký tài khoản khách riêng của nhóm trưởng.
2. Chạy `npm run admin:grant -- --email EMAIL_DA_DANG_KY` trên đúng DB thử; đăng nhập lại để thấy `/admin`.
3. Chủ sân đăng ký tại `/register/owner`. ADMIN chọn **cơ sở có sẵn** để duyệt, tránh tạo thêm cơ sở thứ năm. Mỗi OWNER quản lý một cơ sở.
4. Dùng tài khoản CUSTOMER khác để đặt và gửi yêu cầu; dùng cửa sổ ẩn danh để thử khách vãng lai.

## Kịch bản trình bày khoảng 10 phút

| Bước | Tài khoản / màn hình | Thao tác và kết quả cần thấy |
|---|---|---|
| 1 | Trang chủ | 4 cơ sở, mỗi thẻ một ảnh; chưa có ảnh chụp thì ghi rõ ảnh minh họa |
| 2 | ADMIN `/admin` | Duyệt chủ sân vào cơ sở có sẵn |
| 3 | OWNER `/owner` | Sửa tên, liên hệ, giá/giờ sân; mở lịch điều hành |
| 4 | CUSTOMER / vãng lai | Chọn nhiều ô 30 phút, giữ tối đa 10 phút và trước ô đầu; thử cửa sổ khác để thấy ô bị giữ |
| 5 | Checkout | Bấm thanh toán mô phỏng, xem phiếu có nhãn MÔ PHỎNG, thử In / Lưu PDF |
| 6 | CUSTOMER `/my-bookings` | Với một đơn ngày mai, gửi yêu cầu hủy hoặc đổi; lịch cũ giữ tới lúc chủ sân xử lý |
| 7 | OWNER `/owner` | Duyệt yêu cầu, nhập khoản hoàn thỏa thuận; ghi nhận hoàn thủ công; đổi bị trùng phải giữ nguyên lịch cũ |
| 8 | OWNER `/owner/reports` | Chọn ngày ghi nhận giao dịch, xem thu/hoàn/chờ hoàn mô phỏng; số liệu chỉ của cơ sở mình |
| 9 | OWNER `/owner` | Với một đơn khác đặt **hôm nay**, đã thanh toán và chưa hết giờ, tra mã đơn rồi check-in |
| 10 | CUSTOMER | Đơn đã check-in không còn cho hủy/đổi; thử quyền của chủ sân khác để chứng minh không truy cập chéo |

Không dùng cùng một đơn cho cả hủy và check-in. Để trình bày check-in vào buổi sáng, đặt ô còn ở tương lai trong chính ngày đó.

## Quy tắc check-in đã chốt với nhóm trưởng

- Chủ sân đã duyệt và đúng cơ sở xác nhận khách thực sự đã đến; kiểm tra mã đơn/tên khách trước khi bấm.
- Đơn `CONFIRMED`, đã ghi nhận `DEMO_PAID` hoặc `PAID`, đúng ngày chơi ở Việt Nam và chưa tới thời điểm kết thúc ô cuối cùng.
- Phải xử lý yêu cầu hủy/đổi đang chờ trước khi check-in.
- Một lần check-in cho toàn bộ đơn, kể cả các ô rời nhau. Ghi người thực hiện và thời điểm máy chủ. Bấm lại không đổi lần ghi nhận đầu.
- Không tạo giao dịch tiền hoặc giải phóng ô. Sau check-in, chặn hủy/đổi cả trên giao diện lẫn backend.
- Chưa có chức năng hoàn tác check-in, theo dõi vắng mặt hoặc check-in riêng từng ô.

## Cách đọc báo cáo

Báo cáo tại `/owner/reports` là **báo cáo mô phỏng**, lọc tối đa 366 ngày theo múi giờ Việt Nam:

- Thu: tổng `INITIAL_DEMO` và `EXTRA_DEMO` theo ngày ghi nhận giao dịch. Đơn sau đó hủy vẫn giữ lịch sử thu.
- Hoàn: khoản yêu cầu đã được duyệt, `TRANSFERRED`, thuộc đơn có `INITIAL_DEMO`, theo ngày **ghi nhận hoàn**.
- Chờ hoàn: yêu cầu duyệt trong khoảng ngày chọn và hiện còn `PENDING`; chưa trừ vào tổng đã hoàn.
- Thu trừ hoàn = thu trong kỳ − hoàn trong kỳ; có thể âm khi tiền thu thuộc kỳ trước. Không phải lợi nhuận hoặc sao kê ngân hàng.
- Không cộng `INITIAL_INTENT`, giao dịch `PROVIDER_RECEIPT`, khoản QR cần đối soát, đơn chưa thanh toán hoặc các cơ sở khác. Đối soát QR thử nghiệm vẫn ở màn hình riêng.

Danh sách đơn/yêu cầu và lịch sử khách có 20 mục mỗi trang. Các tổng số yêu cầu chờ/hoàn trên dashboard tính toàn cơ sở, không chỉ trang đang xem. Tra cứu mã đơn chính xác để mở nhanh đơn cũ.

## Ảnh cơ sở / sân

Có ảnh minh họa đi kèm repo nên không cần Cloudinary để xem trang chủ. Để trình bày **tải ảnh thật từ máy**, cần hoàn tất [hướng dẫn Cloudinary](HINH_ANH_CO_SO_VA_SAN.md), điền secret trong `.env` riêng và khởi động lại.

Chủ sân chỉ quản lý ảnh cơ sở/sân của mình; tối đa 5 ảnh, JPG/PNG/WebP ≤5 MB mỗi ảnh. File được kiểm tra, nén về WebP, bỏ metadata; có chọn ảnh đại diện và xóa ảnh. Chưa cấu hình kho ảnh thì phần tải ảnh thông báo chưa sẵn sàng.

## File chính để giải thích MVC

| Phần | File chính |
|---|---|
| Khởi động / cấu hình | `server.js`, `app.js`, `config/payment-mode.js` |
| Model | `models/Booking.js`, `SlotLock.js`, `Payment.js`, `BookingRequest.js`, `Facility.js`, `Court.js`, `User.js` |
| Controller | `controllers/booking.controller.js`, `owner.controller.js`, `owner-report.controller.js` |
| Nghiệp vụ | `services/booking.service.js`, `owner-report.service.js`, `owner-images.service.js` |
| Luật thời gian / giá | `domain/booking-rules.js` |
| Route / phân quyền | `routes/owner.routes.js`, `middlewares/auth.middleware.js`, `csrf.middleware.js` |
| Giao diện | `views/`, `public/css/`, `public/js/` |
| Dữ liệu mẫu / ảnh | `services/demo-seed.service.js`, `services/image-storage.js` |

## Những giới hạn cần nói đúng với thầy

Đây là bản demo tương tác có frontend, backend và database. Không phải hệ thống thanh toán thật hoặc báo cáo doanh thu thực. Chưa nghiệm thu ngân hàng/QR live, OTP hoặc xác minh pháp lý chủ sân, dịch vụ email/SMS, hosting online, hay Cloudinary thật nếu nhóm chưa cấu hình. Hủy/đổi theo yêu cầu và thỏa thuận thủ công, không tự áp mức phí/hoàn cố định. Khách vãng lai giữ link riêng và liên hệ cơ sở; không tự hủy/đổi bằng mã đơn hoặc số điện thoại.

Kiểm thử tự động chạy bằng `npm run check` và `npm test` trên MongoDB replica set **cục bộ dùng một lần**, không chạy test/seed trên Atlas của nhóm. Bằng chứng kiểm thử của lần bàn giao ghi riêng trong `KIEM_THU_FINAL.md`.
