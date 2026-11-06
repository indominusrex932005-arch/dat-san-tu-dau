# Xác minh webhook và ghi nhận thanh toán thử (#86)

Lõi #86 được kiểm tra bằng adapter mock trên nhánh kế thừa [payment intent #85](HOP_DONG_PAYMENT_INTENT.md). Đã cập nhật nền có hợp đồng `PAYMENT_MODE` của #81/#95 và #98; phải xóa key `DEMO_MODE` cũ. Nhóm còn chờ chốt nhà cung cấp và tài khoản nhận tiền ở [#84](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/84). Kết quả với sandbox của nhà cung cấp **Chưa chạy**.

## Điểm gắn adapter phía server

Server mặc định chưa gắn webhook. Khi có adapter thử được duyệt, bootstrap truyền `paymentWebhookHandler` vào `createApp`. Tạo handler bằng `createPaymentWebhookHandler({ adapter, getPaymentConfig })`. Handler nhận `mode: 'demo'` từ cấu hình server và yêu cầu adapter khai báo `provider`, `environment: 'sandbox'`. Giao thức xác minh, danh tính merchant, cách truy vấn trạng thái và phản hồi cần được đối chiếu với tài liệu chính thức sau khi chốt nhà cung cấp.

`POST /webhooks/payments` là route thử nghiệm. Route nhận raw JSON tối đa 32 KB, không giải nén, không đi qua session/CSRF. Giữ CSRF cho các POST khác, kể cả tạo intent. Adapter nhận `verifyWebhook({ rawBody, headers, receivedAt, signal })`. Nó xác minh chữ ký trên dữ liệu gốc, kiểm tra thời điểm và chống replay theo giao thức nhà cung cấp. Nếu cần tra trạng thái, adapter hoàn tất truy vấn trước khi trả kết quả. Timeout xác minh mặc định 5 giây, abort qua `signal`.

| Kết quả adapter | Ý nghĩa |
| --- | --- |
| `null` | Xác thực thất bại |
| `{ status: 'IGNORED' }` | Sự kiện đã xác minh nhưng không ghi nhận tiền thành công |
| `{ status: 'SUCCEEDED', ... }` | Giao dịch thành công đã được xác minh và chuẩn hóa |
| Ném lỗi | Chưa xác minh được, có thể thử lại |

Với `SUCCEEDED`, adapter trả `merchantId` từ ngữ cảnh merchant đã xác thực, `transactionId` của **giao dịch tiền**, `receivedAmountMinor` là số nguyên dương và `currency` là mã 3 chữ hoa. `recipientId`, `reconciliationCode`, `providerPaymentId` và `externalId` có thể vắng khi không xác định được. Hai ID cuối tham chiếu intent đã tạo. Một intent có thể nhận nhiều giao dịch tiền riêng. Với VND, `receivedAmountMinor` tính bằng đồng. Với ngoại tệ, giữ đơn vị do adapter chuẩn hóa để đối soát.

Adapter chỉ gửi `reconciliationCode` khi đã trích được mã chuẩn theo hợp đồng intent. Core lấy provider và môi trường từ adapter đã gắn. Đường dẫn quay về, thông tin từ trình duyệt và mã trong lời nhắn không đủ để xác nhận giao dịch.

## Quyết định và dữ liệu

- Core tìm intent bằng mã đối soát, khớp provider/môi trường/merchant/người nhận và ít nhất một ID intent đã lưu. Mọi ID intent gửi kèm phải khớp. Chỉ tự xác nhận intent `PENDING` với đủ 100% số tiền VND theo snapshot.
- Trong transaction, server kiểm tra Booking còn `HOLD/UNPAID`, giá/ô hợp lệ và tất cả lock còn thuộc đơn. Mốc cắt dùng hạn sớm nhất của HOLD, intent và các lock. Hạn HOLD vẫn chịu giới hạn 10 phút và giờ bắt đầu ô đầu. Server kiểm tra lại thời gian trước khi yêu cầu commit. Nếu đã chạm hạn ở bước kiểm tra, transaction hủy phần xác nhận rồi ghi biên nhận đối soát.
- Khi đủ điều kiện, cùng một transaction ghi `Payment(PROVIDER_RECEIPT)` trạng thái `APPLIED`, chuyển intent sang `SETTLED`, chuyển Booking sang `CONFIRMED/DEMO_PAID` và bỏ hạn trên lock hiện có. Kết quả này mang nhãn thử. Không tạo lock mới hoặc bản ghi `INITIAL_DEMO`.
- Tiền muộn, thiếu/thừa, sai đơn vị hoặc thiếu thông tin khớp được lưu dưới `REVIEW` cùng `reviewReason`. Booking, intent và lock giữ nguyên. Giao dịch thứ hai trên intent đã chốt cũng vào đối soát. Một giao dịch đến trước khi intent có tham chiếu đã xác nhận cần đối soát riêng.
- Biên nhận giữ mã giao dịch, merchant, provider/môi trường, số tiền/đơn vị và các tham chiếu đã chuẩn hóa. Biên nhận không lưu raw body, chữ ký hoặc secret. Bản ghi chưa xác minh được liên kết provider/merchant/người nhận/ID intent không gán `booking` hay `intent`. #88 cần kiểm tra quyền từ server và đưa biên nhận chưa ghép vào phạm vi quản trị.
- Unique index dùng `provider + environment + merchantId + providerTransactionId` trên `PROVIDER_RECEIPT`. Callback lặp trả `DUPLICATE`. Cùng khóa với thông tin khác trả xung đột và giữ biên nhận gốc.

