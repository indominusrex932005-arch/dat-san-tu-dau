# Checklist và Báo cáo kiểm thử giao diện

Tài liệu này ghi nhận kế hoạch, checklist các trường hợp kiểm thử (Test Cases) và kết quả kiểm tra giao diện cho **Trang chủ** (`/`) và **Danh sách cơ sở** (`/facilities`) của dự án **Sân Thể Thao** (`dat-san-tu-dau`).

---

## 1. Thông tin môi trường kiểm thử

- **Người thực hiện:** Đội ngũ QA / Thành viên dự án
- **Ngày lập checklist:** 22/10/2026 (Cập nhật: 23/10/2026)
- **Trình duyệt kiểm thử:** Google Chrome 130.x, Microsoft Edge 130.x
- **Độ phân giải màn hình kiểm tra:**
  - Máy tính (Desktop): **1366 × 900 px**
  - Điện thoại (Mobile): **390 × 844 px** (mô phỏng theo kích thước iPhone tiêu chuẩn)
- **Công cụ hỗ trợ:** Chrome DevTools (Device Mode, Toggle device toolbar), phím Tab bàn phím
- **Phiên bản mã nguồn kiểm tra:**
  - Nhánh gốc: `main` tại commit `546e6b1`
  - Các nhánh giao diện đối chiếu: `feat/ui-home` (commit `826095a` trong PR #4) và `feat/ui-facilities` (commit `2b297d9` trong PR #5)
- **Nguồn dữ liệu kiểm thử:** Sử dụng dữ liệu giả lập nội bộ (in-memory mock và lệnh `ejs.renderFile`), chưa kết nối dữ liệu MongoDB Atlas thực tế trong lần kiểm thử này.

---

## 2. Bảng checklist các kịch bản kiểm thử (Test Cases)

### Quy ước trạng thái:
- **ĐẠT**: Thao tác đã chạy thực tế trên bản code hiện tại và hoạt động đúng mong đợi.
- **CHƯA ĐẠT**: Có lỗi phát sinh (sai layout, tràn màn hình, lỗi link, v.v.).
- **CHỜ KIỂM TRA**: Kịch bản đã sẵn sàng, chờ merge PR #4 và PR #5 vào `main` để kiểm thử chính thức trên code hợp nhất.

| Mã KT | Trang | Thao tác kiểm tra | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-01** | `/` | Mở trang chủ trên trình duyệt | Trang chủ tải thành công (HTTP 200), hiển thị đúng tiêu đề "Hệ thống quản lý đặt sân thể thao", phần giới thiệu và nút điều hướng. | Đã xác nhận trên server Express nội bộ tại commit `546e6b1`. | **ĐẠT** |
| **TC-02** | `/facilities` | Mở trang danh sách cơ sở | Trang danh sách cơ sở tải thành công (HTTP 200), hiển thị tiêu đề "Danh sách cơ sở". | Đã xác nhận trên server Express nội bộ tại commit `546e6b1`. | **ĐẠT** |
| **TC-03** | `/` | Bấm nút "Xem cơ sở" hoặc liên kết "Cơ sở" trên thanh điều hướng | Chuyển hướng chính xác đến đường dẫn `/facilities`. | Nút thuộc PR #4 (commit `826095a`); chờ kiểm thử liên kết thực tế trên `main` sau khi merge. | **CHỜ KIỂM TRA** *(Chờ merge PR #4)* |
| **TC-04** | `/facilities` | Bấm liên kết "Trang chủ" hoặc logo | Chuyển hướng chính xác về đường dẫn `/`. | Liên kết thuộc PR #5 (commit `2b297d9`); chờ kiểm thử liên kết thực tế trên `main` sau khi merge. | **CHỜ KIỂM TRA** *(Chờ merge PR #5)* |
| **TC-05** | `/` | Thu nhỏ chiều rộng trình duyệt về **390px** (Mobile) | Nội dung thích ứng dạng cột dọc, không xuất hiện thanh cuộn ngang, nút bấm và chữ không bị tràn hay che khuất. | Đang chờ merge PR #4 vào `main` để kiểm thử bản tích hợp cuối cùng. | **CHỜ KIỂM TRA** *(Chờ merge PR #4)* |
| **TC-06** | `/` | Mở ở độ phân giải **1366px** (Desktop) | Bố cục căn giữa trang nhã, không lệch lề, hình ảnh/SVG và khoảng cách lề (padding, margin) hiển thị cân đối. | Đang chờ merge PR #4 vào `main`. | **CHỜ KIỂM TRA** *(Chờ merge PR #4)* |
| **TC-07** | `/facilities` | Thu nhỏ chiều rộng về **390px** (Mobile) | Danh sách cơ sở tự động xếp thành 1 cột duy nhất, không cuộn ngang, các thẻ cách nhau đều đặn. | Đang chờ merge PR #5 vào `main`. | **CHỜ KIỂM TRA** *(Chờ merge PR #5)* |
| **TC-08** | `/facilities` | Mở ở độ phân giải **1366px** (Desktop) | Danh sách cơ sở hiển thị dạng lưới nhiều cột (grid layout), thẻ hiển thị đầy đủ thông tin. | Đang chờ merge PR #5 vào `main`. | **CHỜ KIỂM TRA** *(Chờ merge PR #5)* |
| **TC-09** | `/` & `/facilities` | Sử dụng phím **Tab** trên bàn phím để di chuyển qua các nút/link | Vị trí đang được chọn (focus) có viền hiển thị rõ ràng (focus ring), hỗ trợ tốt cho người dùng chỉ dùng bàn phím. | Đã quy định trong PR #4 và PR #5; chờ kiểm tra trên `main` sau merge. | **CHỜ KIỂM TRA** *(Chờ merge PR)* |
| **TC-10** | `/facilities` | Kiểm tra với cơ sở **thiếu số điện thoại** (`phone` rỗng hoặc null) | Thẻ cơ sở chỉ hiển thị tên và địa chỉ, không xuất hiện dòng chữ trống hoặc chữ "undefined". | Đang chờ dữ liệu mẫu từ nhóm trưởng. | **CHỜ KIỂM TRA** *(Chờ dữ liệu)* |
| **TC-11** | `/facilities` | Kiểm tra trạng thái **danh sách rỗng** (`facilities = []`) | Hiển thị thông báo thân thiện: "Chưa có cơ sở nào." kèm liên kết về trang chủ, không gây crash ứng dụng. | Đã chạy lệnh `ejs.renderFile` độc lập tại commit `546e6b1`; template render đúng HTML thông báo rỗng. | **ĐẠT** |
| **TC-12** | `/facilities` | Kiểm tra tên hoặc địa chỉ cơ sở **rất dài** (chuỗi ký tự liên tục) | Chữ tự động xuống dòng (`word-break` / `overflow-wrap`), không làm biến dạng hoặc vỡ chiều rộng của thẻ card. | Đang chờ dữ liệu mẫu từ nhóm trưởng. | **CHỜ KIỂM TRA** *(Chờ dữ liệu)* |
| **TC-13** | `/facilities` | Kiểm tra an toàn dữ liệu (XSS Prevention) | Dữ liệu chứa thẻ HTML (`<script>`, `<img onerror>`) phải được escape an toàn thông qua cú pháp `<%= %>`. | Đã kiểm tra qua template EJS, toàn bộ biến đều dùng cú pháp `<%= %>`. | **ĐẠT** |
| **TC-14** | `/` & `/facilities` | Đối chiếu nhận diện thương hiệu và màu sắc giữa 2 trang | Tên website thống nhất là **"Sân Thể Thao"**, tông màu chủ đạo đồng nhất: xanh đậm `#173f35`, nền sáng `#f7f8f2`. | Đã đối chiếu mã nguồn giữa commit `826095a` (PR #4) và commit `2b297d9` (PR #5); chờ xác nhận hiển thị đồng bộ trên `main` sau merge. | **CHỜ KIỂM TRA** *(Chờ merge PR #4, #5)* |

---

## 3. Hướng dẫn chạy thử nghiệm độc lập trên máy

### 3.1. Kiểm tra trạng thái danh sách rỗng (Không cần Atlas)
Chạy lệnh sau tại thư mục `dat-san-tu-dau` để kiểm tra render template khi không có dữ liệu:
```powershell
node --input-type=module -e "import ejs from 'ejs'; const html = await ejs.renderFile('views/facilities.ejs', { facilities: [] }); console.log(html.includes('Chưa có cơ sở nào.') ? '>> Render danh sách rỗng: ĐẠT' : '>> THẤT BẠI');"
```

### 3.2. Kiểm tra chất lượng mã nguồn
```bash
npm run lint
```

---

## 4. Kế hoạch hoàn tất sau khi Merge PR #4 và #5

Ngay sau khi nhóm trưởng duyệt và merge PR #4 (`feat/ui-home`) và PR #5 (`feat/ui-facilities`):
1. QA sẽ kéo nhánh `main` mới nhất về máy:
   ```bash
   git switch main
   git pull --ff-only origin main
   ```
2. Khởi động server thật và chụp ảnh màn hình ở 2 kích thước (1366px và 390px) lưu vào thư mục `docs/kiem-thu-giao-dien/`.
3. Cập nhật ĐẠT/CHƯA ĐẠT theo kết quả thực tế, kèm ảnh minh chứng.
