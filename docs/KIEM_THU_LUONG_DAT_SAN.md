# Kiểm thử luồng đặt sân #33 — sửa review PR #59

**Báo cáo thay thế ngày 26/10/2026; đã bổ sung hai trình duyệt độc lập và PDF thực cho C04/C06. Sẵn sàng nhóm trưởng review #33 theo phạm vi đã ghi.** Không dùng kết luận 9/9 của báo cáo cũ.

[Bằng chứng hoàn tất C04/C06, PDF và kịch bản demo](kiem-thu-dat-san/completion-2026-10-26/README.md). Lần bổ sung chạy SHA `ec14ee0c55b296af80f137936847618c08b6034b`, Google Chrome 155.0.8059.86 và in-app browser; source ứng dụng đồng nhất SHA nền dưới đây.

## C05b — bổ sung QA #78 ngày 04/11/2026

**ĐẠT.** Chờ theo giờ thực đến lúc ô đầu tiên bắt đầu trên `main` tại SHA `5c3e72d50a9802a1533a9ca7b17db0fb8fc3aa47`, đã có báo cáo PR #59. Chạy `server.js` với Node.js 24.15.0, MongoDB 8.3.11 replica set cục bộ `qa78` và dữ liệu tổng hợp. Dùng Google Chrome 156.0.8078.80 headless qua Playwright. Ảnh ở 1366×900 và 390×844 được chụp bằng cách đổi kích thước trong cùng lượt chạy. Giờ hệ điều hành, đồng hồ server và browser, hạn giữ và bản ghi đơn/lock được giữ nguyên trong lúc chờ.

Ngày chơi 04/11/2026, khách C05b chọn hai ô rời nhau **16:30–17:00** (50.000đ) và **17:30–18:00** (75.000đ) qua UI. Một phiên riêng đã giữ và thanh toán mô phỏng ô **17:00–17:30** cùng sân/ngày để làm đối chứng `CONFIRMED`.

| Giờ Việt Nam (UTC+7) | Thao tác | Kết quả thực tế |
| --- | --- | --- |
| 16:27:10.399 | Bắt đầu gửi form giữ sân qua Chrome | POST trả 303, checkout 200. DB ghi đơn lúc 16:27:10.448 với `HOLD` / `UNPAID`, đúng hai lock, 0 Payment. Mốc tạo + 10 phút là 16:37:10.448. Cả đơn và hai lock hết hạn lúc **16:30:00.000**, sớm hơn mốc 10 phút. |
| 16:27:10.484 | Đọc `serverNow` trên checkout | Countdown ban đầu **02:50 còn lại**, khớp thời hạn máy chủ và thời gian đã trôi qua sau phản hồi. Nút mô phỏng còn bật. |
| 16:29:56.012 | Đọc snapshot DB trước mốc | Đơn chính vẫn `HOLD` với đủ hai lock và 0 Payment. Đơn đối chứng vẫn `CONFIRMED`. |
| 16:30:00.562 | Quan sát trang checkout đang mở | Đồng hồ báo tới hạn và nút mô phỏng bị vô hiệu hóa. Trạng thái đơn trên phần thông tin được cập nhật sau khi tải lại. |
| 16:30:00.567 | Gửi POST mô phỏng muộn bằng HTTP tự động trong phiên đó | Máy chủ trả **410** và báo hết hạn giữ sân. Probe dùng form cũ trong bộ nhớ, không bấm nút đã vô hiệu hóa. |
| 16:30:00.743 | Tải lại checkout qua Chrome | GET trả **410**. UI hiển thị **Đã hết hạn**, chưa ghi nhận thanh toán và không còn nút mô phỏng. |
| 16:30:00.997 | Mở lại lịch và thử chọn ô tương lai qua Chrome | Ô 16:30 bị khóa thao tác vì đã qua. Ô đối chứng 17:00 vẫn **Đã đặt**. Ô 17:30 mở lại và chọn được. |
| 16:30:01.243 | Thử gửi lại ô 16:30 bằng HTTP tự động | Máy chủ trả **400**, báo ô đã qua và không tạo thêm đơn. |
| 16:30:01.286 | Đối chiếu snapshot DB sau thao tác | Đơn chính `EXPIRED` / `UNPAID`, 0 lock và 0 Payment. Đơn đối chứng, lock với `expiresAt: null` và Payment mô phỏng giữ nguyên, gồm cả ID và các mốc lưu trong snapshot. |

