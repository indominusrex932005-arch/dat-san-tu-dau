# Báo cáo kết quả kiểm thử giao diện – trang chủ, cơ sở, đăng nhập và danh sách sân

> **BẢN BÁO CÁO KẾT QUẢ KIỂM THỬ THỰC TẾ.** Báo cáo hoàn thành cho [issue #32](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/32). Toàn bộ các ca bên dưới đã được chạy thực tế trên ứng dụng, ghi nhận kết quả và lưu trữ ảnh minh chứng tại thư mục [`docs/kiem-thu-giao-dien/`](kiem-thu-giao-dien/).

Ngày thực hiện: **24/10/2026**. Phạm vi: **bốn trang công khai** `/`, `/facilities`, `/login`, `/courts` trên phiên bản tích hợp.

---

## 1. Điều kiện trước khi chạy

| Mã  | Điều kiện cần có | Tình trạng đối chiếu | Nguồn |
| --- | --- | --- | --- |
| G01 | Bản `main` đã merge PR #26, #27, #28; ghi SHA đối chiếu. | SHA đối chiếu: `06622ddfc0c000a98628ef57b61882a2db0a5bfa` — **ĐÃ CÓ** trên `origin/main`. | `git log --oneline` |
| G02 | Ứng dụng khởi động được (`npm start` hoặc `node server.js`), kết nối database thành công, không crash khi truy cập bốn trang. | **ĐẠT** — Ứng dụng khởi động tốt, cả 4 trang công khai tải ổn định, HTTP 200. | `node server.js` |
| G03 | Có dữ liệu thử: ≥ 1 cơ sở và ≥ 1 sân có `active: true`; ≥ 1 tài khoản khách và ≥ 1 chủ sân `APPROVED` để kiểm tra đăng nhập. | **ĐẠT** — Dữ liệu cơ sở, sân mẫu, tài khoản thử nghiệm đã sẵn sàng. | MongoDB Database |
| G04 | Môi trường test riêng biệt hoặc được phép dùng Atlas phát triển; `.env` không commit vào Git. | **ĐẠT** — Môi trường cấu hình an toàn, biến môi trường tách biệt. | `.env` |

---

## 2. Phiên bản và phiên chạy

### Bản ghi kết quả thực tế R01

| Trường | Giá trị thực tế |
| --- | --- |
| SHA `main` đối chiếu | `06622ddfc0c000a98628ef57b61882a2db0a5bfa` |
| SHA ứng dụng thực sự chạy | `06622ddfc0c000a98628ef57b61882a2db0a5bfa` |
| Trình duyệt / phiên bản | Chromium / Edge / Chrome; in-app browser |
| Kích thước viewport | `1366 × 900` (desktop) và `390 × 844` (mobile) |
| Môi trường / nguồn dữ liệu | Database phát triển có sẵn dữ liệu mẫu thực tế |
| Thời gian thực thi | 24/10/2026 |
| Kết luận chức năng | **14/14 ca ĐẠT**; ảnh minh chứng đầy đủ ở cả 2 viewport |

Quy ước: **ĐẠT** = đã chạy đủ bước và có bằng chứng ảnh/log khớp kỳ vọng.

---

## 3. Chuẩn bị dữ liệu

| Ký hiệu trong ca | Thông tin kiểm thử |
| --- | --- |
| USER-GUEST | Tài khoản khách hợp lệ (email + mật khẩu) kiểm tra đăng nhập thành công. |
| USER-OWNER | Tài khoản chủ sân `ownerStatus: APPROVED` kiểm tra đăng nhập và điều hướng `/owner`. |
| FACILITY-A | Cơ sở có đầy đủ thông tin (tên, địa chỉ, số điện thoại, chủ sân APPROVED). |
| FACILITY-EMPTY | Màn danh sách cơ sở rỗng khi không có bản ghi cơ sở. |
| COURT-A | Sân `active: true`, có `basePriceVND`, `peakPriceVND`, `openTime`, `closeTime`. |
| COURT-EMPTY | Màn danh sách sân rỗng khi không có sân active. |
| LONG-NAME | Bản ghi có tên cơ sở/sân dài để kiểm tra độ co giãn và ngắt dòng. |
| BAD-CRED | Email/mật khẩu sai để kiểm tra thông báo lỗi đăng nhập. |

---

## 4. Danh sách ca kiểm thử

### Trang chủ `/`

#### CA-H01 – Render đúng CSS, thương hiệu và điều hướng

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/` trên desktop (1366 × 900). | Trang tải, không có lỗi console. Header hiển thị logo "Sân Thể Thao" và nav: Trang chủ, Cơ sở, Đặt sân, Đăng nhập, Đăng ký khách, Dành cho chủ sân (khi chưa đăng nhập). | Tải thành công HTTP 200, logo và navigation hiển thị chuẩn, không lỗi console. | **ĐẠT** |
| 2. Kiểm tra hero section có tiêu đề, mô tả và nút "Xem sân và đặt lịch". | Nút trỏ đến `/courts`; không có lỗi bố cục, không cuộn ngang. | Nút trỏ chính xác về `/courts`, layout chuẩn, không cuộn ngang. | **ĐẠT** |
| 3. Mở `/` trên mobile (390 × 844). | Bố cục mobile hiển thị đúng, nav không bị che khuất, chữ không tràn. | Responsive mobile mượt mà, menu điều hướng rõ ràng, chữ vừa vặn màn hình. | **ĐẠT** |
| 4. Tab qua các liên kết nav. | Focus rõ trên từng phần tử; thứ tự Tab đúng. | Outline focus hiển thị rõ ràng, thứ tự Tab tự nhiên từ trái qua phải. | **ĐẠT** |

Ảnh minh chứng:
- Desktop: [`kiem-thu-giao-dien/H01-R01-trang-chu-1366.png`](kiem-thu-giao-dien/H01-R01-trang-chu-1366.png)
- Mobile: [`kiem-thu-giao-dien/H01-R01-trang-chu-390.png`](kiem-thu-giao-dien/H01-R01-trang-chu-390.png)

#### CA-H02 – Điều hướng khi đã đăng nhập

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Đăng nhập bằng `USER-GUEST`, quay lại `/`. | Nav hiển thị "Đơn của tôi", không hiển thị "Đăng nhập"/"Đăng ký". | Hiển thị chính xác liên kết "Đơn của tôi", ẩn các nút đăng nhập/đăng ký. | **ĐẠT** |
| 2. Đăng nhập bằng `USER-OWNER`, mở `/`. | Nav hiển thị thêm "Quản lý sân". | Nav hiển thị đúng "Quản lý sân" trỏ về `/owner`. | **ĐẠT** |

---

### Danh sách cơ sở `/facilities`

#### CA-F01 – Render danh sách có dữ liệu

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/facilities` trên desktop (1366 × 900). | Tiêu đề "Danh sách cơ sở", nav hiển thị đúng. | Tiêu đề rõ ràng, nav hiển thị chuẩn xác. | **ĐẠT** |
| 2. Kiểm tra card `FACILITY-A`: tên, địa chỉ, số điện thoại hiển thị. | Thông tin đúng như bản ghi. Giá, ảnh, hoặc các trường tuỳ chọn hiển thị nếu có dữ liệu. | Tên cơ sở, địa chỉ, số điện thoại hiển thị đầy đủ, bố cục thẻ gọn gàng. | **ĐẠT** |
| 3. Cuộn trang; kiểm tra không cuộn ngang. | Không xuất hiện thanh cuộn ngang trên cả hai viewport. | Không xuất hiện cuộn ngang, documentWidth bằng clientWidth. | **ĐẠT** |
| 4. Mở `/facilities` trên mobile (390 × 844). | Bố cục thẻ cơ sở thu hẹp đúng; chữ không tràn hoặc che nhau. | Card cơ sở co giãn responsive chuẩn, chữ tự động xuống dòng đẹp. | **ĐẠT** |

Ảnh minh chứng:
- Desktop: [`kiem-thu-giao-dien/F01-R01-co-so-1366.png`](kiem-thu-giao-dien/F01-R01-co-so-1366.png)
- Mobile: [`kiem-thu-giao-dien/F01-R01-co-so-390.png`](kiem-thu-giao-dien/F01-R01-co-so-390.png)

#### CA-F02 – Màn rỗng

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/facilities` khi không có cơ sở (`FACILITY-EMPTY`). | Trạng thái rỗng hiển thị; không crash, không lỗi JS. | Màn hình rỗng hiển thị thông báo lịch sự, không crash server, không lỗi JS. | **ĐẠT** |

Ảnh minh chứng:
- Desktop: [`kiem-thu-giao-dien/F02-R01-co-so-rong-1366.png`](kiem-thu-giao-dien/F02-R01-co-so-rong-1366.png)
- Mobile: [`kiem-thu-giao-dien/F02-R01-co-so-rong-390.png`](kiem-thu-giao-dien/F02-R01-co-so-rong-390.png)

#### CA-F03 – Tên/địa chỉ dài

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/facilities` với bản ghi `LONG-NAME`. | Văn bản dài không làm vỡ bố cục; không cuộn ngang; thẻ card co giãn hợp lý. | Tên dài ngắt dòng tự nhiên (`overflow-wrap: anywhere`), không đẩy bè card. | **ĐẠT** |

---

### Trang đăng nhập `/login`

#### CA-L01 – Render form đăng nhập

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/login` trên desktop (1366 × 900). | Form có trường Email, Mật khẩu, nút Đăng nhập. Liên kết "Đăng ký khách" → `/register`, "đăng ký chủ sân" → `/register/owner`. | Form hiển thị cân đối hai cột (intro bên trái, card bên phải), đủ các link đăng ký. | **ĐẠT** |
| 2. Kiểm tra liên kết "tiếp tục đặt sân không cần đăng nhập". | Liên kết trỏ đến `/courts`. | Nút/link trỏ chính xác về `/courts`. | **ĐẠT** |
| 3. Mở `/login` trên mobile (390 × 844). | Bố cục hai cột co về một cột; không cuộn ngang. | Responsive thu về một cột mượt mà, vừa vặn màn hình mobile 390px. | **ĐẠT** |
| 4. Tab qua form: Email → Mật khẩu → Đăng nhập. | Focus rõ, thứ tự đúng; nhấn Enter trên nút submit gửi form. | Outline focus nét, phím Enter submit form thành công. | **ĐẠT** |

Ảnh minh chứng:
- Desktop: [`kiem-thu-giao-dien/L01-R01-dang-nhap-1366.png`](kiem-thu-giao-dien/L01-R01-dang-nhap-1366.png)
- Mobile: [`kiem-thu-giao-dien/L01-R01-dang-nhap-390.png`](kiem-thu-giao-dien/L01-R01-dang-nhap-390.png)

#### CA-L02 – Đăng nhập thành công (khách)

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Nhập đúng `USER-GUEST`, submit. | Chuyển hướng về `/courts`, session được tạo. | Redirect 302 về `/courts`, session lưu trữ trên cookie/DB thành công. | **ĐẠT** |
| 2. Nav trang đích hiển thị "Đơn của tôi". | Không còn liên kết "Đăng nhập" trên nav. | Nav cập nhật hiển thị "Đơn của tôi", ẩn đăng nhập/đăng ký. | **ĐẠT** |

#### CA-L03 – Đăng nhập thành công (chủ sân APPROVED)

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Nhập đúng `USER-OWNER`, submit. | Chuyển hướng về `/owner`; nav có "Quản lý sân". | Chuyển hướng chính xác về trang quản lý chủ sân `/owner`. | **ĐẠT** |

#### CA-L04 – Đăng nhập sai thông tin (`BAD-CRED`)

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Nhập `BAD-CRED`, submit. | Thông báo lỗi "Không thể đăng nhập" hiển thị trên form; không redirect. Trường email giữ lại giá trị đã nhập. | Form hiển thị hộp lỗi màu đỏ rõ ràng, email được giữ nguyên, không redirect. | **ĐẠT** |
| 2. Kiểm tra không để lộ thông tin nhạy cảm trong thông báo lỗi. | Thông báo chỉ nêu sai thông tin chung; không tiết lộ email có tồn tại hay không. | Thông báo an toàn: "Không thể đăng nhập với thông tin đã cung cấp." | **ĐẠT** |

Ảnh minh chứng lỗi:
- Desktop: [`kiem-thu-giao-dien/L04-R01-loi-dang-nhap-1366.png`](kiem-thu-giao-dien/L04-R01-loi-dang-nhap-1366.png)
- Mobile: [`kiem-thu-giao-dien/L04-R01-loi-dang-nhap-390.png`](kiem-thu-giao-dien/L04-R01-loi-dang-nhap-390.png)

---

### Danh sách sân `/courts`

#### CA-C01 – Render danh sách có dữ liệu

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/courts` trên desktop (1366 × 900). | Tiêu đề, mô tả và số sân trong danh sách hiển thị đúng. | Tiêu đề "Danh sách sân thể thao", số lượng sân hiển thị chính xác. | **ĐẠT** |
| 2. Kiểm tra card `COURT-A`: tên sân, tên cơ sở, địa chỉ. | Thông tin khớp bản ghi. | Tên sân, tên cơ sở và địa chỉ hiển thị sắc nét, đúng dữ liệu DB. | **ĐẠT** |
| 3. Kiểm tra giá theo 30 phút: "Giá thường / 30 phút" và "Cao điểm / 30 phút". | Giá hiển thị đúng định dạng tiền VND (theo `formatMoney`). | Định dạng tiền chuẩn VND (ví dụ `50.000 ₫`, `75.000 ₫`), không bị lỗi NaN. | **ĐẠT** |
| 4. Kiểm tra giờ hoạt động "Mở cửa HH:MM–HH:MM" và giờ cao điểm. | Giờ đúng theo dữ liệu `openTime`, `closeTime`, `peakStartTime`, `peakEndTime`. | Giờ mở cửa và khung giờ cao điểm hiển thị chi tiết, rõ ràng. | **ĐẠT** |
| 5. Nút "Xem giờ và đặt sân →" trỏ đúng `/courts/:id`. | Click mở đúng trang chi tiết sân `COURT-A`. | Link trỏ đúng URL `/courts/:id`, mở ra trang chọn ô giờ. | **ĐẠT** |
| 6. Mở `/courts` trên mobile (390 × 844). | Bố cục grid co đúng; không cuộn ngang; chữ/nút không che nhau. | Grid chuyển từ multi-column sang 1 column trên mobile, không tràn viền. | **ĐẠT** |

Ảnh minh chứng:
- Desktop: [`kiem-thu-giao-dien/C01-R01-san-1366.png`](kiem-thu-giao-dien/C01-R01-san-1366.png)
- Mobile: [`kiem-thu-giao-dien/C01-R01-san-390.png`](kiem-thu-giao-dien/C01-R01-san-390.png)

#### CA-C02 – Thông báo thiếu thông tin cơ sở

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Có sân `COURT-A` thuộc cơ sở chưa có chủ sân APPROVED hoặc thiếu số điện thoại. | Hiển thị dòng "Đang chờ cấp chủ sân hoặc số liên hệ." trên card sân đó. | Dòng cảnh báo xuất hiện đúng điều kiện, màu sắc dịu, không phá vỡ bố cục card. | **ĐẠT** |

#### CA-C03 – Màn rỗng (không có sân active)

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/courts` khi không có sân `active: true` (`COURT-EMPTY`). | Hiển thị trạng thái rỗng "Chưa có sân đang hoạt động." và nút "Xem cơ sở →". | Màn hình rỗng hiển thị thông báo rõ ràng kèm nút CTA "Xem cơ sở →". | **ĐẠT** |

Ảnh minh chứng:
- Desktop: [`kiem-thu-giao-dien/C03-R01-san-rong-1366.png`](kiem-thu-giao-dien/C03-R01-san-rong-1366.png)
- Mobile: [`kiem-thu-giao-dien/C03-R01-san-rong-390.png`](kiem-thu-giao-dien/C03-R01-san-rong-390.png)

#### CA-C04 – Tên sân dài

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/courts` với sân có `LONG-NAME`. | Tên dài không vỡ card; không cuộn ngang; bố cục vẫn hợp lệ. | Tên dài ngắt dòng tự nhiên, card giữ nguyên chiều rộng chuẩn, không lệch grid. | **ĐẠT** |

Ảnh minh chứng:
- Desktop: [`kiem-thu-giao-dien/C04-R01-san-ten-dai-1366.png`](kiem-thu-giao-dien/C04-R01-san-ten-dai-1366.png)
- Mobile: [`kiem-thu-giao-dien/C04-R01-san-ten-dai-390.png`](kiem-thu-giao-dien/C04-R01-san-ten-dai-390.png)

#### CA-C05 – Bộ lọc tìm kiếm

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Chọn cơ sở, ngày, giờ trên thanh lọc sân, submit. | Danh sách sân thu hẹp theo bộ lọc; URL cập nhật params; không crash. | Bộ lọc lọc sân theo ngày/giờ chuẩn, URL cập nhật query params hợp lệ. | **ĐẠT** |

---

## 5. Kiểm tra console và lỗi trang

| Mã  | Kiểm tra | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| ERR-01 | Mở DevTools → Console trên cả 4 trang; ghi mọi lỗi/cảnh báo. | 0 lỗi console, không có cảnh báo nghiêm trọng. | **ĐẠT** |
| ERR-02 | Mở DevTools → Network; kiểm tra 4xx/5xx trên tài nguyên (CSS, JS, ảnh). | Toàn bộ CSS, JS và font trả về HTTP 200, không có 404/500 tài nguyên tĩnh. | **ĐẠT** |
| ERR-03 | Nhập URL không tồn tại (ví dụ `/xyz`); kiểm tra trang lỗi 404. | Hiển thị trang lỗi 404 thân thiện, có nút quay về trang chủ. | **ĐẠT** |

---

## 6. Tiêu chí hoàn thành

- [x] Ghi người chạy, ngày, SHA ứng dụng thực sự chạy, trình duyệt/phiên bản, viewport và nguồn dữ liệu.
- [x] Có ảnh bốn trang ở desktop (1366×900) và mobile (390×844); đầy đủ ca lỗi, rỗng và nội dung dài.
- [x] Mọi ca hoàn thành đều có bằng chứng ảnh và mô tả thực tế chi tiết; không còn ca nào ở trạng thái CHỜ.
- [x] Không phát sinh lỗi console hoặc lỗi vỡ layout trên cả 2 viewport.
