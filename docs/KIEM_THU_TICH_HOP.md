# Kiểm chứng bản tích hợp — 23/10/2026

**Phạm vi lịch sử:** kết quả và số lượng test dưới đây thuộc bản ngày 23/10/2026, chưa chứng minh quy tắc thời hạn mới của issue #37 ngày 24/10/2026. Quy tắc hiện hành là giữ **tối đa 10 phút, trước khi ô đầu tiên bắt đầu**, theo UTC máy chủ; cụm “hạn 10 phút” trong bảng cũ chỉ mô tả lần thử lịch sử. Xem [hợp đồng cập nhật](HOP_DONG_TICH_HOP.md). Kết quả hồi quy #37 phải ghi riêng theo SHA và lần chạy thực tế, không lấy lint hoặc bảng cũ làm bằng chứng mới.

## Đã chạy

- `npm ci`: đạt.
- `npm run check`: ESLint và biên dịch **16 template EJS**, đạt.
- `npm test`: **29 test đều đạt**, gồm quy tắc, HTTP với MongoDB replica set thật và migration dữ liệu v1.
- Chromium: luồng thật với dữ liệu thử ở **1366px và 390px**, không tràn ngang hoặc lỗi JavaScript.
- Xuất PDF phiếu bằng chế độ in, đọc lại nội dung PDF để xác nhận có tổng tiền đúng và nhãn **THANH TOÁN MÔ PHỎNG**.

MongoDB thử chạy cục bộ, database riêng có tên tạm. Không dùng URI/Atlas hoặc dữ liệu thật của nhóm, không có giao dịch ngân hàng.

## Những trường hợp đã kiểm tra

| Phần | Kết quả |
|---|---|
| Đăng ký/login | CUSTOMER và OWNER riêng; owner chờ duyệt; không tự gửi role ADMIN hoặc APPROVED |
| Duyệt chủ sân | Cấp cơ sở trong transaction; hai lần duyệt đồng thời không cấp một cơ sở cho hai chủ |
| Phân quyền | Khách chỉ xem đơn mình; chủ sân chỉ sửa sân/đơn đúng cơ sở; guest cần token riêng |
| Chọn ô | 30 phút, rời nhau, giá thường/cao điểm theo khoảng cấu hình, không nhận giá hoặc user giả từ body |
| Tranh ô | Hai request cùng ô chỉ một thành công; thất bại không giữ được một phần đơn |
| Giữ chỗ | Hạn 10 phút, bỏ qua lock hết hạn và mở lại ô; thanh toán quá hạn bị chặn |
| Thanh toán demo | Chỉ mở trong DEMO_MODE; production bị chặn; bấm lặp không ghi hai khoản ban đầu |
| Phiếu | Có nhãn mô phỏng, tổng tiền đúng, in/lưu PDF; guest có số điện thoại cơ sở |
| Hủy/đổi | Khách gửi yêu cầu; owner duyệt/từ chối đúng cơ sở; đổi thất bại giữ lịch cũ; giá cao hơn cần xác nhận xử lý chênh lệch |
| Hoàn | Ghi nhận thủ công; không chuyển tiền; kiểm tra số tiền và quyền |
| Khách vãng lai | Có thể đặt, xem phiếu bằng link; không tự gửi yêu cầu hủy/đổi; owner xử lý cuộc gọi |
| Migration | Dry-run không ghi; apply giữ ID/tổng tiền/lịch cũ; đơn cũ UNPAID; chạy lại không trùng; index cũ không chặn đơn mới |

Test hết hạn dùng timestamp trong DB thử để đi qua nhánh sau hạn, không chờ 10 phút thật và không sửa thời gian máy. Test concurrency dùng transaction/index trên MongoDB replica set, không giả lập thao tác ghi.

## Phạm vi chưa được chứng minh

Chưa tích hợp/xác minh ngân hàng, chưa kiểm thử thanh toán thật, chưa chạy migration trên Atlas nhóm, chưa kiểm thử tải lớn hoặc triển khai production. QR là hình minh họa, nút demo không chứng minh nhận tiền.

Ảnh trình duyệt và PDF mẫu trong gói bàn giao là dữ liệu kiểm thử; không tự đưa chúng vào dữ liệu chạy của ứng dụng.