| Ảnh từ trình duyệt | 1366×900 | 390×844 |
| --- | --- | --- |
| Checkout trước hạn | [Desktop](kiem-thu-dat-san/hold-first-slot-2026-11-04/hold-before-1366.png) | [Mobile](kiem-thu-dat-san/hold-first-slot-2026-11-04/hold-before-390.png) |
| Countdown tới hạn trên trang đang mở | [Desktop](kiem-thu-dat-san/hold-first-slot-2026-11-04/countdown-expired-1366.png) | [Mobile](kiem-thu-dat-san/hold-first-slot-2026-11-04/countdown-expired-390.png) |
| Checkout sau khi tải lại | [Desktop](kiem-thu-dat-san/hold-first-slot-2026-11-04/checkout-expired-1366.png) | [Mobile](kiem-thu-dat-san/hold-first-slot-2026-11-04/checkout-expired-390.png) |
| Lịch với ô tương lai mở lại | [Desktop](kiem-thu-dat-san/hold-first-slot-2026-11-04/calendar-reopened-1366.png) | [Mobile](kiem-thu-dat-san/hold-first-slot-2026-11-04/calendar-reopened-390.png) |

Ảnh che số điện thoại khách thử. JSON chỉ lưu các trường cần đối chiếu, bỏ query/body, cookie, CSRF và guest token. DB thử đã được dọn, app và MongoDB thử đã dừng. [Mốc UTC, kết quả HTTP/DB và hash ảnh](kiem-thu-dat-san/hold-first-slot-2026-11-04/c05b-results.json)

`npm run check` đạt ESLint và 19 template EJS. `npm test` đạt **156/156**, 0 lỗi và 0 bỏ qua trên replica set riêng. Test tự động hỗ trợ đối chiếu phần quyền xem lịch sử riêng ở C01/C09 và đổi thành công có xác nhận chênh lệch ở C07.

### Đối chiếu phạm vi #33

- C01–C04 và C08–C09 giữ kết quả theo phạm vi thực thi của PR #59 ở bảng dưới. C04 đã có bổ sung hai phiên trình duyệt, còn HTTP 409 được ghi trong lần thử trước đó.
- C05 đã có bằng chứng chờ hết đủ 10 phút. C05b nay có bằng chứng chờ đúng mốc ô đầu tiên. C06 giữ phiếu và PDF thực từ lần bổ sung của PR #59.
- C07 giữ các ca qua UI đã ghi, gồm đổi trùng, duyệt hủy và hoàn mô phỏng, từ chối yêu cầu đổi. Lần chạy 04/11 mới kiểm tra đổi thành công có chênh lệch qua HTTP/DB. Lần bổ sung 07/11 đã kiểm tra nhánh đó trên Chrome.

## C07 — đổi lịch có chênh lệch qua Chrome ngày 07/11/2026

**Đạt trong chế độ mô phỏng.** Chạy source `main` tại `ba0d0b352aa8ab7c7e9397f22e2a5e6bac60c94f` với Chrome 156.0.8078.80, Node 24.15.0 và MongoDB 8.3.11 replica set cục bộ. CUSTOMER và OWNER dùng hai phiên độc lập, với dữ liệu tổng hợp trong DB riêng.

| Bước | Kết quả thực tế |
| --- | --- |
| CUSTOMER giữ và thanh toán mô phỏng ô 13:00 của sân cũ, rồi yêu cầu hai ô 13:00 và 19:00 ở sân đích | Form trả 303, yêu cầu `PENDING`, lịch cũ 50.000đ còn giữ |
| OWNER bấm chấp thuận khi chưa xác nhận chênh lệch | HTTP 400. Yêu cầu vẫn `PENDING`, sân cũ và lock cũ giữ nguyên, 0 `EXTRA_DEMO` |
| OWNER xác nhận chênh lệch mô phỏng rồi bấm chấp thuận | HTTP 303, yêu cầu `APPROVED`. Giá mới 160.000đ, gồm 65.000đ và 95.000đ. DB có 2 lock xác nhận ở sân đích, 0 lock ở sân cũ và đúng 1 `EXTRA_DEMO` 110.000đ |
| CUSTOMER mở lại phiếu | Phiếu hiện sân đích, hai ô và tổng mới, giữ `CONFIRMED` / `DEMO_PAID`. Kiểm tra không tràn ngang ở 390×844 và 1366×900 |

