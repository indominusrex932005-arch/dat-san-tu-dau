# Sửa BUG-01 — trang chi tiết sân tràn ngang

Đối chiếu BUG-01 trong [PR #51](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/51), ngày **24/10/2026**. Nhánh `fix/court-detail-long-text`, nền `main` tại SHA `b704f6cbcfe53e4781f329d41170e6f44b8bd11c`; PR sửa lỗi ghi SHA đầu nhánh và kết quả CI tương ứng.

## Nguyên nhân và thay đổi

Tiêu đề sân và đoạn tên/địa chỉ cơ sở nằm ngoài `.demo-card`, chưa có quy tắc ngắt chuỗi dài. Với dữ liệu BUG-01 ở màn hình 390px, document rộng **1241px** trong khi clientWidth chỉ **375px**.

Gắn class `booking-court-title` và `booking-court-location` cho hai phần trong `views/court-detail.ejs`; thêm `overflow-wrap: anywhere` cho đúng hai class trong `public/css/booking.css`. Nội dung vẫn đầy đủ và được EJS escape như trước. Không cắt chuỗi hoặc dùng `overflow-x: hidden` để che lỗi.

## Môi trường và dữ liệu

- ChatGPT in-app browser (IAB), viewport **390×844** và **1366×900**.
- Ứng dụng/controller/service/EJS/CSS/JavaScript thực, MongoDB replica set cục bộ riêng `qaCourtText`, ngày chơi **27/10/2026**; ca đổi ngày dùng **28/10/2026**.
- Ba bộ dữ liệu tổng hợp: dữ liệu thường; tên cơ sở dài từ fixture công khai PR #51 với sân ngắn `QA B01 — Trống 09–18`; tên sân 150 ký tự, tên cơ sở 150 ký tự và địa chỉ 500 ký tự, mỗi trường là chuỗi không có khoảng trắng.
- Fixture BUG-01 lấy từ [commit báo cáo 2d97ebc](https://github.com/indominusrex932005-arch/dat-san-tu-dau/blob/2d97ebcfc806eb8f89305ac7c1f16b369fb80538/docs/kiem-thu-tim-san/fixtures.json). Tên cơ sở lịch sử này dài hơn giới hạn form sửa hiện hành; dùng lại để kiểm tra dữ liệu cũ vẫn hiển thị được.
- Không đọc `.env` hoặc dùng Atlas. Tài khoản OWNER, cơ sở và sân chỉ được tạo trong DB thử riêng.

## Kết quả

| Ca | Bước / mong đợi | Thực tế | Kết quả |
| --- | --- | --- | --- |
| Trước sửa, BUG-01, 390px | Mở trang chi tiết có tên cơ sở dài; mong đợi không cuộn ngang | Document **1241px**, client **375px**; đoạn tên/địa chỉ scrollWidth **1221px**, khung **335px** | Tái hiện lỗi — [ảnh trước sửa](truoc-sua-mobile-390.jpg) |
| Sau sửa, BUG-01, 390px | Tải lại cùng trang; tên/địa chỉ tự xuống dòng | Document/client **375/375px**; tiêu đề và đoạn địa chỉ **335/335px**; đủ nội dung | PASS — [ảnh mobile](bug01-sau-sua-390.jpg) |
| Sau sửa, BUG-01, 1366px | Tên dài nằm trong khung desktop | Document/client **1351/1351px**; tiêu đề và đoạn địa chỉ **1100/1100px** | PASS — [ảnh desktop](bug01-sau-sua-1366.jpg) |
| Chuỗi liền 150/150/500 ký tự, 390px và 1366px | Không tràn; không mất chữ | Document/client **375/375px**, **1351/1351px**; textContent cả ba trường khớp dữ liệu gốc | PASS — [ảnh chuỗi liền mobile](unbroken-sau-sua-390.jpg) |
| Dữ liệu thường, 390px và 1366px | Bố cục thông thường giữ nguyên | Document/client **375/375px**, **1351/1351px**; đủ tên và địa chỉ | PASS — [ảnh dữ liệu thường](normal-sau-sua-390.jpg) |
| Bàn phím và chọn ô, hai viewport | Nhấn Space ở ô 06:00; focus rõ và tổng tiền cập nhật | Checkbox được chọn, outline `solid`, `1 ô · 30 phút`, `50.000 ₫`, nút giữ chỗ mở | PASS |
| Đổi ngày và điều hướng, hai viewport | Chọn 28/10 rồi “Xem lịch”; về danh sách và Back | Lịch đúng 28/10/2026, `/courts` mở được; Back giữ ngày 28/10; không tràn ngang | PASS |

Tổng cộng **6/6 ca bố cục** (3 bộ dữ liệu × 2 viewport) và **2/2 ca tương tác** đạt. Không thấy console error trong tab thử. Mọi tiêu đề/địa chỉ dùng `overflow-wrap: anywhere`, `overflow-x: visible` và giữ đủ textContent. Số clientWidth nhỏ hơn viewport vì thanh cuộn dọc của trình duyệt.

`npm run check`: **PASS**, ESLint và **17 EJS**. `npm test`: **42/42 PASS, 0 skipped** trên nền main của nhánh này. Bản sửa không bao gồm các test của PR #52 đang chờ merge. [Kết quả và fixture JSON](results.json) ghi số đo trước/sau và từng bước tương tác.

## Dọn dữ liệu thử

Trước và sau thử giao diện: **0 Booking / 0 SlotLock / 0 Payment**; các thao tác chọn ô/đổi ngày không gửi đơn đặt sân. Database QA và các DB test tự động đã xóa; app và MongoDB riêng đã dừng, cổng đóng, runtime tạm đã xóa. Viewport trình duyệt được trả về mặc định.
