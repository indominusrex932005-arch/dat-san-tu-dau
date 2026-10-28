# Báo cáo kiểm thử giao diện #32 — chạy lại trên main hiện tại

> Báo cáo kết quả thực tế ngày **26/10/2026**. Người bàn giao: Hoàng Triều (`lhtrieu2703-beep`); thao tác QA do Codex thực hiện. Chỉ ghi ĐẠT cho thao tác đã chạy trong trình duyệt; các phần còn thiếu ghi rõ bên dưới.

## Bản chạy và dữ liệu

- `main` tại thời điểm kiểm thử: `f8c1cfb900ab4ba4cd568e520dce46d9e2dbf0b7` (bao gồm PR #58).
- SHA code đang chạy trong app local: `f8c1cfb900ab4ba4cd568e520dce46d9e2dbf0b7`. Merge commit `2826655c931712f37dda981578a769e08968cdcd` chỉ giải quyết conflict tài liệu của PR này.
- Chrome in-app trên Windows, UA `Chrome/156.0.0.0`; viewport CSS được đặt ở 1366×900 và 390×844. Ảnh viewport được chụp qua trình duyệt; ảnh JPEG thực tế lần lượt 1351×890 và 375×811 do vùng nội dung/scrollbar browser. Các trang đã đo không phát sinh cuộn ngang.
- Node 24.15.0, MongoDB 8.3 replica set tại `127.0.0.1:27029`. Database tạm riêng `qa60_1793004098884`, chỉ chứa fixtures tổng hợp `qa60.test`; không dùng Atlas. App đã dừng, database QA đã drop sau khi hoàn tất.
- [Ảnh mới theo từng ca](kiem-thu-giao-dien/README.md), [manifest kích thước và SHA-256](kiem-thu-giao-dien/review-2026-10-26/screenshot-manifest.json), [audit HTTP đã lọc](kiem-thu-giao-dien/review-2026-10-26/http-evidence.json). Audit chỉ giữ method, path không query, status, thời gian và User-Agent; không lưu headers/body/cookie/CSRF.
- Lượt bổ sung tối 26/10/2026 chạy cùng SHA ứng dụng trên DB local riêng `qa60_followup_1793022096973`, ban đầu rỗng. Hai tài khoản tổng hợp được tạo bằng form UI, rồi đăng nhập; đã đối chiếu vai trò trong DB và drop DB sau kiểm tra. Xem [kết quả đăng ký](kiem-thu-giao-dien/followup-2026-10-26/registration-results.json), [console capture](kiem-thu-giao-dien/followup-2026-10-26/console-results.json), [manifest ba ảnh bổ sung](kiem-thu-giao-dien/followup-2026-10-26/screenshot-manifest.json). Browser in-app dùng viewport mặc định 1280×720 và override 390×844 cho màn chờ duyệt; ảnh thực tế 1265×712 và 375×811.

## Kết quả

| Ca | Thao tác và kết quả quan sát được | Trạng thái |
| --- | --- | --- |
| G02 | App local khởi động, bốn trang công khai và CSS trang tải HTTP 200. Trang URL thử 404 trả đúng trang “Không tìm thấy trang”. | ĐẠT |
| H01 | Trang chủ hiển thị tiếng Việt/điều hướng; CTA “Xem sân và đặt lịch” mở `/courts`. Tab đặt focus rõ lên link bỏ qua nội dung, rồi nav; Enter mở `/facilities`. Đã cuộn tới cuối trang trên mobile. Console được bổ sung ở ERR-01. | ĐẠT phần đã chạy |
| H02 | Khách đăng nhập thấy “Đơn của tôi”; OWNER thấy “Quản lý sân” và trang `/owner`. Đăng xuất trả về phiên khách. | ĐẠT |
| F01 | `/facilities` hiển thị fixture có tên/địa chỉ/số liên hệ; nội dung tên và địa chỉ dài xuống dòng trong thẻ trên desktop/mobile. | ĐẠT |
| F02 | Xóa fixtures cơ sở trong DB QA riêng, tải lại `/facilities`: trạng thái rỗng và link về trang chủ xuất hiện trên hai viewport. | ĐẠT |
| L01 | `/login` có link đăng ký khách, đăng ký chủ sân và đặt sân không đăng nhập; các link mở đúng `/register`, `/register/owner`, `/courts`. Kiểm tra Tab Email → Mật khẩu → nút; Enter gửi form. Các ca gửi đăng ký được bổ sung ở L05/L06. | ĐẠT |
| L02 | Đăng nhập khách với fixture: POST 303, vào `/courts`, nav có “Đơn của tôi”. | ĐẠT |
| L03 | Đăng nhập OWNER `APPROVED`: POST 303, vào `/owner`; nav có “Quản lý sân”. | ĐẠT |
| L04 | Sai mật khẩu: POST 401; trang giữ email và hiện thông báo “Email hoặc mật khẩu không đúng.”; ảnh mobile/desktop. | ĐẠT |
| L05 | Điền và bấm “Tạo tài khoản khách” trên `/register`: chuyển về `/login`. Đăng nhập bằng tài khoản vừa tạo vào `/courts`, nav hiện tên khách và “Đơn của tôi”. DB xác nhận đúng một tài khoản CUSTOMER. | ĐẠT |
| L06 | Điền đủ thông tin và bấm “Gửi đăng ký chủ sân” trên `/register/owner`: chuyển về `/login`. Đăng nhập tài khoản vừa tạo vào `/owner`, hiện “Đang chờ duyệt tài khoản” và thông tin đề nghị. DB xác nhận OWNER/PENDING, chưa tạo cơ sở (0 bản ghi). Ảnh desktop/mobile, mobile không cuộn ngang (clientWidth = scrollWidth = 375). | ĐẠT |
| C01 | `/courts` hiển thị sân/cơ sở/địa chỉ, giờ 06:00–22:00, giá thường 50.000đ/30 phút và cao điểm 75.000đ/30 phút (18:00–22:00); link sân mở chi tiết. Chọn 16:00 và 18:00 cho thấy 2 ô rời, 60 phút, tổng 125.000đ. | ĐẠT |
| C02 | Sân thuộc cơ sở không có OWNER đã duyệt/số điện thoại hiển thị cảnh báo “Đang chờ cấp chủ sân hoặc số liên hệ.” | ĐẠT |
| C03 | Xóa fixtures sân/cơ sở trong DB QA riêng, tải lại `/courts`: “Chưa có sân đang hoạt động.” trên desktop/mobile. | ĐẠT |
| C04 | Tên sân dài và chuỗi không có dấu cách trong địa chỉ xuống dòng ở card mobile; thao tác Tab làm focus nổi rõ trên nút mở sân. | ĐẠT phần đã chạy |
| C05 | Chọn cơ sở Bình Minh, ngày 29/10/2026, 16:00–17:00 rồi Enter: URL giữ đủ query, danh sách giảm từ 3 sân xuống đúng sân đã chọn; link mở chi tiết giữ query ngày. Kiểm tra khoảng ngược 18:00–17:00: backend trả thông báo lỗi và màn “không tìm được sân”. | ĐẠT luồng hợp lệ; ghi lỗi hiển thị lặp bên dưới |
| ERR-01 | Thu console browser qua `tab.dev.logs` từ khi mở tab mới, không lọc cấp log: hai luồng đăng ký/đăng nhập và các trang `/`, `/facilities`, `/courts`, `/login`, `/register`, `/register/owner`. Cả 8 lần đọc đều trả mảng rỗng, không ghi nhận log/warning/error. Đây là console capture API, không phải ảnh giao diện DevTools. | ĐẠT trong phạm vi lượt bổ sung |
| ERR-02 | Các stylesheet quan sát trong audit trả 200. `favicon.ico` trả 404 ở lần đầu; URL không tồn tại trả 404 theo chủ đích. Chưa rà mọi request/font trong Network DevTools. | CHƯA KIỂM TRA toàn bộ |

## Lỗi giao diện cần nhóm trưởng phân công

**BUG-01 — thông báo lỗi bộ lọc bị render hai lần.** Trên `/courts`, nhập “Từ giờ” 18:00 và “Đến giờ” 17:00 rồi bấm “Tìm sân”. Ứng dụng hiện cùng dòng “Giờ kết thúc phải sau giờ bắt đầu.” một lần phía trên trang và một lần trong thẻ bộ lọc. Tái hiện bằng thao tác UI trên main `f8c1cfb900ab4ba4cd568e520dce46d9e2dbf0b7`; ảnh [desktop](kiem-thu-giao-dien/review-2026-10-26/BUG01-duplicate-filter-error-1366.jpg), [mobile](kiem-thu-giao-dien/review-2026-10-26/BUG01-duplicate-filter-error-390.jpg). Lỗi được ghi lại để chuyển nhóm trưởng, không sửa source ngoài phạm vi QA.

Bản sửa nằm trong [PR #72](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/72), SHA `8c03f241cce732965be617c8144ab709e6ea5d17`, đang chờ review/merge tại thời điểm bổ sung báo cáo. Lượt QA này giữ nguyên SHA main đã ghi, không kết luận bản main đã hết BUG-01.

## Ca chưa chạy và giới hạn

- Đã submit đăng ký khách/OWNER ở lượt bổ sung. OWNER được tạo từ form ở L06 chỉ kiểm tra trạng thái chờ duyệt; ca OWNER đã duyệt ở L03 vẫn dùng fixture cũ, chưa kiểm thử UI ADMIN duyệt trong báo cáo này.
- Chưa có bản ghi sân active nhưng thiếu riêng số điện thoại trong fixture; C02 kiểm tra trường hợp không có OWNER được duyệt và không có điện thoại cùng lúc.
- Console capture ở ERR-01 chỉ bao phủ lượt bổ sung trên DB rỗng và hai tài khoản mới, không bao phủ lại toàn bộ tương tác với sân có dữ liệu trong lượt đầu. Chưa kiểm tra toàn bộ request tĩnh/font trên Network; không kết luận “0 lỗi console/network” cho toàn ứng dụng.
- Các ca đã ghi ĐẠT chỉ giới hạn ở thao tác và viewport trong bảng; chưa thử thiết bị di động thật hoặc trình duyệt khác. Fixture chỉ xác nhận UI đọc dữ liệu giả lập từ MongoDB local, không phải dữ liệu Atlas/phát hành.
- Không dùng lại kết luận 14/14 hoặc ảnh từ báo cáo cũ; bộ ảnh cũ không khớp SHA và đã được thay khỏi nhánh này.

## Kiểm tra bàn giao

PR #60 chỉ cập nhật tài liệu/ảnh QA; không đổi source nghiệp vụ, test, dependency hoặc CI. `npm run check` đạt (ESLint không lỗi; 17 template EJS hợp lệ). `npm test` đạt **111/111**, 0 lỗi, chạy với replica set MongoDB cục bộ tạm thời. Không sửa hành vi ứng dụng trong issue QA này.
