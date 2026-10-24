# Kiểm thử giữ dữ liệu form đặt sân — issue #38

Bảng và ảnh bên dưới ghi lại lần kiểm thử ban đầu ngày **24/10/2026**, nhánh `fix/booking-form-recovery`, nền `main` tại SHA `b704f6cbcfe53e4781f329d41170e6f44b8bd11c`, head `629dc35fa3b882b29a1b334b8349b9397b91cba2`. Lần này chưa gộp PR #52/#54; không dùng kết quả lịch sử thay kiểm thử bản tích hợp. **Kết quả cập nhật được ghi riêng tại [kiểm thử tích hợp #52](tich-hop-52/README.md): bản cuối dùng main `150ba95` đã merge cả #52 và #54, 111/111 test đạt.**

## Hành vi đã sửa

POST `/bookings` sai thông tin hoặc tranh ô hợp lệ giữ mã HTTP **400/409** và trả lại trang đúng sân/ngày với lịch/giá mới nhất. Tên và SĐT giữ nguyên dữ liệu đã nhập, kể cả chuỗi rỗng, được EJS escape. Chỉ các ô còn AVAILABLE được chọn lại; ô đã bị giữ/đặt hoặc ngoài giờ bị bỏ chọn, khóa và nêu rõ trong thông báo. Controller không lấy giá/trạng thái từ client và không cấp một phần đơn.

JavaScript gửi form bằng fetch cùng origin, thay phần `<main>` từ HTML backend rồi khởi tạo lại form, focus vào lỗi và giữ URL GET của sân/ngày. Không tự thử lại POST. Người dùng chủ động sửa thông tin hoặc kiểm tra lựa chọn rồi gửi lại. Thành công vẫn theo redirect **303** của backend đến checkout.

ID/ngày thiếu, sai kiểu hoặc không hợp lệ không bị đổi sang lịch ngày khác; CSRF giữ **403**, sân không còn/ngừng giữ **404**, lỗi DB thật giữ **500**. Lỗi đọc lịch mới không bị biến thành mảng rỗng.

## Môi trường và dữ liệu

- Node.js, Express/EJS/JavaScript của ứng dụng thực; MongoDB replica set cục bộ riêng `qaForm38`, không đọc `.env` hoặc dùng Atlas.
- IAB (ChatGPT in-app browser), **390×844** và **1366×900**, đồng hồ server/browser thực, không mô phỏng thời gian.
- OWNER/CUSTOMER/cơ sở/sân đều tổng hợp. Khách A đăng nhập trong trình duyệt; khách B là session HTTP độc lập đi qua POST/CSRF/transaction thực.
- Ngày thử: **27/10/2026** cho lỗi SĐT và reload; **28/10** cho tranh ô mobile; **29/10** cho tranh ô desktop. Hai ô A chọn ban đầu là **14:00 và 14:30**.

## Kết quả tự động

`npm run check`: **PASS**, ESLint và **17 template EJS**. `npm test`: **67/67 PASS, 0 skipped** gồm 42 kết quả của nền, 17 từ bộ HTTP/DB mới (16 ca con và test cha), 8 ca script mới.

| Bộ kiểm tra | Ca đã chạy | Thực tế |
| --- | --- | --- |
| [HTTP/DB](../../tests/booking-form-recovery.test.js) | Sai SĐT/tên trống; khách đăng nhập xóa rõ trường khác với không gửi trường; HTML/quote được escape; mảng sai kiểu | 400, form giữ dữ liệu phù hợp; không tạo Booking/lock |
| HTTP/DB | `times[]`, ô trùng/sai, thiếu ô; hai khách tranh cùng nhiều ô; một phần lựa chọn còn trống | 400/409 phù hợp; chỉ một lần giữ đủ ô thành công, không giữ một phần hoặc ghi trùng |
| HTTP/DB | Giá/giờ phục vụ đổi sau khi mở form, cơ sở ngừng nhận đơn; gửi lại thủ công | Lịch/giá đọc mới; bỏ ô không còn hợp lệ; giá đơn gửi lại lấy server |
| HTTP/DB | ID/ngày thiếu/sai/mảng/quá khứ, sân ngừng/xóa/không tồn tại, thiếu/sai CSRF, lỗi DB ở lúc tạo và lúc đọc lại lịch | Giữ đúng lỗi 400/404/403/500; không dựng lịch rỗng hoặc chuyển sang sân/ngày khác |
| [Script VM](../../tests/booking-form-script.test.js) | Hai lần submit lúc chờ; mạng/HTML lỗi; phục hồi 400/409; lỗi server 403/500; thành công 303; pageshow | 8/8 PASS bằng mã `public/js/booking.js` thực; không tự POST lại, không nhân đôi listener, giá/form mới được khởi tạo lại |