`npm run check` đạt, `npm test` đạt 227/227 trên cùng source. [JSON kết quả và hash ảnh](kiem-thu-dat-san/change-fee-2026-11-07/c07-results.json) · [Phiếu mobile](kiem-thu-dat-san/change-fee-2026-11-07/c07-receipt-390.png) · [Phiếu desktop](kiem-thu-dat-san/change-fee-2026-11-07/c07-receipt-1366.png)

C05b và các nhánh còn thiếu đã nêu trong đối chiếu #33 nay có bằng chứng trong phạm vi Chrome, HTTP và DB thử. Firefox, Safari và thiết bị thật vẫn chưa chạy.

Phần còn lại bên dưới là kết quả lịch sử của PR #59.

## Người thực thi, source và môi trường

- Người bàn giao: Hoàng Triều, GitHub `lhtrieu2703-beep`. Codex thực thi thao tác/test trong phiên này; không ghi thành Triều đã tự thao tác.
- Nhánh `docs/kiem-thu-dat-san`, đã cập nhật main `f8c1cfb900ab4ba4cd568e520dce46d9e2dbf0b7`.
- **SHA thực tế đã chạy: `ba4e9de81bfce2420a3d06bf220e9601c7a1fb53`**. Source ứng dụng giống main trên, khác biệt nhánh chỉ ở tài liệu. Commit tiếp theo thay ảnh/báo cáo, không sửa ứng dụng.
- Ngày 26/10/2026, UTC+7; Node 24.15.0, MongoDB 8.3, replica set rs0 tại localhost:27029; DB riêng `qa_booking_59_1792998654432`. Không đọc `.env`, không dùng Atlas.
- Trình duyệt: Codex in-app browser qua CUA; User-Agent do server nhận có `Chrome/156.0.0.0`. Đây là giá trị UA, không khẳng định đó là phiên bản Brave cài trên máy.
- Viewport 1366×900 và 390×844. Mỗi trạng thái được chụp ở hai viewport bằng resize cùng phiên; không nói đã thực hiện lại toàn bộ chuỗi thao tác độc lập hai lần. Ảnh full-page có thể cao hơn viewport và bề rộng trừ scrollbar.
- App thật qua createApp/routes/controllers/services/EJS và MongoStore. Dữ liệu tổng hợp: cơ sở A/B, sân A1/A2/B1, giờ 06–22, cao điểm 18–22, giá 50.000/75.000đ mỗi ô 30 phút. ADMIN và hai OWNER ban đầu là fixture cục bộ; đăng ký khách A và OWNER mới, duyệt OWNER mới đều thực hiện qua giao diện. Không coi fixture ADMIN là kiểm thử script cấp ADMIN.
- [Danh mục ảnh mới](kiem-thu-dat-san/README.md), [manifest từng ảnh](kiem-thu-dat-san/review-2026-10-26/browser-evidence.json), [HTTP/DB đã lọc dữ liệu nhạy cảm](kiem-thu-dat-san/review-2026-10-26/http-db-evidence.json).

## Thay bằng chứng theo review

Đã xem lại bốn ảnh desktop cũ: C03 chưa chọn ô; C06 còn ở checkout; C07 là chi tiết sân; C09 là lỗi nhập SĐT cơ sở. Chúng không chứng minh các kết luận tương ứng. Toàn bộ bộ ảnh cũ đã được gỡ khỏi bản PR hiện tại; lịch sử Git giữ lại để truy vết. Không đổi tên ảnh cũ để gọi là kết quả mới.

## Bảng thực thi mới

