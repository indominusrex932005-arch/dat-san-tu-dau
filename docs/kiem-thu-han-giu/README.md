# Kiểm thử hạn giữ sân theo ô đầu tiên — issue #37

Ngày chạy: **24/10/2026 (giờ Việt Nam)**. Nhánh: `fix/hold-expiry-first-slot`, nền `main` cuối cùng tại SHA `b704f6cbcfe53e4781f329d41170e6f44b8bd11c`. PR ghi SHA đầu nhánh được review; các file trong thư mục này đi cùng thay đổi và test trong chính commit đó.

## Quy tắc và phạm vi

`effectiveExpiry = min(createdAt + 10 phút, thời điểm bắt đầu sớm nhất trong các ô đã chọn)`; HOLD cũ có hạn đã lưu sớm hơn thì tiếp tục giữ hạn sớm hơn. Booking và mọi SlotLock của HOLD mới lưu cùng một mốc UTC. Giao diện trình bày giờ Việt Nam.

Máy chủ kiểm tra lại khi thanh toán và sau các thao tác đọc/ghi lock có thể phải chờ. Tại hoặc sau hạn, transaction lưu `EXPIRED`, giải phóng toàn bộ lock của đúng đơn, rồi HTTP trả `410`; không tạo Payment. Đơn đã `CONFIRMED` giữ nguyên trạng thái và lock vĩnh viễn.

## Môi trường và dữ liệu

- Node.js và MongoDB replica set cục bộ `qaExpiry37`, tài khoản/cơ sở/sân thử tổng hợp; dùng app, controller, service, EJS và JavaScript thực.
- Trình duyệt: ChatGPT in-app browser (IAB), viewport **1366 × 900** và **390 × 844**.
- Ảnh trình duyệt được chụp trên thay đổi #37 với nền `94ee45eeb39e3de15b3d5c05cf15ff66ee94cb49`. Sau đó nhánh cập nhật lên `b704f6c` (PR #44 chỉ đổi form thêm/sửa sân của OWNER, không đổi trang checkout hoặc backend giữ sân), rồi chạy lại toàn bộ check/test trên nền mới.
- Chỉ tiến trình Node QA dùng đồng hồ mô phỏng chạy liên tục từ **10/05/2030 15:58:00 +07:00** để đi qua hạn 16:00. Đồng hồ hệ điều hành và trình duyệt không bị thay đổi. Đây là kiểm tra giao diện thực với thời gian server được điều khiển, không phải chờ đến 16:00 theo giờ thực của ngày chạy.
- Không đọc `.env`, không dùng Atlas, không thanh toán ngân hàng. QA dùng tài khoản đăng nhập, không đưa guest token hay thông tin đăng nhập vào bằng chứng.

## Kết quả tự động

`npm run check`: **PASS**, gồm ESLint và cú pháp **17 template EJS**. `npm test`: **73/73 PASS, 0 bỏ qua** trên MongoDB transaction thật; trong đó 23 kết quả từ bộ hạn giữ mới (gồm test cha) và 8 ca countdown mới. Các lỗi HTTP dự kiến trong ca từ chối được assert theo status và trạng thái DB.

| Nhóm ca | Thực tế | Trạng thái / bằng chứng |
| --- | --- | --- |
| Ô đầu cách hơn 10 phút, dưới 10 phút, đúng 10 phút; nhiều ô rời nhau không sắp xếp | Chọn min giữa mốc 10 phút và ô bắt đầu sớm nhất | PASS — [hold-expiry.test.js](../../tests/hold-expiry.test.js) |
| Tạo HOLD tại đúng giờ ô đầu bắt đầu | HTTP 400, không tạo Booking hoặc lock | PASS — test HTTP/DB cùng file |
| Thanh toán trước hạn 1 ms | CONFIRMED, đúng 1 Payment; cleanup/replay giữ nguyên lock vĩnh viễn | PASS — test HTTP/DB |
| Thanh toán đúng hạn và sau hạn 1 ms | HTTP 410; EXPIRED, 0 lock, 0 Payment | PASS — test HTTP/DB |
| Chờ transaction hoặc chờ ghi lock qua hạn | Kiểm tra lại thời gian; commit hết hạn rồi trả 410 | PASS — test HTTP/DB |
| HOLD cũ lưu hạn quá muộn | Checkout rút ngắn Booking và lock; cleanup/payment từ chối khi tới ô đầu hoặc quá 10 phút từ createdAt | PASS — test HTTP/DB |
| Payment / cleanup / hai người giữ lại ô sau chạy đồng thời | Không hồi sinh đơn cũ, không chiếm lock đơn mới, không giữ một phần | PASS — test transaction |
| Payment thắng trước hạn, cleanup và người giữ khác chạy đồng thời | Lock CONFIRMED không bị xóa hoặc chiếm lại | PASS — test transaction |
| Countdown: tải chậm, đồng hồ client sai/đổi, thiếu navigation timing/server time, trước/đúng hạn, hết hạn khi đang tải | Dùng deadline server và thời gian đơn điệu; đúng hạn khóa nút, thông báo cần tải lại | PASS — [checkout-countdown.test.js](../../tests/checkout-countdown.test.js), [kết quả 8 ca VM](countdown-cases.json) |