| Phản hồi thử nghiệm | Ý nghĩa |
| --- | --- |
| 200 `APPLIED`, `REVIEW`, `DUPLICATE` | Biên nhận đã lưu hoặc giao dịch đã được ghi từ lượt trước |
| 200 `IGNORED` | Không phát sinh ghi tiền |
| 400 / 401 / 413 / 415 | Dữ liệu sai, xác thực thất bại, body quá lớn hoặc định dạng không hỗ trợ |
| 409 | ID giao dịch đã lưu với dữ liệu khác |
| 503 | Mode chưa phù hợp, lỗi xác minh, timeout hoặc DB chưa ghi được |

Bảng phản hồi dùng cho mock. Khi nối provider, xác nhận quy tắc ACK/retry, timestamp và định dạng webhook trước khi gắn route. Nếu mất phản hồi sau khi commit, callback lặp chỉ nhận kết quả đã ghi từ trước.

## Chuẩn bị index trên DB thử riêng

Xác nhận đúng DB, dừng writer và sao lưu nếu DB đã có dữ liệu. Script mặc định xem trước. Chỉ dùng `--apply` sau khi đã đọc kết quả và xác nhận đích.

```powershell
node scripts/chuan-bi-payment-intents.js
node scripts/chuan-bi-payment-intents.js --apply
node scripts/chuan-bi-payment-intents.js
```

Script kiểm tra cả index intent và receipt. Bản ghi sai, khóa trùng hoặc index xung đột chặn apply. Apply chỉ thêm index còn thiếu. Webhook trả 503 nếu thiếu index bắt buộc.

## Kiểm tra và bàn giao

Ngày **06/11/2026**, bản tích hợp với nền #95/#98 đạt `npm run check` (19 EJS) và **243/243 test**, không lỗi/bỏ qua trên MongoDB replica set cục bộ. CI kiểm tra cả PR/push tới `feat/tich-hop-thanh-toan` để nhánh tích hợp được kiểm tra trước khi vào main. Đây vẫn là test mock, chưa phải Sandbox của nhà cung cấp.

- Chạy `npm run check` và `npm test` với MongoDB replica set cục bộ, DB thử riêng. [Bộ test webhook](../tests/payment-webhook.test.js) kiểm tra raw body, chữ ký/timestamp mock, CSRF, sai dữ liệu, ghi trùng, timeout, rollback và hết hạn/tranh ô. [Bộ test migration](../tests/payment-intent-migration.test.js) kiểm tra dry-run, dữ liệu cũ và unique index. Kết quả chạy và commit ghi trong PR.
- #87 có thể đọc `intent.status = SETTLED`, `mode = demo` từ GET intent khi xác nhận sandbox đã hoàn tất. DTO bỏ QR/checkout và giữ trạng thái đã chốt sau mốc hết hạn intent. Booking vẫn có trạng thái riêng.
- #88 dùng biên nhận `REVIEW` làm đầu vào đối soát. Việc duyệt, ghi lịch sử, quyền OWNER/ADMIN và chính sách hoàn thuộc #88 và quyết định của nhóm.
- Còn chờ bằng chứng sandbox từ nhà cung cấp cho chữ ký chính thức, dữ liệu merchant, ACK/retry và xác nhận tiền trong môi trường thử. Giữ PR Draft trong lúc chờ bàn giao.
