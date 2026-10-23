# Kiểm thử luồng đặt sân

> **PHIÊN BẢN CHUẨN BỊ TÀI LIỆU – CHƯA CHẠY.** Tài liệu cho [issue #33](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/33). Tất cả ca dưới đây đang **CHỜ**; không coi việc soạn ca hoặc đọc code là kết quả kiểm thử.

---

## 1. Mục tiêu

Kiểm tra toàn luồng đặt sân qua trình duyệt, chuẩn bị kịch bản trình bày và ghi lỗi cho nhóm trưởng. Luồng có sẵn; không viết thêm backend.

---

## 2. Phạm vi

- Tạo `docs/KIEM_THU_LUONG_DAT_SAN.md`
- Ảnh trong `docs/kiem-thu-dat-san/`
- Không sửa source, `.env` mẫu, test/CI hoặc database dùng chung.
- Dùng tài khoản và DB phát triển riêng; nhóm trưởng cấp ADMIN/duyệt OWNER cho phiên thử.
- Không tự cấp quyền bằng sửa DB.

---

## 3. Các ca nhỏ cần chạy

| # | Mô tả ca | Trạng thái |
|---|----------|-----------|
| 1 | Khách đăng ký → sai/đúng mật khẩu → xem lịch sử rỗng → logout/login; chỉ thấy đơn mình. | CHỜ |
| 2 | OWNER đăng ký chờ → ADMIN cấp cơ sở → OWNER tạo/sửa sân và hai mức giá; chủ sân chờ không quản lý được. | CHỜ |
| 3 | Khách chọn hai ô **rời nhau**, một ô thường và một ô cao điểm; tổng đúng, ô giữa không bị giữ. | CHỜ |
| 4 | Hai phiên độc lập tranh cùng ô: chỉ một giữ được; phiên thất bại có phản hồi, không tạo thành công giả. | CHỜ |
| 5 | HOLD 10 phút: kiểm tra đồng hồ; chờ hết hạn thật trên đơn thử, tải lại để kiểm tra giải phóng và không thanh toán được đơn hết hạn. | CHỜ |
| 6 | Bấm thanh toán **mô phỏng** trong DEMO_MODE, xem phiếu và In/Lưu PDF; có nhãn mô phỏng, đúng tiền và ô. | CHỜ |
| 7 | Khách tài khoản gửi yêu cầu hủy/đổi → đúng OWNER duyệt/từ chối; thử đổi vào ô đã chiếm và kiểm tra lịch cũ vẫn giữ. | CHỜ |
| 8 | Khách vãng lai nhập tên/SĐT → đặt → demo → phiếu; có số liên hệ và link riêng, không có quyền tự hủy/đổi. OWNER xử lý hủy sau cuộc gọi mô phỏng. | CHỜ |
| 9 | Người khác không xem được phiếu/tài khoản/đơn không thuộc mình. | CHỜ |

---

## 4. Điều kiện trước khi chạy

| Mã | Điều kiện cần có | Tình trạng |
|---|-----------------|------------|
| G01 | Bản `main` đã merge PR #26, #27, #28; ghi SHA đối chiếu. | **ĐÃ CÓ** (SHA `7d612bc...`). |
| G02 | Ứng dụng khởi động được (`npm start`), kết nối DB phát triển thành công, không crash. | **CHỜ** – chưa chạy. |
| G03 | Có dữ liệu thử: ít nhất một tài khoản khách, một tài khoản OWNER (APPROVED), ít nhất một cơ sở và một sân `isActive:true`. | **CHỜ** – cần bàn giao. |
| G04 | Môi trường test riêng biệt; `.env` không commit. | **CHỜ**. |

Nếu thiếu bất kỳ G01–G04 nào, dừng và yêu cầu nhóm trưởng cung cấp.

---

## 5. Kiểm tra console và lỗi trang

| Mã | Kiểm tra | Trạng thái |
|---|----------|------------|
| ERR-01 | DevTools → Console trên các trang liên quan (đăng ký, đăng nhập, đặt sân, phiếu). | CHỜ |
| ERR-02 | DevTools → Network; không có 4xx/5xx trên tài nguyên. | CHỜ |

---

## 6. Tiêu chí hoàn thành

- [ ] Ghi người chạy, ngày, SHA thực tế, trình duyệt/phiên bản, viewport và nguồn dữ liệu.
- [ ] Có ảnh/PDF cho mỗi ca (desktop 1366×900 và mobile 390×844).
- [ ] Nếu thiếu dữ liệu, ghi **CHƯA KIỂM TRA** và lý do.
- [ ] Mỗi ca có bản ghi chi tiết: bước, đầu vào, mong đợi, thực tế, ĐẠT/LỖI/CHƯA KIỂM TRA.
- [ ] Không tự sửa luật giá, quyền, trạng thái hoặc thanh toán.

---

## 7. Hướng dẫn thu thập kết quả (README)

- Nhận xác nhận G01–G04 từ nhóm trưởng.
- Ghi `git rev-parse HEAD` của phiên chạy, thời gian, người thử, trình duyệt, viewport.
- Tạo bản ghi cho mỗi ca, điền dữ liệu trước, thao tác, phản hồi, ảnh.
- Chụp ảnh 4 trang (đăng ký, đăng nhập, đặt sân, phiếu) ở cả hai viewport.
- Lưu ảnh trong `docs/kiem-thu-dat-san/` và liên kết trong `KIEM_THU_LUONG_DAT_SAN.md`.
- Đặt tên ảnh như `C01-1366.png`, `C01-390.png`, …

---

**Lưu ý**: Không có ảnh hay kết quả thực tế hiện tại – toàn bộ ca vẫn ở trạng thái **CHỜ**.
