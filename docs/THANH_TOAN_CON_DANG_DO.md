# QR và thanh toán — phần còn dở

## Phần đang chạy để trình bày

Theo lựa chọn của nhóm trưởng, ngân hàng/QR thật sẽ được thầy hướng dẫn sau. Bản này có hình QR minh họa và nút mô phỏng để nhìn thấy luồng từ giữ sân đến phiếu.

![QR minh họa — không thể thanh toán](../public/images/qr-minh-hoa.svg)

Hình này không chứa tài khoản ngân hàng hoặc payload VietQR. `PAYMENT_MODE=demo` cho phép mô phỏng khi cấu hình hợp lệ. Production demo yêu cầu thêm `DEMO_DATA_ONLY=true` và `DB_NAME` tường minh, với DB/tài khoản/dữ liệu tổng hợp cô lập. Cờ này là cam kết người vận hành, không tự kiểm tra DB; không dùng tên/SĐT/dữ liệu khách thật hoặc Atlas chung. Xóa hoàn toàn biến cũ `DEMO_MODE`, kể cả false. Xem [hợp đồng chế độ thanh toán](CHE_DO_THANH_TOAN.md).

Mode mặc định `off` chặn thanh toán mô phỏng mới, gồm khoản thu thêm `EXTRA_DEMO`; các đơn/phiếu đã có `DEMO_PAID` vẫn giữ nhãn mô phỏng. `live` hiện từ chối khởi động; chưa có xác minh ngân hàng thật hoặc URL hosting được nghiệm thu trong phần chuẩn bị #81.

```mermaid
flowchart LR
    A[Chọn ô trống] --> B[HOLD - tối đa 10 phút, trước ô đầu tiên]
    B --> C[Thông tin đơn và QR minh họa]
    C --> D[Thanh toán mô phỏng]
    D --> E[CONFIRMED và DEMO_PAID]
    E --> F[Phiếu có nhãn mô phỏng - In hoặc lưu PDF]
    B --> G[Hết hạn chưa hoàn tất]
    G --> H[EXPIRED - giải phóng ô]
```

Nút mô phỏng vẫn kiểm tra mode phía server, CSRF, quyền xem đơn, hạn giữ và đủ ô thuộc đơn. Client không được đổi mode qua form/query. Bấm lại không tạo hai giao dịch ban đầu. Không hồi sinh đơn hết hạn để chiếm ô đã có người khác đặt.

Hạn giữ áp dụng từ issue #37 ngày 24/10/2026 là mốc sớm hơn giữa 10 phút từ lúc tạo đơn và giờ bắt đầu của ô đầu tiên, theo UTC của máy chủ. Từ đúng mốc này, HOLD không được xác nhận thanh toán; không được kéo dài tới hết 10 phút khi sân đã bắt đầu. Quy tắc dọn HOLD không giải phóng đơn CONFIRMED.

## Công việc cần nối sau

1. Chốt tài khoản nhận tiền và dịch vụ cung cấp thông tin giao dịch. Chưa có tích hợp MB Bank.
2. Tạo QR hợp lệ theo đúng đơn, số tiền và nội dung chuyển khoản.
3. Xác thực callback/webhook/nguồn đối soát theo nhà cung cấp, không tin nút khách bấm hoặc ảnh chuyển khoản.
4. Đối chiếu người nhận, số tiền, mã đơn và hạn giữ. Xử lý tiền thiếu/sai/muộn; không chiếm lại ô đã được người khác đặt.
5. Lưu mã giao dịch ngoài và chặn ghi nhận lặp; cập nhật tiền/đơn/lock trong transaction.
6. Chỉ phát phiếu thật sau khi xác minh trạng thái hợp lệ; giữ tách `DEMO_PAID` với `PAID`.
7. Kiểm thử webhook lặp, sai chữ ký/tiền, xác nhận đồng thời với hết hạn và khởi động lại server.

Phần live #84 phải mở rộng cùng `config/payment-mode.js` và hợp đồng `PAYMENT_MODE`, không tạo cờ thanh toán thứ hai. Không biến `DEMO_PAID` đã lưu thành `PAID`; chỉ mở live sau khi có nguồn xác minh và kiểm thử tương ứng.

## Hủy/đổi/hoàn

Khách có tài khoản gửi yêu cầu, chủ sân xét duyệt. Khách vãng lai gọi điện cơ sở. Bản này không tự áp phí đổi 30.000đ hay mức hoàn 100%/50% từ tài liệu gốc.

Chủ sân tự xử lý khoản chênh lệch/hoàn bên ngoài rồi ghi nhận; nút ghi nhận hoàn không chuyển tiền tự động. Đổi toàn đơn trong cùng cơ sở; chưa đổi từng ô hoặc chuyển sang chủ sân khác.

## Cách trình bày với thầy

“Em đã có khách/chủ sân, duyệt quyền theo cơ sở, đặt nhiều ô 30 phút, giữ sân tối đa 10 phút nhưng phải xác nhận trước khi ô đầu tiên bắt đầu và lưu phiếu PDF. Thanh toán đang mô phỏng có nhãn riêng; QR/ngân hàng thật chờ hướng dẫn. Hủy/đổi và ghi nhận hoàn do chủ sân xử lý thủ công.”
