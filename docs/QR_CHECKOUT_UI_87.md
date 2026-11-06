# UI checkout theo payment intent — Draft #87

Nhánh `feat/qr-checkout-ui-87` được phát triển trên hợp đồng của #85 tại `a98294a1456946320cbc3556ed4e7dbe22c6f10f`, đã chứa main `180a3c586f86276778f9f5492e998f64688016a0`. Nhánh đã cập nhật nền #95/#98 và lõi webhook thử #99. Phần tích hợp provider thực còn chờ. Bản này chuẩn bị UI theo DTO hiện có và kiểm thử cục bộ với adapter mock. Các tiêu chí nghiệm thu Sandbox của #87 còn chờ. [PR #98 của #85](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/98) · [Issue #87](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/87)

## Hành vi giao diện

Checkout hiển thị người nhận, tổng giá snapshot, mã đối soát và ảnh QR được tạo cục bộ từ `qrPayload` đã được server kiểm tra. Nếu chỉ có `checkoutUrl`, khách có thể mở trang thanh toán bằng liên kết HTTPS được server cho phép. Liên kết ngoài dùng `noreferrer` và không thêm guest token. Phần UI thử có nhãn Sandbox. Luồng mô phỏng nội bộ vẫn có nút riêng và phiếu ghi `DEMO_PAID`.

Nút **Tạo yêu cầu thanh toán thử** gửi đúng một POST có CSRF theo thao tác của khách. Sau khi gửi, focus chuyển tới **Kiểm tra thanh toán**. Mở trang, tải lại, Back và polling chỉ gửi GET. Khi intent ở CREATING/UNKNOWN, nút **Tra cứu yêu cầu cũ** gửi POST có CSRF để backend lookup cùng intent/mã đã lưu; không tạo yêu cầu thu tiền thứ hai. Với trạng thái khác, nút kiểm tra chỉ gửi GET. Client đọc JSON trả về từ server, dùng `textContent` cho nội dung động, ẩn QR/link khi trạng thái không rõ, provider lỗi, mất quyền hoặc tới hạn. Nếu đã chuyển tiền nhưng hết hạn/chưa có kết quả, UI hướng dẫn liên hệ cơ sở.

Polling mặc định 5 giây, lùi tối đa 30 giây khi đọc lỗi, dừng khi trang bị ẩn hoặc đơn kết thúc. Mỗi lần chỉ có một request, có timeout 8 giây. Đồng hồ dùng `serverNow`, `holdUntil` và thời gian đơn điệu trong browser. UI chỉ chuyển tới đường dẫn phiếu cùng origin và đúng booking khi GET trả Booking `CONFIRMED` kèm `PAID` hoặc `DEMO_PAID`.

## Bật bản dự thảo trong bootstrap thử

`createApp(store, { paymentService, paymentCheckoutEnabled: true })` mở UI thử và GET trạng thái mới. Cần inject service và recipient đã xác minh trong môi trường demo. Mặc định `paymentCheckoutEnabled=false`, checkout đang chạy tiếp tục dùng giao diện mô phỏng hiện có. Bootstrap từ chối bật UI dự thảo khi demo chưa được cho phép. Nền đã hợp nhất resolver PAYMENT_MODE của #81/#95 và webhook thử #86. Bootstrap vẫn tắt mặc định; provider/merchant Sandbox thực còn chờ bàn giao.

| Route | Vai trò |
| --- | --- |
| POST `/bookings/:id/payment-intents` của #85 | Tạo/lấy lại intent bằng thao tác rõ ràng, có CSRF và quyền hiện có. |
| GET `/bookings/:id/payment-status` khi bật UI thử | Đọc Booking/intent theo cùng quyền session hoặc capability guest. Trả `booking`, `intent`, `qrImage`, `serverNow`, hạn `holdUntil` và đường dẫn phiếu khi đủ điều kiện. |

Route GET mới tái dùng `getBookingForViewer`, có thể dọn HOLD đã hết hạn theo nghiệp vụ hiện có. GET không tạo intent hoặc gọi adapter provider. Server kiểm tra lại Booking sau khi tạo ảnh QR để xử lý expiry/confirmation đồng thời. DTO intent và trạng thái đối soát/settlement cuối cùng cần được #86/#88 bàn giao tiếp.

## Kiểm thử cục bộ

Bằng chứng ngày 05/11/2026 dùng Chrome headless qua Playwright và MongoDB replica set riêng. Tên cơ sở/người nhận và payload QR có chữ **MOCK**. OpenCV đọc ảnh QR trả đúng payload thử. Đây là kiểm tra khả năng đọc ảnh và nối DTO. Bằng chứng xác nhận tiền từ provider Sandbox còn **CHƯA CHẠY**.

| Trạng thái | 390×844 | 1366×900 |
| --- | --- | --- |
| Pending với QR mock, người nhận và tổng giá | [Ảnh](kiem-thu-thanh-toan/ui-draft-87/pending-mock-390.png) | [Ảnh](kiem-thu-thanh-toan/ui-draft-87/pending-mock-1366.png) |
| Lỗi mạng khi đọc trạng thái | [Ảnh](kiem-thu-thanh-toan/ui-draft-87/network-error-mock-390.png) | [Ảnh](kiem-thu-thanh-toan/ui-draft-87/network-error-mock-1366.png) |
| Provider mock báo lỗi | [Ảnh](kiem-thu-thanh-toan/ui-draft-87/failed-mock-390.png) | [Ảnh](kiem-thu-thanh-toan/ui-draft-87/failed-mock-1366.png) |
| Đơn hết hạn, QR và link bị ẩn | [Ảnh](kiem-thu-thanh-toan/ui-draft-87/expired-mock-390.png) | [Ảnh](kiem-thu-thanh-toan/ui-draft-87/expired-mock-1366.png) |

Các ca browser kiểm tra Tab/Enter, hai ô rời nhau tổng 125.000đ, một intent sau refresh/Back, query tự khai đã trả không đổi trạng thái, đọc lại sau lỗi mạng, sai quyền và chuyển phiếu sau khi server mô phỏng xác nhận. Ca hết hạn dùng fixture HOLD đã lưu với 12 giây còn lại để thử UI. Bằng chứng chờ mốc thực theo luật giữ sân thuộc #78.

Kết quả cục bộ đạt 12/12 ca browser ở hai viewport, QR mock đọc lại khớp payload, `npm run check` đạt ESLint và 19 EJS, `npm test` đạt 216/216 với 0 lỗi hoặc bỏ qua trên DB thử. Các ca còn chờ gồm Sandbox provider, webhook #86, UI đối soát #88 và mode triển khai hợp nhất với #81.

[JSON từng ca, hash source và ảnh](kiem-thu-thanh-toan/ui-draft-87/browser-results.json). Số điện thoại khách thử được che trong ảnh. Query chứa capability, cookie, CSRF và payload xác thực không được ghi vào bằng chứng.

## Cập nhật tích hợp ngày 06/11/2026

Đã tích hợp nền mode #95/#98 và webhook mock #99; `npm run check` đạt 19 EJS, `npm test` đạt **253/253**, không lỗi/bỏ qua trên MongoDB replica set cục bộ. Test mới xác minh UNKNOWN được tra cứu bằng POST có CSRF trên cùng intent/mã, GET không gọi provider. Chrome cục bộ tại 1366px và 390px xác minh create timeout → UNKNOWN → bấm Tra cứu yêu cầu cũ → PENDING/QR; provider create một lần, lookup một lần; reload không gửi POST mới. Bootstrap vẫn tắt mặc định; đây chưa phải provider Sandbox hoặc Render.
