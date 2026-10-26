# Kiểm thử giao diện – trang chủ, cơ sở, đăng nhập và danh sách sân

> **PHIÊN BẢN CHUẨN BỊ TÀI LIỆU – CHƯA CHẠY.** Tài liệu cho [issue #32](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/32). Tất cả ca bên dưới đang **CHỜ**; không coi việc soạn ca hoặc đọc code là kết quả kiểm thử.
>
> Thay thế checklist cũ của issue #7 (PR #12 đã đóng). Nếu tham khảo nội dung PR #12 thì phải chạy lại và ghi kết quả theo SHA mới; không merge nguyên kết quả cũ.

Ngày đối chiếu: **23/10/2026**. Phạm vi: **bốn trang công khai** `/`, `/facilities`, `/login`, `/courts` trên bản tích hợp PR #26/#27/#28. Không sửa source/CI/package.

---

## 1. Điều kiện trước khi chạy

| Mã  | Điều kiện cần có | Tình trạng đối chiếu | Nguồn |
| --- | --- | --- | --- |
| G01 | Bản `main` đã merge PR #26, #27, #28; ghi SHA đối chiếu. | SHA đối chiếu: `7d612bc00ba0fbda8efab3ba0c02ddf0ab73ee69` — **ĐÃ CÓ** trên `origin/main`. | `git log --oneline` |
| G02 | Ứng dụng khởi động được (`npm start` hoặc `node server.js`), kết nối Atlas thành công, không crash khi truy cập bốn trang. | **CHỜ** — chưa chạy phiên kiểm thử. | Nhóm trưởng xác nhận môi trường. |
| G03 | Có dữ liệu thử: ≥ 1 cơ sở và ≥ 1 sân có `active: true`; ≥ 1 tài khoản khách và ≥ 1 chủ sân `APPROVED` để kiểm tra đăng nhập. | **CHỜ** — chưa được bàn giao. | Nhóm trưởng cung cấp/xác nhận; không xóa dữ liệu Atlas chung để tạo màn rỗng. |
| G04 | Môi trường test riêng biệt hoặc được phép dùng Atlas phát triển; `.env` không commit vào Git. | **CHỜ** — chưa xác nhận. | Nhóm trưởng. |

**Dừng trước khi chạy nếu còn thiếu G01–G04.** Việc render EJS qua fixture hoặc lint đạt không thay cho ca end-to-end với DB thật.

---

## 2. Phiên bản và phiên chạy

### Bản đối chiếu R00 – chỉ chuẩn bị tài liệu

| Trường | Giá trị hiện tại |
| --- | --- |
| SHA `main` đối chiếu | `7d612bc00ba0fbda8efab3ba0c02ddf0ab73ee69` |
| SHA ứng dụng thực sự chạy | **Chưa có – chưa chạy** |
| Trình duyệt / phiên bản | **Chưa dùng trình duyệt để chạy ca** |
| Kích thước viewport | `390 × 844` và `1366 × 900` CSS px; khi chạy ghi kích thước thực tế |
| Môi trường / nguồn dữ liệu | **Chưa được bàn giao cho đợt thử**; không kết nối Atlas; không dùng dữ liệu giả lập để thay kết quả lưu thật |
| Bản ghi / thời gian thực thi | **Chưa có** |
| Kết luận chức năng | **0 ca đã chạy; tất cả ca đang CHỜ** |

Mỗi ca dưới đây tham chiếu **R00** cho SHA, trình duyệt và nguồn dữ liệu hiện tại. Khi bắt đầu thực thi, tạo bản ghi R01/R02… theo mẫu ghi kết quả ở cuối tài liệu, điền SHA chạy thật, trình duyệt/phiên bản, viewport, nguồn dữ liệu, kết quả thực tế và ảnh cho **từng biến thể**. Không thay các ô "chưa chạy" bằng kết quả dự đoán.

Quy ước: **CHỜ** = thiếu điều kiện/chưa chạy; **ĐẠT** = đã chạy đủ bước và có bằng chứng; **LỖI** = đã chạy và sai kỳ vọng đã bàn giao. Trạng thái "nhóm trưởng xác nhận hoàn" phải có liên kết xác nhận; hiện **chưa có** xác nhận đó.

---

## 3. Chuẩn bị dữ liệu khi được bàn giao

| Ký hiệu trong ca | Nhóm trưởng cần cung cấp/xác nhận |
| --- | --- |
| USER-GUEST | Tài khoản khách hợp lệ (email + mật khẩu) để kiểm tra đăng nhập thành công. |
| USER-OWNER | Tài khoản chủ sân `ownerStatus: APPROVED` để kiểm tra đăng nhập và điều hướng. |
| FACILITY-A | Cơ sở có đầy đủ thông tin (tên, địa chỉ, số điện thoại, chủ sân APPROVED). |
| FACILITY-EMPTY | Màn danh sách cơ sở rỗng – hoặc thực hiện riêng trên môi trường không có dữ liệu; không xóa dữ liệu chung. |
| COURT-A | Sân `active: true`, có `basePriceVND`, `peakPriceVND`, `openTime`, `closeTime`. |
| COURT-EMPTY | Màn danh sách sân rỗng – hoặc môi trường không có sân active. |
| LONG-NAME | Tên cơ sở/sân dài để kiểm tra bố cục; nhóm trưởng xác nhận giới hạn ký tự tối đa. |
| BAD-CRED | Email/mật khẩu sai để kiểm tra thông báo lỗi đăng nhập. |

Các ký hiệu trên là **chỉ chờ bàn giao, không phải bản ghi đã tồn tại**. Không dùng tổng số bản ghi Atlas chung để suy ra ca lưu thành công.

---

## 4. Danh sách ca kiểm thử

### Trang chủ `/`

#### CA-H01 – Render đúng CSS, thương hiệu và điều hướng

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/` trên desktop (1366 × 900). | Trang tải, không có lỗi console. Header hiển thị logo "Sân Thể Thao" và nav: Trang chủ, Cơ sở, Đặt sân, Đăng nhập, Đăng ký khách, Dành cho chủ sân (khi chưa đăng nhập). | CHƯA CHẠY | CHỜ |
| 2. Kiểm tra hero section có tiêu đề, mô tả và nút "Xem sân và đặt lịch". | Nút trỏ đến `/courts`; không có lỗi bố cục, không cuộn ngang. | CHƯA CHẠY | CHỜ |
| 3. Mở `/` trên mobile (390 × 844). | Bố cục mobile hiển thị đúng, nav không bị che khuất, chữ không tràn. | CHƯA CHẠY | CHỜ |
| 4. Tab qua các liên kết nav. | Focus rõ trên từng phần tử; thứ tự Tab đúng. | CHƯA CHẠY | CHỜ |

Ảnh: CHƯA CÓ.

#### CA-H02 – Điều hướng khi đã đăng nhập

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Đăng nhập bằng `USER-GUEST`, quay lại `/`. | Nav hiển thị "Đơn của tôi", không hiển thị "Đăng nhập"/"Đăng ký". | CHƯA CHẠY | CHỜ |
| 2. Đăng nhập bằng `USER-OWNER`, mở `/`. | Nav hiển thị thêm "Quản lý sân". | CHƯA CHẠY | CHỜ |

Ảnh: CHƯA CÓ.

---

### Danh sách cơ sở `/facilities`

#### CA-F01 – Render danh sách có dữ liệu

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/facilities` trên desktop (1366 × 900). | Tiêu đề "Danh sách cơ sở", nav hiển thị đúng. | CHƯA CHẠY | CHỜ |
| 2. Kiểm tra card `FACILITY-A`: tên, địa chỉ, số điện thoại hiển thị. | Thông tin đúng như bản ghi. Giá, ảnh, hoặc các trường tuỳ chọn hiển thị nếu có dữ liệu. | CHƯA CHẠY | CHỜ |
| 3. Cuộn trang; kiểm tra không cuộn ngang. | Không xuất hiện thanh cuộn ngang trên cả hai viewport. | CHƯA CHẠY | CHỜ |
| 4. Mở `/facilities` trên mobile (390 × 844). | Bố cục thẻ cơ sở thu hẹp đúng; chữ không tràn hoặc che nhau. | CHƯA CHẠY | CHỜ |

Ảnh: CHƯA CÓ.

#### CA-F02 – Màn rỗng

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/facilities` khi không có cơ sở (dùng `FACILITY-EMPTY` hoặc môi trường riêng). | Trạng thái rỗng hiển thị; không crash, không lỗi JS. | CHƯA CHẠY | CHỜ (cần môi trường/dữ liệu phù hợp) |

Ảnh: CHƯA CÓ. Nếu không có môi trường rỗng, ghi **CHƯA KIỂM TRA** và lý do; không đánh dấu ĐẠT.

#### CA-F03 – Tên/địa chỉ dài

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/facilities` với bản ghi `LONG-NAME`. | Văn bản dài không làm vỡ bố cục; không cuộn ngang; thẻ card co giãn hợp lý. | CHƯA CHẠY | CHỜ (cần `LONG-NAME` từ nhóm trưởng) |

Ảnh: CHƯA CÓ.

---

### Trang đăng nhập `/login`

#### CA-L01 – Render form đăng nhập

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/login` trên desktop (1366 × 900). | Form có trường Email, Mật khẩu, nút Đăng nhập. Liên kết "Đăng ký khách" → `/register`, "đăng ký chủ sân" → `/register/owner`. | CHƯA CHẠY | CHỜ |
| 2. Kiểm tra liên kết "tiếp tục đặt sân không cần đăng nhập". | Liên kết trỏ đến `/courts`. | CHƯA CHẠY | CHỜ |
| 3. Mở `/login` trên mobile (390 × 844). | Bố cục hai cột (intro + card) co về một cột; không cuộn ngang. | CHƯA CHẠY | CHỜ |
| 4. Tab qua form: Email → Mật khẩu → Đăng nhập. | Focus rõ, thứ tự đúng; nhấn Enter trên nút submit gửi form. | CHƯA CHẠY | CHỜ |

Ảnh: CHƯA CÓ.

#### CA-L02 – Đăng nhập thành công (khách)

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Nhập đúng `USER-GUEST`, submit. | Chuyển hướng về `/courts`, session được tạo. | CHƯA CHẠY | CHỜ |
| 2. Nav trang đích hiển thị "Đơn của tôi". | Không còn liên kết "Đăng nhập" trên nav. | CHƯA CHẠY | CHỜ |

Ảnh: CHƯA CÓ.

#### CA-L03 – Đăng nhập thành công (chủ sân APPROVED)

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Nhập đúng `USER-OWNER`, submit. | Chuyển hướng về `/owner`; nav có "Quản lý sân". | CHƯA CHẠY | CHỜ |

Ảnh: CHƯA CÓ.

#### CA-L04 – Đăng nhập sai thông tin (`BAD-CRED`)

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Nhập `BAD-CRED`, submit. | Thông báo lỗi "Không thể đăng nhập" hiển thị trên form; không redirect. Trường email giữ lại giá trị đã nhập. | CHƯA CHẠY | CHỜ |
| 2. Kiểm tra không để lộ thông tin nhạy cảm trong thông báo lỗi. | Thông báo chỉ nêu sai thông tin chung; không tiết lộ email có tồn tại hay không. | CHƯA CHẠY | CHỜ |

Ảnh: CHƯA CÓ.

---

### Danh sách sân `/courts`

#### CA-C01 – Render danh sách có dữ liệu

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/courts` trên desktop (1366 × 900). | Tiêu đề, mô tả và số sân trong danh sách hiển thị đúng. | CHƯA CHẠY | CHỜ |
| 2. Kiểm tra card `COURT-A`: tên sân, tên cơ sở, địa chỉ. | Thông tin khớp bản ghi. | CHƯA CHẠY | CHỜ |
| 3. Kiểm tra giá theo 30 phút: "Giá thường / 30 phút" và "Cao điểm / 30 phút". | Giá hiển thị đúng định dạng tiền VND (theo `formatMoney`). Nếu `basePriceVND = 0` thì hiển thị `0 ₫`, không ẩn. | CHƯA CHẠY | CHỜ |
| 4. Kiểm tra giờ hoạt động "Mở cửa HH:MM–HH:MM" và giờ cao điểm. | Giờ đúng theo dữ liệu `openTime`, `closeTime`, `peakStartTime`, `peakEndTime`. | CHƯA CHẠY | CHỜ |
| 5. Nút "Xem giờ và đặt sân →" trỏ đúng `/courts/:id`. | Click mở đúng trang chi tiết sân `COURT-A`. | CHƯA CHẠY | CHỜ |
| 6. Mở `/courts` trên mobile (390 × 844). | Bố cục grid co đúng; không cuộn ngang; chữ/nút không che nhau. | CHƯA CHẠY | CHỜ |

Ảnh: CHƯA CÓ.

#### CA-C02 – Thông báo thiếu thông tin cơ sở

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Có sân `COURT-A` thuộc cơ sở chưa có chủ sân APPROVED hoặc thiếu số điện thoại. | Hiển thị dòng "Đang chờ cấp chủ sân hoặc số liên hệ." trên card sân đó. | CHƯA CHẠY | CHỜ (cần bản ghi phù hợp hoặc ghi CHƯA KIỂM TRA) |

Ảnh: CHƯA CÓ.

#### CA-C03 – Màn rỗng (không có sân active)

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/courts` khi không có sân `active: true` (dùng `COURT-EMPTY` hoặc môi trường riêng). | Hiển thị trạng thái rỗng "Chưa có sân đang hoạt động." và nút "Xem cơ sở →". | CHƯA CHẠY | CHỜ (cần môi trường/dữ liệu phù hợp) |

Ảnh: CHƯA CÓ. Nếu không có môi trường rỗng, ghi **CHƯA KIỂM TRA** và lý do.

#### CA-C04 – Tên sân dài

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Mở `/courts` với sân có `LONG-NAME`. | Tên dài không vỡ card; không cuộn ngang; bố cục vẫn hợp lệ. | CHƯA CHẠY | CHỜ (cần `LONG-NAME`) |

Ảnh: CHƯA CÓ.

#### CA-C05 – Bộ lọc (nếu có trên main)

| Bước | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| 1. Nếu bộ lọc tìm kiếm (issue #35) đã merge vào main: Chọn cơ sở/ngày/giờ, submit. | Danh sách sân thu hẹp theo bộ lọc; URL cập nhật params; không crash. | CHƯA CHẠY | CHƯA KIỂM TRA — issue #35 chưa merge vào main tại SHA đối chiếu. |

---

## 5. Kiểm tra console và lỗi trang

| Mã  | Kiểm tra | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| ERR-01 | Mở DevTools → Console trên cả 4 trang; ghi mọi lỗi/cảnh báo. | CHƯA CHẠY | CHỜ |
| ERR-02 | Mở DevTools → Network; kiểm tra 4xx/5xx trên tài nguyên (CSS, JS, ảnh). | CHƯA CHẠY | CHỜ |
| ERR-03 | Nhập URL không tồn tại (ví dụ `/xyz`); kiểm tra trang lỗi 404. | CHƯA CHẠY | CHỜ |

---

## 6. Tiêu chí hoàn thành

- [ ] Ghi người chạy, ngày, SHA ứng dụng thực sự chạy, trình duyệt/phiên bản, viewport và nguồn dữ liệu.
- [ ] Có ảnh bốn trang ở desktop và mobile; ca lỗi/rỗng nếu chạy được.
- [ ] Thiếu dữ liệu thì ghi **CHƯA KIỂM TRA** và lý do, không đánh dấu ĐẠT.
- [ ] Lỗi có bước tái hiện; không sửa code ngoài phạm vi để tự hoàn tất.
- [ ] Mọi ca hoàn thành đều có bằng chứng ảnh hoặc log; không kết luận ĐẠT chỉ vì không thấy lỗi.

---

## 7. Mẫu ghi kết quả khi thực thi

```text
Ca / biến thể / phiên: CHỜ ĐIỀN
Trạng thái: CHỜ
Ngày giờ và múi giờ: CHƯA CHẠY
Người kiểm thử: CHỜ ĐIỀN
SHA ứng dụng thực sự chạy: CHƯA CHẠY
Trình duyệt / phiên bản: CHƯA CHẠY
Viewport CSS px: CHƯA CHẠY
Nguồn dữ liệu: Atlas phát triển / local được duyệt / giả lập (chọn đúng)
Phạm vi database và bản ghi được phép thử: CHỜ BÀN GIAO
Các bước đã thực hiện: CHƯA CHẠY
Mong đợi: CHỜ BÀN GIAO
Phản hồi thực tế / HTTP code / URL sau thao tác: CHƯA CHẠY
Ảnh / log đã loại thông tin nhạy cảm: CHƯA CÓ
Kết quả đối chiếu (ĐẠT/LỖI chỉ khi đã thực thi): CHƯA CHẠY
Lý do chờ / liên kết lỗi nếu có: CHỜ G01–G04
```

Nguồn dữ liệu **giả lập** phải ghi rõ chỉ xác minh được phần nào; không dùng để kết luận đã lưu/đọc lại Atlas. Việc lint đạt hoặc render EJS độc lập không thay một ca end-to-end.

---

## 8. Mẫu báo lỗi mới sau khi chạy

```text
Mã lỗi / ca / biến thể: CHỜ ĐIỀN
SHA / trình duyệt / viewport / phiên: CHỜ ĐIỀN
Môi trường và bản ghi thử được phép: CHỜ ĐIỀN
Điều kiện ban đầu và đầu vào: CHỜ ĐIỀN
Các bước tái hiện đã chạy: CHỜ ĐIỀN
Mong đợi (kèm nguồn đã được bàn giao): CHỜ ĐIỀN
Thực tế (gồm phản hồi và dữ liệu đọc lại): CHỜ ĐIỀN
Ảnh / log / liên kết ca: CHƯA CÓ
Phân biệt lỗi đã tái hiện hay chỉ nghi vấn đọc code: CHỜ ĐIỀN
Đề nghị nhóm trưởng phân công / trạng thái xử lý: CHỜ XÁC NHẬN
```

Không tự bổ sung luật giá, quyền, trạng thái hoặc thanh toán. Nếu thiếu hợp đồng để xác định mong đợi thì ghi CHỜ bàn giao; không kết luận ĐẠT chỉ vì không thấy lỗi.