## Kiểm tra trình duyệt và DB

HOLD sát giờ chọn hai ô **16:00 và 19:00**, tạo lúc `2030-05-10T08:58:00.061Z`; hạn là `2030-05-10T09:00:00Z` (**16:00 giờ Việt Nam**), chỉ **119.939 giây** sau lúc tạo. Cả hai lock cùng hạn UTC này. HOLD đối chứng chọn **17:00 và 20:00**, hạn đúng **600.000 ms** sau lúc tạo, cả hai lock cùng hạn.

| Ca / bước | Mong đợi | Thực tế | Kết quả / bằng chứng |
| --- | --- | --- | --- |
| Mở checkout trước hạn ở 1366 px | Hạn 16:00, countdown dưới 10 phút, nút còn dùng được, không cuộn ngang | `00:57 còn lại`, nút mở; document/clientWidth đều 1351 px | PASS — [ảnh desktop](checkout-desktop-1366.jpg) |
| Chuyển sang 390 px | Cùng deadline, nội dung đọc được, không cuộn ngang | `00:55 còn lại`, nút mở; document/clientWidth đều 375 px | PASS — [ảnh mobile](checkout-mobile-390.jpg) |
| Đợi đến deadline trên trang đang mở | Tự dừng thanh toán và thông báo hết thời gian trên client | `data-expired=true`, nút bị disable, yêu cầu tải lại để cập nhật đơn | PASS — [ảnh tới hạn](countdown-het-han-mobile-390.jpg) |
| Tải lại sau hạn | Máy chủ xác nhận đơn hết hạn, bỏ nút thanh toán | HTTP 410, hiển thị “Đã hết hạn”, không còn timer hoặc nút demo | PASS — [ảnh sau tải lại](don-het-han-mobile-390.jpg) |
| Gửi thanh toán muộn, kiểm tra DB | Từ chối, giải phóng cả hai ô, không tạo Payment; HOLD đối chứng còn nguyên | HTTP 410; đơn sát giờ EXPIRED / 0 lock / 0 Payment; đơn đối chứng HOLD / 2 lock / 0 Payment | PASS — [kết quả JSON](results.json) |

Các ảnh thể hiện những thời điểm khác nhau của cùng một countdown nên số giây có chênh lệch. Trang đang mở chỉ khóa nút khi tới hạn; trạng thái DB được đọc lại sau tải lại hoặc request xử lý. Việc client tắt nút không thay thế kiểm tra phía máy chủ.

Countdown bù thời gian tải từ navigation `responseStart`, không đo được độ trễ từ server đến byte phản hồi đầu tiên. Vì vậy đồng hồ chỉ hỗ trợ hiển thị; máy chủ quyết định hạn khi nhận thanh toán. Các ca VM dùng mã `public/js/booking.js` thực và DOM tối thiểu, được bổ sung bằng ảnh trình duyệt thật ở trên.

## Dọn dữ liệu thử

Database QA đã được xóa sau khi kiểm tra marker, tiến trình app/MongoDB riêng đã dừng, cổng 3017/27049 đã đóng và runtime tạm đã xóa. Lần chạy toàn bộ 73 test dùng một MongoDB tạm mới; test tự xóa database riêng và tiến trình/runtime này cũng đã dừng, xóa sau khi chạy. Không thay đổi dữ liệu dự án hoặc dữ liệu Atlas.
