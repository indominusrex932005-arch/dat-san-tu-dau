# Kiểm thử thanh toán QR tự động

Ngày kiểm thử 06/11/2026. Trạng thái **MOCK cục bộ, còn lỗi tích hợp #86 → #88**. Kết quả SANDBOX của nhà cung cấp và LIVE đều **chưa chạy**. Báo cáo dùng `Refs #89`. [Issue #89](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/89)

## Bản thử và môi trường

| Phần | Commit đã đối chiếu | Vai trò |
| --- | --- | --- |
| `main` | `180a3c586f86276778f9f5492e998f64688016a0` | HEAD GitHub khi bắt đầu, cũng là nền của nhánh báo cáo |
| #85 | `a98294a1456946320cbc3556ed4e7dbe22c6f10f` | Tạo intent và snapshot. [PR #98](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/98) |
| #86 | `1ef7a149ff0540340ddba079b1d0058925bd6811` | Webhook và xác nhận HOLD. [PR #99](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/99) |
| #87 | `50a63de7359bfa96198c7140e487a3a1b8ea5986` | Checkout QR và polling trạng thái. [PR #100](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/100) |
| #88 | `e84bd48284b9c66612edd870cfc54cf5db79dd99` | Đối soát OWNER/ADMIN và lịch sử hoàn. [PR #101](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/101) |
| QA cục bộ | `ce7d6109ca9f94d64ff03d77f0ef0442452c4a4d` | Nhánh `qa/mock-payment-89`, tree `b53777eb92c9928b3b05ac90b285f39c3266d7cf` |

Bản QA ghép #87 và #88 vào #86, vốn đã chứa #85. Khi ghép, chữ ký `createApp` trong `app.js` xung đột giữa #86 và #87. Bản QA giữ cả hai tùy chọn `paymentWebhookHandler` và `paymentCheckoutEnabled`, đồng thời giữ mặc định của từng tùy chọn. Bốn PR còn mở khi đối chiếu GitHub. SHA bản QA chưa phải SHA tích hợp được nhóm duyệt.

Node 24.15.0, MongoDB replica set riêng trên loopback và adapter `mock_qa89`. Bootstrap thử truyền payment service, webhook handler và bật checkout thử. Provider URL dùng tên miền `.invalid` dành cho fixture. Chữ ký HMAC và QR là dữ liệu tổng hợp, cùng sử dụng `DEMO_MODE=true` và `mode: 'demo'`. Môi trường `sandbox` trong dữ liệu là giá trị của adapter mock. Runtime thử không gọi hệ thống ngân hàng hoặc provider. Origin HTTP cục bộ và phiên bản Chrome được ghi trong [kết quả từng ca](kiem-thu-thanh-toan/qa-89/local-results.json).

#82 chưa bàn giao URL HTTPS, test merchant hay release SHA. Kiểm tra Render và mode triển khai #81 cần thực hiện trên bản đã tích hợp. [Hướng dẫn triển khai #82](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/94) · [Hợp đồng mode #81](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/95)

## Kết quả MOCK

`npm run check` đạt ESLint và 21 template EJS. `npm test` đạt **236/236**, với 0 fail hoặc skip. Suite sử dụng DB tạm riêng, kiểm tra trực tiếp Booking, SlotLock và bản ghi tiền. Các ca trình duyệt bên dưới đi qua cả UI và webhook trên cùng bản QA.

| Ca và đầu vào | Mong đợi | Thực tế trên bản QA |
| --- | --- | --- |
| Khách vãng lai 390×844 và CUSTOMER 1366×900, chọn 16:30 và 18:00 | Tổng snapshot 125.000 đồng, đúng người nhận fixture, QR đọc được, không tràn ngang | **Đạt MOCK**. Chrome hiển thị đúng tổng/người nhận, OpenCV đọc đúng QR fixture ở cả hai viewport |
| Gửi cùng giao dịch thử với chữ ký sai rồi đúng, cuối cùng gửi lặp | Sai chữ ký bị chặn. Đúng chữ ký cập nhật Booking, intent và các lock, mở phiếu. Gửi lặp giữ đúng một biên nhận | **Đạt MOCK**. `401` rồi `200 APPLIED` và `200 DUPLICATE`. Mỗi đơn có 1 `Payment(PROVIDER_RECEIPT/APPLIED)`, 1 intent `SETTLED`, 2 lock xác nhận và 0 `INITIAL_DEMO`. Booking `CONFIRMED/DEMO_PAID`, phiếu ghi thanh toán mô phỏng |
| Thiếu/thừa VND, sai merchant, sai currency, sai recipient/tham chiếu | Lưu biên nhận cần rà soát, giữ Booking/lock và tránh ghi trùng | **Đạt tại lớp #86 (MOCK)**. Suite webhook xác nhận lý do, phạm vi và replay. Ca ghép qua HTTP xác nhận thiếu/thừa, sai merchant/currency đều trả `200 REVIEW`, gửi lại trả `200 DUPLICATE` |
| Các khoản `REVIEW` đi đến dashboard OWNER/ADMIN và trạng thái khách | OWNER thấy khoản đúng cơ sở. ADMIN thấy khoản chưa khớp. Khách thấy hướng dẫn đối soát trên đơn liên quan | **Lỗi tích hợp**. Webhook lưu 4 `Payment(PROVIDER_RECEIPT/REVIEW)`, nhưng `PaymentReceipt` có 0 dòng. Hai dashboard đều rỗng và checkout thiếu thông báo. Booking và các lock giữ nguyên |
| Quyền xem phiếu, intent, status và đối soát | Khách khác và OWNER khác cơ sở bị chặn. Session hoặc capability hợp lệ giữ đúng phạm vi | **Đạt MOCK**. GET của khách thiếu quyền và OWNER khác cơ sở trả 403. Suite #88 kiểm thêm phạm vi danh sách/chi tiết, POST có CSRF, ghi hoàn thủ công và replay. Suite #88 tạo fixture sổ đối soát trực tiếp |
| Timeout xác minh, lỗi DB, mất phản hồi, retry | Không xác nhận từ phản hồi muộn hoặc ghi dở. Retry sau lỗi ghi hoặc mất phản hồi giữ đúng số biên nhận | **Đạt tại lớp #86 (MOCK)**. Suite webhook kiểm timeout, rollback, retry và mất phản hồi sau commit. Suite #85 kiểm tạo intent timeout và lookup lại đúng mã cũ |
| Hai khách tranh ô, callback đến đúng hạn hoặc muộn, tranh với expiry | Chỉ cấp sân khi HOLD còn hạn và đủ lock. Giữ nguyên đơn/lock của khách thắng | **Đạt tại lớp #86 (MOCK)**. Suite webhook kiểm đúng lúc bắt đầu ô đầu, chạm hạn giữa transaction, mất lock và callback muộn chạy cùng khách mới |
| `off`/`live`, callback mô phỏng và phiếu | Adapter mock chỉ ghi thử, mode sai bị chặn | **Đạt MOCK**. Suite chặn webhook/intent sai mode. Hai ca browser ghi `DEMO_PAID`, không có Booking `PAID`. Cấu hình triển khai #81 chưa ghép vào bản này |
| Dừng và khởi động lại Node với cùng MongoDB | Phiếu, phiên đăng nhập, link khách vãng lai và biên nhận giữ nguyên. Callback replay vẫn đúng một biên nhận | **Đạt MOCK cục bộ**. Chrome tải lại hai phiếu thành công, callback của hai đơn trả `200 DUPLICATE`. Đây là restart tiến trình Node, cold start Render còn chờ |

