# Hợp đồng PaymentIntent — #85

Ngày soạn: **05/11/2026**. Nhánh `feat/payment-intents-85`, đã cập nhật nền main `180a3c586f86276778f9f5492e998f64688016a0` có limiter #80 và sửa bộ lọc #93. Đây là hợp đồng bàn giao phần backend của PR Draft; chưa có kết quả nghiệm thu nhà cung cấp hoặc giao dịch thật. Kết quả kiểm tra thực tế được ghi riêng bên dưới và trong PR, không suy PASS nhà cung cấp từ test mock.

## Phạm vi và điều kiện hiện tại

Phần #85 tạo và đọc yêu cầu thanh toán **INITIAL**, độc lập nhà cung cấp. Yêu cầu này biểu diễn việc xin checkout/QR cho **100% tổng tiền đơn đã lưu**, không biểu diễn tiền đã nhận. Chưa tạo EXTRA cho đổi sân, chưa có webhook/IPN xác nhận tiền, đối soát live hoặc giao diện QR mới.

Nhà cung cấp và mô hình nhận tiền vẫn chờ quyết định trong [#84 / PR #97](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/97), đặc biệt D01/D02. Không tự chọn merchant, tài khoản tập trung hoặc tài khoản từng OWNER. Ngày **06/11/2026**, nhánh đã tích hợp nền `de09ec3` có hợp đồng `PAYMENT_MODE` của [#81 / PR #95](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/95). App truyền resolver trung tâm `config/payment-mode.js#getPaymentConfig` cho service mặc định; khi bootstrap cung cấp adapter/người nhận, dùng cùng resolver này cho service được inject. Không thêm cờ env thay thế hoặc suy quyền gọi nhà cung cấp từ `DEMO_MODE` cũ; phải xóa key cũ, kể cả `false`.

**App/server mặc định chưa có adapter được cấp phép, nên POST khởi tạo trả 503 khi chưa cấu hình.** GET vẫn được đọc intent cục bộ đúng quyền, hoặc trả 404 nếu chưa có intent; nó không cần bật adapter để đọc lịch sử. Bật demo nội bộ không tự tạo QR hay gọi SePay. Test dùng adapter mock được inject riêng; kết quả mock không chứng minh đã gọi SDK/API, có merchant thật, nhận tiền hoặc có URL triển khai online.

| Phần #85 | Ranh giới |
| --- | --- |
| Intent INITIAL, snapshot giá/hạn/mã tương quan; tạo một lần và đọc lại | Không xác nhận Booking, không ghi `PAID`/`DEMO_PAID`, không giải phóng hoặc gia hạn lock để cứu intent |
| Adapter `createIntent` và `lookupIntent` được inject từ server trong môi trường được phép | Client không chọn adapter/mode/người nhận/giá; server mặc định không gắn adapter giả |
| Lưu trạng thái chưa rõ, chống tạo trùng, kiểm tra index và thử DB cục bộ | Chưa có thanh toán live, tiền hoàn hoặc writer xác nhận cuối cùng |
| DTO cho #87 | Chưa có nút/QR mới trong EJS; không quảng cáo route UI hoặc checkout provider chưa được bàn giao |

## HTTP API và quyền truy cập

| Method / route | Dữ liệu client được dùng | Ý nghĩa |
| --- | --- | --- |
| `POST /bookings/:id/payment-intents` | `_csrf` theo session; `token` của guest nếu có | Tạo INITIAL intent hoặc lấy lại intent hiện có; có thể query phục hồi qua adapter theo quy tắc bên dưới |
| `GET /bookings/:id/payment-intent` | Định danh đơn và session, hoặc query `token` của guest theo cơ chế hiện có; không ghi token vào log/ảnh | Đọc trạng thái intent đã lưu tại server; không gọi provider hoặc khởi tạo yêu cầu thu mới |

Hai route dùng `getBookingForViewer`: CUSTOMER xem đơn của mình; guest cần capability đúng của đơn vãng lai; ADMIN và OWNER đã duyệt chỉ có quyền xem theo kiểm tra hiện có, OWNER chỉ đúng cơ sở. Mã đơn/SĐT không thay token. POST đi qua CSRF của app. Không nhận `amount`, `currency`, provider, owner/recipient, mode hoặc status từ body làm nguồn quyết định.

POST dùng `application/x-www-form-urlencoded` theo body parser hiện có, ví dụ client gửi `URLSearchParams`; không tự bật parser JSON hoặc bỏ CSRF cho route này.

GET không phải bằng chứng đã trả tiền và không polling trực tiếp dịch vụ bên ngoài. Helper quyền hiện có có thể cập nhật hạn HOLD cũ hoặc dọn HOLD đã hết hạn; vì vậy không gọi toàn bộ request GET là thao tác không thể ghi DB. Nó không tạo intent, không cấp sân hoặc ghi nhận tiền.

| HTTP | Trường hợp của phần core |
| --- | --- |
| `201` | POST tạo đầu thành công, có intent PENDING đã lưu |
| `200` | POST trả PENDING hiện có; GET trả intent cục bộ ở mọi trạng thái, kể cả FAILED/EXPIRED; không tạo hóa đơn mới |
| `202` | POST trả CREATING hoặc UNKNOWN, chưa được phép coi đã tạo xong/đã trả |
| `403` | Mode off khi core được cấu hình; quyền/capability hoặc CSRF không hợp lệ theo lớp kiểm tra tương ứng |
| `410` | POST hết hạn Booking/intent, hoặc thao tác tạo vừa hoàn tất khi đơn đã không còn hiệu lực |
| `502` | POST trả intent FAILED do provider/adapter báo thất bại xác định; response không lộ lỗi thô/secret |
| `503` | Chưa bật/chưa cấu hình adapter hoặc resolver hợp lệ; mode live chưa được hỗ trợ |

Response có kết quả intent dùng envelope **`{ intent: DTO }`**, kể cả POST trả FAILED/502 hoặc EXPIRED/410, không phải document Payment thô. Lỗi do controller xử lý có dạng `{ error: { code, message } }`; message 5xx là câu chung, code nằm trong allowlist công khai. CSRF bị middleware chặn trước controller trả trang lỗi EJS hiện có, nên UI cần kiểm tra Content-Type thay vì mặc định mọi lỗi đều JSON. GET lấy theo booking ID; chưa có intent trả `404` với code `PAYMENT_INTENT_NOT_FOUND`. Các lỗi ID, không có đơn, đơn không còn HOLD, giá/lock/hạn không hợp lệ vẫn giữ mã lỗi kiểm tra của server; UI không được dựa vào chuỗi lỗi nhà cung cấp.

## DTO công khai cho #87

DTO intent chỉ có các trường được phép dưới đây. Không trả document Payment nguyên bản hoặc dữ liệu adapter nguyên bản.

| Trường | Hợp đồng |
| --- | --- |
| `id`, `bookingId` | ID intent và đơn liên quan; không cấp quyền xem đơn |
| `status` | `CREATING`, `PENDING`, `UNKNOWN`, `FAILED`, `EXPIRED` hoặc `SETTLED` |
| `mode` | Hiện chỉ `demo`; không dùng để tuyên bố đã thanh toán |
| `provider` | Tên adapter phía server đã cấu hình; không mặc định là SePay thật |
| `amountVND`, `currency` | 100% tổng đã lưu, số nguyên VND; currency cố định `VND` |
| `expiresAt` | Hạn cố định đã lưu; UI chỉ hiển thị, server quyết định hiệu lực |
| `reconciliationCode` | Mã đối soát duy nhất do server tạo; không phải capability guest |
| `recipientName` | Tên hiển thị từ snapshot binding đã xác minh |
| `checkoutUrl`, `qrPayload` | Tùy chọn, chỉ trả khi status PENDING, đã được kiểm tra/lọc; không tự dựng QR giả khi thiếu dữ liệu |
| `failureCode` | Tùy chọn, mã lỗi công khai đã giới hạn; không lỗi thô, stack trace hoặc response bí mật |

DTO không chứa merchant ID, recipient/binding ID, `providerPaymentId`/`externalId`, credential, authorization header, guest token hoặc trường provider ngoài allowlist. ID ngoài chỉ lưu nội bộ cho #86. Khi không có checkout/QR hợp lệ, #87 hiển thị trạng thái phù hợp thay vì đưa một link đoán hoặc QR minh họa vào luồng thu tiền. `PENDING` chỉ có nghĩa yêu cầu đang chờ, không bằng CONFIRMED/đã trả.

## Dữ liệu, số tiền và hạn giữ

Intent được lưu trong collection Payment bằng `type=INITIAL_INTENT`, `method=PROVIDER`; các bản ghi `INITIAL_DEMO`/`EXTRA_DEMO` cũ được giữ nguyên. Đây là bản ghi yêu cầu thu, không phải xác nhận giao dịch ngân hàng. Một Booking có **tối đa một INITIAL_INTENT trong toàn bộ vòng đời**, không chỉ một intent đang hoạt động. FAILED/UNKNOWN/EXPIRED không mở đường tạo lại mã hoặc hóa đơn mới cho cùng đơn.

Trước khi lưu/tạo phải đọc dữ liệu server: Booking còn HOLD, tổng bằng tổng `slots[].priceVND`, là số nguyên an toàn dương, đủ mọi SlotLock đúng booking/court/slot và còn hạn. Không lấy bảng giá hiện tại để sửa giá snapshot. Hạn intent là mốc sớm nhất của `effectiveHoldExpiresAt(booking)` và expiry của **tất cả lock**, nên không vượt tạo HOLD +10 phút, giờ ô đầu hoặc hạn HOLD đã lưu sớm hơn. Không kéo dài hạn khi gửi lại, đổi tab, lookup hoặc restart.

Mã đối soát và snapshot provider/mode/giá/hạn được lưu trước khi gọi adapter. UNIQUE trong DB bảo vệ cả mã tương quan và một INITIAL_INTENT/Booking; kiểm tra bằng JavaScript hoặc trạng thái nút UI không thay unique index. Đơn vãng lai và tài khoản đi cùng cơ chế giữ toàn bộ ô; không có đường tắt bỏ quyền/lock vì đã nhận được checkout URL.

| Trạng thái | Cách hiểu và hành động |
| --- | --- |
| `CREATING` | Một request đã giành quyền tạo. Request đồng thời nhận lại trạng thái này, không gọi create lần hai |
| `PENDING` | Adapter trả kết quả tạo/lookup hợp lệ và đã được lưu; chưa xác nhận tiền |
| `UNKNOWN` | Có thể provider đã nhận lệnh nhưng app chưa có kết quả xác định; chỉ được lookup phục hồi |
| `FAILED` | Thất bại xác định được lưu bằng mã an toàn; không tự sinh intent/hóa đơn mới |
| `EXPIRED` | Hết hạn hiệu lực ứng dụng; không cho tiếp tục cấp sân từ intent này. Không có nghĩa ngân hàng/provider chắc chắn không thể nhận tiền |

Khi trả DTO, server đọc lại Booking, tổng tiền và toàn bộ lock. Hết hạn, mất lock hoặc Booking không còn HOLD/UNPAID hợp lệ (kể cả đã CONFIRMED/CANCELLED) thì DTO đóng thành EXPIRED và bỏ checkout/QR, dù timestamp intent chưa tới hoặc `intentStatus` trong DB chưa đổi. GET không tự ghi lại trạng thái intent; #86 phải kiểm tra điều kiện hiện tại, không chỉ nhìn status đã lưu.

Webhook thử có thể chuyển intent sang `SETTLED` cùng Booking `CONFIRMED/DEMO_PAID`; DTO giữ trạng thái này và bỏ QR/checkout. Xem [hợp đồng webhook](HOP_DONG_WEBHOOK_THANH_TOAN.md).

## Adapter và phục hồi khi chưa rõ kết quả

Adapter là dependency phía server, chưa phải SDK nhà cung cấp đã được chọn. Hàm `createIntent(request, { signal })` bắt buộc; `lookupIntent(request, { signal })` phục hồi là tùy chọn. Adapter phải khai báo `provider`, `environment='sandbox'` và `checkoutOrigins` không rỗng, chỉ gồm origin HTTPS không user/password. `resolveRecipient` và `getPaymentConfig` cũng do server inject; không lấy từ request. `createIntent` được phép gọi **tối đa một lần cho một intent, kể cả sau timeout/crash/restart**. Thao tác mạng nằm ngoài transaction MongoDB có thể retry. Giành quyền bằng DB trước gọi create; sau I/O, transaction đọc lại Booking/giá/hạn/đủ lock và cập nhật phiên bản Booking để tranh chấp với writer hết hạn/xác nhận trước khi lưu kết quả còn sử dụng được.

Adapter/SDK không được tự retry lệnh tạo bên ngoài khi chưa có bảo đảm idempotency của provider; một lần gọi adapter không chứng minh provider chỉ thu một lần.

Request nội bộ gửi adapter gồm `bookingId`, `reconciliationCode`, `amountVND`, `currency`, `expiresAt` ISO, `merchantId`, `recipient:{bindingId,recipientId,displayName}` và `mode:'demo'`; provider/environment thuộc namespace adapter phía server. Đây không phải body cho phép client tự khai. Timeout mặc định 5.000 ms, cooldown lookup 1.000 ms là lựa chọn constructor được inject, không phải biến env mới.

Nếu request tạo bị timeout, process chết hoặc lease hết trước khi lưu kết quả, các lần POST tiếp theo chỉ lấy cùng intent và có thể `lookupIntent` bằng mã đã lưu sau cooldown. Lease query ngăn hai request cùng lookup liên tục; adapter không có lookup thì giữ trạng thái chưa rõ, không chuyển sang create. Không tạo invoice mới để “thử lại”. `lookup NOT_FOUND` **không chứng minh create chưa xảy ra**; giữ UNKNOWN, chờ đối soát thay vì gọi create lần hai. GET status không kích hoạt lookup.

Adapter chỉ được trả trường đã thỏa hợp đồng; URL/payload sai hoặc thêm key bí mật không được đi nguyên trạng ra DTO. Kết quả PENDING phải khớp `amountVND`, `currency`, `reconciliationCode` của request, có ít nhất một `providerPaymentId`/`externalId` thực sự do adapter nhận được và có `checkoutUrl` hoặc `qrPayload` hợp lệ. Checkout URL phải thuộc origin đã allowlist; QR payload phải là chuỗi hợp lệ trong giới hạn. Với FAILED/UNKNOWN/NOT_FOUND, core chỉ dùng status để sinh mã cố định và không nhận các trường kết quả kèm theo. Không lấy mã hóa đơn local rồi giả làm ID nhà cung cấp. Mock có thể giả lập kết quả cho test nhưng không được gắn mặc định vào app/server hoặc công bố như tích hợp ngân hàng.

Nếu sau này chọn SePay Gateway, lưu ý `checkout/init` là endpoint **submit form checkout**, không phải API tạo đơn server-to-server để ánh xạ máy móc thành `create`. Việc tạo lại/submission form có thể tác động khác với mock; cần chốt cách chỉ phát hành một yêu cầu, query theo mã hóa đơn và thử duplicate submission trong Sandbox trước khi viết adapter thật. [Đặc tả form chính thức](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/form-thanh-toan). Cách chọn dịch vụ và người nhận vẫn chờ #84, không phải kết quả của #85.

## Chuẩn bị index và bảo toàn dữ liệu cũ

`services/payment-intent-indexes.js` kiểm tra bốn unique index riêng cho INITIAL_INTENT: booking, reconciliationCode, providerPaymentId và externalId; hai ID ngoài được scope theo provider/environment/merchant. Script `scripts/chuan-bi-payment-intents.js` chuẩn bị chúng riêng, không tự tạo qua khai báo index của model. Không dùng `syncIndexes` để tự xóa index cũ, không đổi bản ghi demo/legacy thành live. POST thiếu/sai cấu hình index bắt buộc trả 503 `PAYMENT_MIGRATION_REQUIRED`, thay vì chạy không có chống trùng; GET lịch sử không tự tạo hoặc sửa index.

Người vận hành phải xác minh URI/DB đích qua kênh bảo mật, backup nếu DB đã có dữ liệu, và review dry-run trước apply. Lệnh dưới đây là hướng dẫn trên **DB thử được cấp riêng**, chưa được chạy lên Atlas trong task này; không đưa secret vào dòng lệnh/history:

```powershell
node scripts/chuan-bi-payment-intents.js
node scripts/chuan-bi-payment-intents.js --apply
node scripts/chuan-bi-payment-intents.js
```

Lệnh đầu mặc định dry-run. Báo cáo có tổng số đã quét, intent sai/trùng, index cần tạo và lỗi; không in định danh/số tiền/credential. Nếu có intent sai/trùng hoặc index xung đột, dừng và đối chiếu riêng; script không tự sửa/xóa/drop để vượt lỗi. `--apply` chỉ bổ sung index đã được review, không tạo giao dịch/intent, đổi dữ liệu cũ hoặc seed. Dry-run sau apply kiểm tra lại kết quả. Không tự apply Atlas chung hoặc đưa migration vào build/start. `npm start` của ứng dụng vẫn có các thao tác DB hiện có; không dùng startup như một lệnh kiểm tra chỉ đọc.

## Kiểm chứng và bàn giao tiếp

Cập nhật tích hợp **06/11/2026** với nền `de09ec3` (#95): đã giải quyết xung đột `app.js` và helper DB, giữ route intent cùng `/health`, mode trung tâm, session/CSRF và limiter. `npm run check` đạt **19 EJS**; `npm test` đạt **227/227**, không fail/skipped, trên MongoDB replica set cục bộ cổng `127.0.0.1:27029`, mỗi suite dùng DB tạm riêng. Test bổ sung kiểm tra service inject dùng resolver mode chung: `off` không tạo intent/gọi provider, `demo` tạo intent PENDING, chuyển về `off` chặn POST tiếp mà không tạo thêm; Booking vẫn HOLD/UNPAID. Đây là kết quả mock/DB cục bộ, chưa nghiệm thu nhà cung cấp hoặc online. Số liệu ngày 05/11 bên dưới là lịch sử trước tích hợp.

Đã chạy ngày **05/11/2026** trên Node.js **24.15.0**, MongoDB **8.3.11** replica cục bộ riêng `qaPayment85`, cổng `127.0.0.1:27063`. Từng suite tạo DB thử riêng và tự dọn; không đọc `.env` riêng hoặc dùng Atlas. Sau khi cập nhật main `180a3c5`, `npm run check` đạt ESLint và **19 EJS**; `npm test` đạt **207/207**, không fail/skipped, gồm bộ test cũ và các test mới bên dưới. Suite intent đặt quota cao chỉ trong fixture và khôi phục sau test; bộ test limiter của main vẫn kiểm tra chính sách thực. SHA commit cuối cùng và CI được ghi trong PR để không nhầm với nguồn main nền.

| Nội dung cần chứng minh bằng test/mock + DB replica cục bộ | Trạng thái trong tài liệu này |
| --- | --- |
| Giá 100%, snapshot không bị body sửa; quyền CUSTOMER/guest/OWNER khác; CSRF | PASS trong [33 test core/HTTP](../tests/payment-intents.test.js), dùng adapter giả lập |
| Nhiều POST đồng thời và retry/restart chỉ một INITIAL_INTENT/mã/create | PASS trong test core; không phải cam kết idempotency dịch vụ chưa được chọn |
| CREATING/UNKNOWN, lookup có cooldown/lease, NOT_FOUND không create lại | PASS; kết quả create đến muộn không ghi đè kết quả phục hồi |
| Thiếu/mất lock khi chờ provider, hết hạn, intent cũ, adapter hỏng và output chứa dữ liệu không được phép | PASS; không xác nhận Booking/tiền, không trả QR hết hiệu lực |
| Index dry-run/apply lặp trên DB thử; document demo/legacy giữ nguyên | PASS trong [10 test migration](../tests/payment-intent-migration.test.js), gồm dữ liệu trùng, index sai và collation không hỗ trợ; chưa apply Atlas |
| `npm run check` và `npm test` | PASS local trên main mới: 19 EJS / 207 test; CI ghi riêng tại PR, không phải thử provider/online |
| Nhà cung cấp Sandbox/merchant/QR thật, webhook và tiền thật | **CHƯA TRIỂN KHAI / CHƯA CHẠY** |

- **#86:** xác thực webhook/query theo sản phẩm được chốt, inbox/idempotency/đối soát và transaction xác nhận cuối; intent PENDING không tự chuyển Booking hoặc Payment thành đã trả. Không hồi sinh đơn đã hết hạn hoặc chiếm ô của người khác.
- **#87:** dùng DTO/status đã bàn giao để làm checkout/QR an toàn, xử lý 201/200/202/4xx/5xx và polling local có giới hạn; giữ CSRF/quyền guest, không log token và không coi redirect/QR/PENDING là đã thanh toán.
- **#84/#81:** nền mode trung tâm đã tích hợp; còn chốt provider/cách nhận tiền và cấu hình adapter thử cùng resolver trước khi nghiệm thu. Không mở live hoặc tự thêm env để hoàn thành giao diện.

PR phải giữ Draft khi điều kiện nhà cung cấp/mode/nhận tiền cần thiết còn chưa được bàn giao. Tài liệu và mock/test đạt không thay chữ ký nghiệm thu, credential đúng môi trường hoặc bằng chứng Sandbox/online. Báo cáo ghi rõ phần đã chạy, phần chưa chạy và giới hạn; không tự đóng #85 chỉ vì có route/schema mới.