| Ca | Bước và đầu vào | Mong đợi | Kết quả thực tế / bằng chứng | Đánh giá |
| --- | --- | --- | --- | --- |
| C01 | Đăng ký Khách A; login sai rồi đúng; mở lịch sử rỗng; logout/login nhiều lần trong các ca sau | Sai mật khẩu bị từ chối; phiên đúng truy cập lịch sử riêng | Sai login HTTP 401; lịch sử A ban đầu rỗng. [Lỗi](kiem-thu-dat-san/review-2026-10-26/C01-login-error-1366.jpg), [rỗng](kiem-thu-dat-san/review-2026-10-26/C01-empty-history-390.jpg) | ĐẠT phần đã chạy; cách ly đơn kiểm tra thêm C09 |
| C02 | Đăng ký OWNER mới; truy cập tạo sân khi còn PENDING; ADMIN cấp cơ sở chờ; OWNER tạo sân giá 60.000/90.000đ và sửa tên | Chưa duyệt bị chặn; sau cấp mới tạo/sửa được sân | PENDING hiển thị đúng; GET tạo sân 403; duyệt bằng UI; tạo rồi sửa sân thành Sân mới QA59 đã sửa. [Chờ](kiem-thu-dat-san/review-2026-10-26/C02-owner-pending-390.jpg), [bị chặn](kiem-thu-dat-san/review-2026-10-26/C02-pending-forbidden-1366.jpg), [kết quả](kiem-thu-dat-san/review-2026-10-26/C02-owner-created-edited-1366.jpg) | ĐẠT |
| C03 | A chọn A1, 29/10/2026, 17:00 và 18:00; giữ chỗ | Hai ô rời nhau, tổng 125.000đ; ô 17:30 không bị giữ | Checkbox thực sự được chọn; checkout và phiếu đúng từng giá. Snapshot trước hủy: đúng hai lock 17:00/18:00, không lock 17:30. [Chọn ô](kiem-thu-dat-san/review-2026-10-26/C03-selected-slots-1366.jpg), [checkout](kiem-thu-dat-san/review-2026-10-26/C03-checkout-two-slots-390.jpg) | ĐẠT |
| C04 | Browser A chọn 16:00; client HTTP B có cookie jar riêng giữ trước; A gửi lựa chọn cũ | B thắng, A nhận 409; không tạo đơn giữ một phần | B 303, A POST /bookings 409, form giữ thông tin liên hệ và bỏ ô đã mất. Chỉ một booking/lock sở hữu 16:00. [409](kiem-thu-dat-san/review-2026-10-26/C04-stale-conflict-1366.jpg) | ĐẠT; [bổ sung A in-app/B Chrome và snapshot không giữ một phần](kiem-thu-dat-san/completion-2026-10-26/README.md) |
| C05 | A giữ A2 12:00 ngày 29/10, không thanh toán; chờ 10 phút theo đồng hồ thật rồi tải lại | HOLD hết hạn; GET checkout 410, ô mở lại, không thanh toán muộn | Xem mục bổ sung hết hạn bên dưới và JSON | ĐẠT hết hạn 10 phút thật; ca sát giờ ghi riêng C05b |
| C05b | A đặt ô 14:30 ngày 26/10 lúc server 14:20:31 | Hạn là 14:30, sớm hơn createdAt + 10 phút; ô 14:00 đã qua bị disabled | Countdown 09:29; data-hold-until=07:30Z, data-server-now=07:20:31Z. [Ảnh lịch sử](kiem-thu-dat-san/review-2026-10-26/C05b-before-first-slot-390.jpg) | PR #59 đạt phần hạn hiển thị, chưa chờ đến 14:30. Lần #78 đã chờ mốc thật, xem phần bổ sung trên. |
| C06 | A bấm mô phỏng thanh toán đơn hai ô C03 | CONFIRMED/DEMO_PAID, phiếu có nhãn mô phỏng và tổng đúng | POST demo-payment 303; phiếu Đã xác nhận, hai ô 50.000 + 75.000đ. Payment INITIAL_DEMO 125.000đ. [Phiếu thật sau thanh toán](kiem-thu-dat-san/review-2026-10-26/C06-confirmed-receipt-1366.jpg) | ĐẠT; [PDF thực một trang đã render/kiểm tra](kiem-thu-dat-san/completion-2026-10-26/phieu-DS-11B6089C64A4.pdf) |
| C07 | A xin đổi sang 19:00 đã bị B đặt; kiểm tra phiếu cũ; A gửi CANCEL; đúng OWNER duyệt hoàn 125.000đ và ghi hoàn mô phỏng; B gửi CHANGE hợp lệ sang 20:00, OWNER từ chối | Đổi trùng bị chặn và giữ lịch cũ; hủy/hoàn do OWNER; từ chối đổi không thay lịch | Đổi trùng 409 ngay lúc gửi, chưa tạo request; phiếu cũ vẫn hai ô. CANCEL → PENDING → APPROVED/CANCELLED; ghi nhận hoàn thủ công. CHANGE của B → REJECTED, lịch B vẫn 19:00. [Đổi bị chặn](kiem-thu-dat-san/review-2026-10-26/C07-change-conflict-1366.jpg), [form hủy](kiem-thu-dat-san/review-2026-10-26/C07-cancel-form-390.jpg), [OWNER duyệt](kiem-thu-dat-san/review-2026-10-26/C07-owner-approved-1366.jpg), [từ chối](kiem-thu-dat-san/review-2026-10-26/C07-owner-rejected-390.jpg) | ĐẠT các nhánh đã nêu; chưa đổi thành công có chênh lệch bằng UI |
| C08 | Logout; khách vãng lai chọn A2 15:00, nhập tên/SĐT tổng hợp, giữ và mô phỏng; OWNER hủy theo cuộc gọi giả lập | Phiếu có liên hệ, không có link tự yêu cầu hủy/đổi; OWNER xử lý được | Phiếu CONFIRMED mô phỏng, số liên hệ cơ sở; 0 link Gửi yêu cầu; OWNER hủy theo liên hệ, khoản hoàn 0. [Phiếu](kiem-thu-dat-san/review-2026-10-26/C08-guest-receipt-390.jpg), [OWNER hủy](kiem-thu-dat-san/review-2026-10-26/C08-owner-cancelled-1366.jpg) | ĐẠT; không lưu/đọc token trong bằng chứng |
| C09 | B và OWNER B mở receipt đơn A; OWNER A/ADMIN mở cùng receipt; khách không có token mở receipt vãng lai | Sai quyền 403, đúng quyền 200 | HTTP xác nhận 403/200 tương ứng; ảnh lỗi là Bạn không có quyền xem đơn này, không phải lỗi SĐT. [Khách B](kiem-thu-dat-san/review-2026-10-26/C09-customer-forbidden-1366.jpg), [OWNER B](kiem-thu-dat-san/review-2026-10-26/C09-owner-other-forbidden-390.jpg), [ADMIN](kiem-thu-dat-san/review-2026-10-26/C09-admin-allowed-1366.jpg), [thiếu token](kiem-thu-dat-san/review-2026-10-26/C09-guest-no-token-390.jpg) | ĐẠT các trường hợp đã chạy |