Các test VM dùng DOM tối thiểu để kiểm tra hành vi gửi request; các ảnh và ca trình duyệt thật bên dưới kiểm tra bố cục, điều hướng, focus và reload. Lint không thay các ca chức năng.

## Kết quả trình duyệt và DB

| Ca / bước | Mong đợi | Thực tế / bằng chứng | Kết quả |
| --- | --- | --- | --- |
| Form thường, hai viewport | Có dữ liệu hồ sơ, chưa chọn ô, nút giữ chỗ khóa; không tràn ngang | Document/client **375/375px** và **1351/1351px** — [390px](thuong-390.jpg), [1366px](thuong-1366.jpg) | PASS ×2 |
| Chọn 14:00 + 14:30, nhập tên riêng và SĐT `090abc1234`, gửi | HTTP400, giữ tên/SĐT/ngày và hai ô; tổng giá mới đúng; focus lỗi | Giữ đúng tên và SĐT sai, **2 ô · 60 phút / 100.000 ₫**, thông báo rõ, không tràn — [390px](sai-sdt-390.jpg), [1366px](sai-sdt-1366.jpg) | PASS ×2 |
| Reload sau lỗi ở desktop | Chỉ GET lại sân/ngày, không POST ngầm | Số POST `/bookings` trước/sau vẫn **2/2**; GET trả form mới. DB vẫn **0 Booking / 0 lock / 0 Payment** | PASS |
| Mobile: A chọn hai ô; B giữ 14:30, giá thường đổi 50.000→70.000; A gửi dữ liệu cũ | HTTP409, giữ thông tin và ô 14:00, bỏ/khóa 14:30, giá cập nhật | **1 ô · 30 phút / 70.000 ₫**, 14:30 disabled/unchecked, thông báo “đang được người khác giữ chỗ”, focus lỗi; không tràn — [ảnh mobile](tranh-o-390.jpg) | PASS |
| Mobile: A bấm gửi lại trên form đã phục hồi, không nhập lại tên/SĐT | 303 đến checkout, chỉ giữ ô 14:00 với giá server | Đơn A đúng **70.000 ₫**, 1 ô / 1 lock; B giữ nguyên 14:30 | PASS |
| Desktop: A chọn hai ô; B giữ 14:30, giá đổi 70.000→100.000; A gửi | HTTP409, giữ ô còn trống và giá mới | **1 ô · 30 phút / 100.000 ₫**, 14:30 disabled/unchecked, không tràn — [ảnh desktop](tranh-o-1366.jpg) | PASS |
| Desktop: A gửi lại thủ công từ form lỗi | 303 đến checkout, không ghi trùng hoặc giữ một phần | Đơn A đúng **100.000 ₫**, 1 ô / 1 lock; B giữ nguyên ô riêng | PASS |

Tổng **9/9 ca trình duyệt PASS**. Không thấy console error trong tab thử. HTTP log ghi đúng **8 POST chủ động**: 2 lần 400, 2 lần 409 và 4 lần 303 (2 lần B giữ ô, 2 lần A gửi lại). Cuối cùng DB có **4 Booking HOLD / 4 SlotLock với mốc giờ duy nhất / 0 Payment**, mỗi đơn đúng một ô. Không có Booking từ các lần 400/409 hoặc thao tác reload. Xem [browser JSON](browser-results.json), [HTTP/DB JSON](http-db-results.json).

Giá trị `input[type=tel]` bị công cụ DOM trình duyệt che khi đọc. Việc giữ SĐT sai được xác minh bằng cả hai ảnh và test HTTP thật; không dùng phép so sánh DOM bị che để kết luận mất dữ liệu. Hai lần gửi lại từ form lỗi cũng thành công với SĐT hợp lệ được giữ nguyên.

## Giới hạn và dọn dữ liệu

Nếu thiếu fetch/DOMParser, form vẫn dùng POST HTML thông thường, trả 400/409 cùng dữ liệu. Khi reload trang POST, trình duyệt có thể hỏi xác nhận gửi lại; ứng dụng không tự gửi lại. Với JavaScript hiện đại đã thử, reload từ trang lỗi là GET. Reload GET đọc lịch mới và không lưu dữ liệu lỗi qua localStorage/sessionStorage. Mất kết nối có thể xảy ra sau khi server đã xử lý; giao diện báo **chưa xác nhận được kết quả** và đưa link tải lại lịch GET, không tự cho rằng đơn chưa được tạo hoặc tự thử lại.

Sau khi đối chiếu marker, DB QA và mọi DB regression riêng đã xóa; tiến trình app/MongoDB riêng đã dừng, cổng đóng, runtime tạm đã xóa. Viewport trình duyệt trả về mặc định. Không sửa dữ liệu dự án hoặc dữ liệu Atlas.
