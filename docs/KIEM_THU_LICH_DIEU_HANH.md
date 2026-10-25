# Báo cáo kiểm thử lịch điều hành và phân quyền chủ sân — Issue #66

Ngày thực hiện: **25/10/2026**, giờ Việt Nam (UTC+7).  
Người thực hiện kiểm thử: **Lê Hoàng Triều** (`lhtrieu2703-beep`).  
Kết quả tổng thể: **7/7 ca kiểm thử tích hợp ĐẠT (PASS)**; **23/23 targeted tests ĐẠT**; **134/134 test suite toàn hệ thống ĐẠT (0 fail)**; **`npm run check` ĐẠT (0 lỗi lint, 18 template EJS hợp lệ)**.

---

## 1. Bản được kiểm thử và môi trường

| Mục | Chi tiết thực tế |
| --- | --- |
| **Issue** | [#66](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/66) — [QA] Kiểm thử lịch điều hành và phân quyền chủ sân |
| **Bản ứng dụng được kiểm thử** | Nhánh `draft/ui-owner-calendar`, SHA [`3d76e104764834ffba04910ebf11fdf335804aa1`](https://github.com/indominusrex932005-arch/dat-san-tu-dau/tree/3d76e104764834ffba04910ebf11fdf335804aa1) |
| **Tích hợp Backend & UI** | Backend [#62](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/62) (SHA `2fa29be`, PR #68) + UI [#63](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/63) (SHA `3d76e10`) |
| **Nền main khi bắt đầu** | `f8c1cfb900ab4ba4cd568e520dce46d9e2dbf0b7` |
| **Thời gian chạy kiểm thử** | 15:05:48 ngày 25/10/2026 (Giờ Việt Nam UTC+7 / `2026-10-25T08:05:48Z`) |
| **Runtime & Môi trường** | Node.js `v24.15.0`, MongoDB `8.3.11` (replica set `rs0` cục bộ, cổng `27029`) |
| **Cơ sở dữ liệu kiểm thử** | Database tạm dùng một lần `qa_calendar_66_*`, tự động dọn sạch sau khi kiểm thử. Tuyệt đối không dùng `.env` hoặc Atlas của nhóm. |
| **Trình duyệt / Viewport** | Desktop **1366 × 900**, Mobile **390 × 844** |
| **Phương thức thực thi** | Test client `TestBrowser` gọi HTTP thật qua `createApp` thật, kèm cookie session và CSRF. Kiểm tra đầy đủ DOM render, status code, snapshot dữ liệu MongoDB. |

---

## 2. Dữ liệu thử nghiệm và cấu hình (Fixtures)

Bộ dữ liệu tổng hợp được khởi tạo độc lập trên database tạm để phục vụ 7 ca kiểm thử:

1. **Tài khoản người dùng (User)**:
   - `Chủ Sân A` (`owner-a@qa.test`): Vai trò `OWNER`, trạng thái `APPROVED`, sở hữu Cơ sở A.
   - `Chủ Sân B` (`owner-b@qa.test`): Vai trò `OWNER`, trạng thái `APPROVED`, sở hữu Cơ sở B.
   - `Chủ Sân Chưa Có Sân` (`owner-empty@qa.test`): Vai trò `OWNER`, trạng thái `APPROVED`, sở hữu Cơ sở Rỗng.
   - `Chủ Chưa Cấp Cơ Sở` (`owner-unassigned@qa.test`): Vai trò `OWNER`, trạng thái `APPROVED`, chưa được gán cơ sở nào.
   - `Chủ Chờ Duyệt` (`owner-pending@qa.test`): Vai trò `OWNER`, trạng thái `PENDING`.
   - `Khách Hàng` (`customer@qa.test`): Vai trò `CUSTOMER`.
2. **Cơ sở thể thao (Facility)**:
   - `Cơ Sở Thể Thao A`: Thuộc Chủ Sân A; tên chứa payload HTML/script `<script>alert("XSS")</script>` để kiểm tra escape; địa chỉ dài.
   - `Cơ Sở Riêng Biệt B`: Thuộc Chủ Sân B.
   - `Cơ Sở Rỗng`: Thuộc Chủ Sân Chưa Có Sân.
3. **Cấu hình sân (Court)**:
   - `Sân A1 — Sân Buổi Sáng`: Mở cửa **06:00 – 10:00**, cao điểm 08:00–10:00.
   - `Sân A2 — Sân Buổi Tối`: Mở cửa **17:00 – 22:00**, cao điểm 18:00–21:00; tên dài hơn 100 ký tự.
   - `Sân A3 — Tạm Ngừng Hoạt Động`: `active: false`, mở cửa 06:00 – 22:00.
   - `Sân B1 Bí Mật Của B`: Thuộc cơ sở B, mở cửa 07:00 – 21:00.

---

## 3. Bảng kết quả chi tiết 7 ca kiểm thử (Theo yêu cầu Issue #66)

Toàn bộ dữ liệu đo đạc và phản hồi thô được lưu trữ tại file bằng chứng [qa-results-66.json](docs/kiem-thu-lich-dieu-hanh/qa-results-66.json).

| Mã ca | Mục tiêu & Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :---: |
| **TC-01** | **Phân quyền và phạm vi cơ sở**<br>1. Truy cập `/owner/calendar` khi chưa đăng nhập.<br>2. Đăng nhập tài khoản `CUSTOMER`, `OWNER PENDING`, `OWNER` chưa có cơ sở.<br>3. Đăng nhập `OWNER A` xem lịch, sau đó chèn query `?facilityId=...&owner=...` của B.<br>4. Đăng nhập `OWNER B` xem lịch. | - Khách chưa đăng nhập bị chuyển hướng về `/login` (302/303).<br>- `CUSTOMER`, `PENDING`, chưa cấp cơ sở nhận lỗi **403 Forbidden**.<br>- `OWNER A` chỉ thấy các sân cơ sở A; không thấy sân cơ sở B; query chèn cơ sở bị bỏ qua.<br>- `OWNER B` chỉ thấy đúng cơ sở B. | - Chưa đăng nhập: `HTTP 303` chuyển hướng `/login`.<br>- Customer/Pending/Unassigned: đều trả `HTTP 403`.<br>- `OWNER A`: `HTTP 200`, hiển thị Sân A1, A2, A3; hoàn toàn không có Sân B1.<br>- Query chèn `facilityId` của B: vẫn hiển thị Cơ sở A, không đổi phạm vi.<br>- `OWNER B`: `HTTP 200`, chỉ thấy Cơ sở B và Sân B1. | **ĐẠT (PASS)** |
| **TC-02** | **Cấu hình giờ phục vụ khác biệt & sân Inactive**<br>1. Kiểm tra trục giờ trên trang lịch cơ sở A (có Sân A1 mở 06:00–10:00 và Sân A2 mở 17:00–22:00).<br>2. Kiểm tra ô ngoài giờ của từng sân.<br>3. Kiểm tra nhãn và trạng thái các ô của Sân A3 (`active: false`). | - Trục giờ là hợp các khoảng phục vụ (có cả 06:00 sáng và 21:30 tối), không bị hardcode cố định.<br>- Ô ngoài giờ của sân hiển thị `Không phục vụ` (`UNAVAILABLE`).<br>- Sân inactive có nhãn `Tạm ngừng`, toàn bộ ô là `Không phục vụ`.<br>- Không tự phát sinh trạng thái bảo trì. | - `HTTP 200`.<br>- Trục giờ hiển thị đầy đủ từ 06:00 đến 22:00 theo đúng các khoảng mở cửa.<br>- Ô ngoài giờ của Sân A1 (buổi chiều/tối) và Sân A2 (buổi sáng) đều có nhãn `Không phục vụ` (`—`).<br>- Sân A3 có huy hiệu `Tạm ngừng` (`owner-calendar-inactive`), toàn bộ ô là `—`.<br>- Không có chữ hoặc nhãn `Bảo trì`. | **ĐẠT (PASS)** |
| **TC-03** | **Luồng tạo đơn thật & cập nhật trạng thái**<br>1. Xác nhận ô 07:00–07:30 ngày tương lai ban đầu là `Trống`.<br>2. Khách vãng lai gửi `POST /bookings` giữ ô 07:00–07:30.<br>3. Chủ sân tải lại `/owner/calendar`.<br>4. Khách thực hiện thanh toán mô phỏng `POST /bookings/:id/demo-payment`.<br>5. Chủ sân tải lại `/owner/calendar`. | - Ban đầu ô là `Trống` (`AVAILABLE`, ký hiệu `○`).<br>- Sau khi tạo đơn giữ chỗ: ô chuyển thành `Đang giữ` (`LOCKED`, ký hiệu `◷`).<br>- Sau khi thanh toán mô phỏng thành công: ô chuyển thành `Đã đặt` (`BOOKED`, ký hiệu `✓`). | - Trạng thái ban đầu: `Trống`.<br>- Tạo HOLD thành công (`HTTP 303` chuyển hướng checkout).<br>- Tải lại lịch: ô 07:00–07:30 hiển thị `Đang giữ` (`◷`).<br>- Thanh toán mô phỏng thành công (`HTTP 303`).<br>- Tải lại lịch: ô 07:00–07:30 hiển thị `Đã đặt` (`✓`). | **ĐẠT (PASS)** |
| **TC-04** | **HOLD hết hạn & Bảo toàn đơn đã xác nhận**<br>1. Tạo đơn HOLD thứ hai tại ô 07:30–08:00.<br>2. Giả lập hết hạn bằng cách lùi hạn giữ chỗ trong database thử.<br>3. Chủ sân tải lại `/owner/calendar`.<br>4. Kiểm tra lại ô 07:00–07:30 đã đặt ở TC-03. | - Ô HOLD hết hạn được giải phóng và mở lại thành `Trống` (`AVAILABLE`) cho ngày tương lai.<br>- Đơn và lock đã xác nhận (`CONFIRMED`) ở TC-03 giữ nguyên, không bị ảnh hưởng. | - `HTTP 200`.<br>- Ô 07:30–08:00 (hết hạn HOLD) được hiển thị lại là `Trống`.<br>- Ô 07:00–07:30 đã xác nhận vẫn giữ nguyên trạng thái `Đã đặt`. | **ĐẠT (PASS)** |
| **TC-05** | **Ngày mặc định & Kiểm tra tính hợp lệ của ngày**<br>1. GET `/owner/calendar` không truyền query `date`.<br>2. Kiểm tra thanh điều hướng 7 ngày.<br>3. GET với ngày quá khứ (`2020-01-01`).<br>4. GET với ngày sai định dạng (`01-01-2030`).<br>5. GET với ngày không tồn tại (`2030-02-30`).<br>6. GET với tham số lặp (`?date=...&date=...`). | - Mặc định hiển thị ngày hôm nay theo giờ Việt Nam (`Asia/Ho_Chi_Minh`).<br>- Có đủ 7 tùy chọn ngày từ hôm nay đến hôm nay+6.<br>- Mọi trường hợp ngày quá khứ, sai format, không tồn tại hoặc lặp tham số đều trả **HTTP 400**, không lỗi 500, không lộ dữ liệu. | - GET không tham số: `HTTP 200`, `selectedDate` tự nhận ngày Việt Nam (`2026-10-25`).<br>- Đủ 7 phần tử navigation `owner-calendar-day`.<br>- Ngày quá khứ: `HTTP 400` ("Ngày xem lịch không được trong quá khứ.").<br>- Sai định dạng: `HTTP 400` ("Ngày không hợp lệ.").<br>- Ngày 2030-02-30: `HTTP 400` ("Ngày không tồn tại.").<br>- Tham số lặp: `HTTP 400` ("Tham số ngày không được lặp lại."). | **ĐẠT (PASS)** |
| **TC-06** | **Bố cục giao diện, XSS escape & Cơ sở chưa có sân**<br>1. Kiểm tra HTML render của cơ sở A có tên/địa chỉ chứa thẻ `<script>` và chuỗi dài.<br>2. Kiểm tra container cuộn ngang và hỗ trợ trợ năng bàn phím.<br>3. Đăng nhập Chủ cơ sở rỗng (chưa có sân) và xem lịch. | - Chuỗi chứa script/HTML được escape hoàn toàn (`&lt;script&gt;...`), không có mã thực thi thô.<br>- Bảng lịch nằm trong vùng cuộn `owner-calendar-scroll` có `role="region"`, `aria-label`, `tabindex="0"`, không làm tràn trang.<br>- Cơ sở chưa có sân render `HTTP 200` với thông báo "Cơ sở chưa có sân." rõ ràng. | - Không có script thô trong HTML; payload được escape an toàn.<br>- Tên dài và địa chỉ dài được hiển thị đầy đủ, không gây vỡ DOM.<br>- Có container cuộn ngang riêng biệt với hướng dẫn trợ năng rõ ràng.<br>- Cơ sở chưa có sân: `HTTP 200`, hiển thị hộp thông báo rỗng kèm nút quay về quản lý cơ sở. | **ĐẠT (PASS)** |
| **TC-07** | **Tính Read-Only (Không làm biến đổi dữ liệu)**<br>1. Lấy snapshot số lượng và SHA-256 hash của toàn bộ collections trước khi kiểm thử.<br>2. Thực hiện liên tục nhiều lượt GET `/owner/calendar` (cả request thành công và request lỗi).<br>3. Lấy snapshot sau khi thực hiện và so sánh. | Số lượng bản ghi và SHA-256 hash của `Booking`, `SlotLock`, `Payment`, `BookingRequest`, `Court`, `Facility`, `User` không thay đổi 1 byte nào. | - `countsMatch: true` (Số lượng bản ghi trước và sau hoàn toàn trùng khớp).<br>- `hashesMatch: true` (Mã băm SHA-256 của các collection nghiệp vụ trước và sau không đổi). | **ĐẠT (PASS)** |

---

## 4. Kết quả kiểm tra công cụ tự động & Lint

1. **`npm run check`**:
   - ESLint: **0 errors, 0 warnings**.
   - Cú pháp EJS: **18/18 template EJS biên dịch thành công**.
2. **`npm test`**:
   - Toàn bộ test suite của dự án: **134/134 test passed (100%)**, thời gian thực thi: **12.89s**.
   - Không có test bị bỏ qua (skipped) hoặc thất bại (failed).

---

## 5. Kết luận & Đề xuất bàn giao

- Chức năng **Lịch điều hành toàn bộ sân** (Backend #62) và **Giao diện bảng lịch** (UI #63) tích hợp mượt mà, phân quyền tuyệt đối chuẩn xác theo cơ sở của chủ sân đăng nhập.
- Không tồn tại lỗ hổng bảo mật về IDOR/chuyển đổi cơ sở trái phép qua query.
- Giao diện có thiết kế cuộn riêng biệt thân thiện với mobile/desktop, hỗ trợ trợ năng và escape dữ liệu độc hại.
- Đạt toàn bộ các tiêu chí nghiệm thu của Issue #66. Kính chuyển Nhóm trưởng xem xét merge PR #68 và hoàn thiện Issue #63 / #66.