## Giới hạn và quan sát phải giữ khi bàn giao

- Lần đầu in-app browser timeout khi In/Lưu PDF; đã giải quyết bằng Chrome native UI, lưu PDF thực và kiểm tra render một trang trong bộ completion. PDF không trích được lớp text; chỉ xác nhận nội dung trực quan.
- C04 ban đầu dùng browser A và HTTP B; lần bổ sung đã dùng hai trình duyệt có giao diện, phiên độc lập. Lần bổ sung không thu HTTP status; lỗi UI và DB được lưu, status 409 thuộc lần HTTP trước.
- Không tự gán 0 lỗi console/network: server ghi nhận favicon.ico 404; các 401/403/409 là ca âm dự kiến. Chưa thu bộ console đầy đủ đã lọc token. Không suy kết quả tất cả tài nguyên/font từ ảnh.
- Chưa thử Firefox/Safari/điện thoại thật hoặc mọi đường bàn phím. Ghi rõ ca UI chưa chạy; tests tự động chỉ là bằng chứng bổ trợ.
- PR sẵn sàng review; nhóm trưởng quyết định nghiệm thu và merge. Không sửa source nghiệp vụ để làm ca đạt, không merge main trong task này.

## Bổ sung hết hạn và kết quả công cụ

C05: HOLD tạo lúc 14:13:52.426, hạn 14:23:52.418 ngày 26/10/2026 (UTC+7). Sau thời gian chờ thật, GET checkout trả 410 và trạng thái EXPIRED; không còn nút mô phỏng. Quay lại sân, ô 12:00 ngày 29/10 được chọn lại. POST demo-payment qua client HTTP độc lập lúc 14:25:48 trả 410. DB không có lock/payment của đơn hết hạn. Không sửa holdExpiresAt, thời gian máy hoặc giờ server. [Đơn hết hạn](kiem-thu-dat-san/review-2026-10-26/C05-expired-checkout-390.jpg), [ô mở lại](kiem-thu-dat-san/review-2026-10-26/C05-slot-reopened-1366.jpg).

npm run check: PASS, ESLint và 17 EJS. npm test: 111/111 PASS, 0 fail/skip. Tên test tự động có nhắc PDF không chứng minh đã xuất PDF qua trình duyệt trong phiên này.

App QA đã đóng, DB dùng một lần đã được drop; không giữ tài khoản/session QA hoạt động. Bằng chứng HTTP/DB đã bỏ query/body/cookie/CSRF/token; thông tin tên/SĐT trong ảnh là dữ liệu tổng hợp.