Bằng chứng đã lọc gồm [kết quả từng ca và hash ảnh](kiem-thu-thanh-toan/qa-89/local-results.json), ảnh [QR 390px](kiem-thu-thanh-toan/qa-89/qr-mock-390.png), [QR 1366px](kiem-thu-thanh-toan/qa-89/qr-mock-1366.png), [phiếu 390px](kiem-thu-thanh-toan/qa-89/receipt-mock-390.png) và [phiếu 1366px](kiem-thu-thanh-toan/qa-89/receipt-mock-1366.png). Dữ liệu hiển thị là fixture. Mã đơn, mã thanh toán và số liên hệ được che trong ảnh. JSON chỉ giữ mã trạng thái, tổng tiền, số bản ghi, metadata phiên bản và kết quả. DB tạm đã được dọn.

### Điểm cần xử lý trước khi thử provider

#86 lưu `REVIEW` trong `Payment` qua `recordProviderReceipt`. #88 dùng `recordReceiptForReview` để tạo `PaymentReceipt` rồi đọc collection đó ở dashboard và phiếu. Chưa có điểm bàn giao giữa hai luồng trong bản thử. Có thể lặp lỗi bằng cách tạo HOLD 50.000 đồng, tạo intent và gửi callback mock hợp lệ 49.999 đồng, rồi so `reviewReason=AMOUNT_MISMATCH` trong `Payment` với danh sách trống ở `/owner/payment-reconciliation` và `/admin/payment-reconciliation`. Replay trả `DUPLICATE`, danh sách vẫn trống.

Khi sửa, chốt nguồn dữ liệu đối soát cùng #86/#88, gồm ngoại tệ, thiếu binding và khoản chưa gán đơn. Chạy lại ca trên với các kiểm tra quyền OWNER/ADMIN, CSRF, lịch sử, retry và số lượng bản ghi. Bootstrap `server.js` hiện chưa gắn adapter provider đã duyệt. Cần ghép #81 và xác nhận cách bật demo/adapter trên bản triển khai trước khi thử HTTPS.

## SANDBOX và LIVE còn chờ

| Môi trường | Điều kiện và ca cần chạy | Bằng chứng cần lưu |
| --- | --- | --- |
| **SANDBOX · Chưa chạy** | Chốt provider và merchant thử ở #84, sửa điểm tích hợp, thống nhất SHA #85–#88, có URL HTTPS #82 và DB thử riêng. Chạy lại luồng QR → provider → callback/query → phiếu, các ca lỗi, replay, hết hạn, phân quyền, restart và cold start | Release SHA, HTTPS origin, provider và alias merchant thử, mốc giờ, tham chiếu đã che, trạng thái provider, HTTP/ACK, số lượng và trạng thái Booking/Payment/SlotLock trước/sau |
| **Phương án thay thế · Chưa thống nhất** | Nếu provider được chọn thiếu Sandbox, nhóm trưởng thống nhất môi trường và phạm vi kiểm tra thay thế | Ghi phê duyệt, phạm vi, nguồn xác nhận và nhãn môi trường tương ứng |
| **LIVE · Chưa chạy** | Sau khi Sandbox đạt và nhóm trưởng chốt người nhận, số tiền nhỏ và người được phép thực hiện. Chủ tài khoản hoặc người được ủy quyền thực hiện giao dịch | Bằng chứng provider/ngân hàng và DB cùng mã đã che, số tiền đã duyệt, người xác nhận, trạng thái phiếu và số biên nhận, kèm release SHA |

Chỉ ghi nhận hoàn thành QR thật sau khi có bằng chứng đối chiếu giao dịch LIVE được ủy quyền. Báo cáo giữ trạng thái MOCK cho kết quả hiện tại.
