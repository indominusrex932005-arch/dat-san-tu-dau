# Đối soát QR thử nghiệm

Luồng này dùng intent của #85 tại `a98294a`. `main` tại thời điểm tách nhánh là `180a3c5`. Màn hình dành cho OWNER đã được cấp cơ sở và ADMIN xuất hiện khi `DEMO_MODE=true`. Khoản QR thử nghiệm được lưu riêng với giá, thanh toán và trạng thái đặt sân. [Issue #88](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/88)

## Rà soát khoản nhận

1. Từ `/owner` hoặc `/admin`, mở **Đối soát QR thử nghiệm**. OWNER chỉ xem các khoản có intent khớp chính xác với cơ sở đang quản lý. ADMIN cũng thấy khoản chưa khớp đơn, sai tham chiếu hoặc thiếu bằng chứng ràng buộc người nhận.
2. Kiểm tra tiền nhận, mã giao dịch, thời điểm và trạng thái đơn. Lưu lý do cùng mã đối soát. Dùng mã mới khi ghi kết quả kiểm tra bổ sung. Mỗi lần ghi nối thêm người xử lý, thời gian, lý do và mã vào lịch sử.
3. Khi đã kiểm tra bằng chứng hoàn bên ngoài, nhập số tiền thực tế đã hoàn, mã giao dịch hoàn và lý do, rồi đánh dấu xác nhận đã đối chiếu. Một mã hoàn trên cùng khoản chỉ được ghi một lần. Số tiền cộng dồn được giới hạn bởi khoản thực nhận. Mức được phép hoàn và thẩm quyền hoàn tiền thật đang chờ chốt ở #84. [Thiết kế #84](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/84)
4. Khách xem trạng thái tổng quát trên trang giữ chỗ hoặc phiếu bằng quyền xem đơn hiện có. Khi cần hỗ trợ, khách liên hệ cơ sở và cung cấp mã đơn. Trạng thái sân trên phiếu vẫn theo Booking, kể cả khi khoản tiền muộn đã được ghi nhận hoàn.

Luồng này áp dụng cách ghi nhận hoàn thủ công của luồng hủy/đổi. Dữ liệu hoàn gắn với khoản thực nhận nên dùng sổ riêng, kể cả đơn đã hết hạn và khoản chưa khớp đơn. Mẫu thử lưu bằng chứng dưới dạng mã đối chiếu và xác nhận của người thao tác. Việc hoàn diễn ra bên ngoài hệ thống.

## Bàn giao cho #86

`recordReceiptForReview(verifiedTransfer)` là điểm nhận **nội bộ** cho một khoản Sandbox đã xác minh qua nguồn tin cậy của server và chưa được phân bổ. #86 cần xác thực và tra cứu trước khi gọi. POST trình duyệt chỉ nhận thao tác rà soát/ghi hoàn qua session và CSRF. [Issue #86](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/86)

- Truyền `provider`, `environment: 'sandbox'`, `merchantId`, ID giao dịch chuẩn `transactionId`, `currency: 'VND'`, `amountVND` nguyên đồng và `receivedAt` là `Date` từ thời điểm đã xác minh. ID giao dịch cần duy nhất trong phạm vi provider, môi trường và merchant. Nguồn cấp ID theo tài khoản cần chuẩn hóa để bao gồm định danh tài khoản đã xác minh. ID snapshot `bindingId` và `recipientId` dùng để xác định phạm vi OWNER.
- Truyền `orderReference` và `orderReferenceKind` (`providerPaymentId` hoặc `externalId`) theo cách #86 xác minh và đối chiếu với intent. Truyền `reconciliationCode` đã tách riêng từ nguồn đó. Khoản có thông tin liên kết thiếu hoặc sai định dạng vẫn vào hàng đợi ADMIN. Dữ liệu đưa vào sổ chỉ gồm các trường chuẩn hóa được liệt kê ở đây.
- Gọi ở ngoài transaction phân bổ và chờ ghi bền vững trước khi ACK. Bước đầu lưu bản nhận theo `_id` duy nhất với write concern `majority`. Nếu bước phân loại lỗi, khoản vẫn hiện cho ADMIN ở trạng thái chờ phân loại. Gọi lại với cùng snapshot để tiếp tục. Nếu snapshot mới mâu thuẫn, lỗi 409 giữ nguyên bằng chứng cũ để #86 xử lý sai lệch. #86 cần triển khai chính sách ACK, nhận lại và đối chiếu riêng cho provider.
- Chỉ bàn giao các khoản chưa phân bổ. #86 chịu trách nhiệm quyết định cấp sân đúng hạn, chặn phân bổ trùng và giữ dấu vết của callback xác minh còn dở. #88 chỉ ghi sổ đối soát và lịch sử xử lý, với DB kiểm thử riêng.

## Kiểm tra

Chạy `npm run check` và `npm test` với `TEST_MONGODB_URI` trỏ đến MongoDB replica set riêng trên loopback. Bộ test đi qua route đặt sân, đối soát và phiếu. Các ca gồm hết hạn với ô đã có khách khác, thiếu/thừa tiền, sai tham chiếu, sai quyền, lỗi sau ghi, replay đồng thời, ghi hoàn trùng và chống vượt số tiền thực nhận.

Tích hợp provider Sandbox và chính sách #84 vẫn đang chờ. Dùng `Refs #88` cho PR dự thảo.
