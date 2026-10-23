# Làm việc với bản tích hợp

Đọc README, docs/HUONG_DAN_TICH_HOP.md, docs/THANH_TOAN_CON_DANG_DO.md và code liên quan.

- Giữ JavaScript/Express/EJS/Mongoose và MVC ở gốc, không thêm src/frontend thứ hai.
- CUSTOMER và khách vãng lai cùng đặt được. OWNER đăng ký chờ ADMIN cấp cơ sở. Không cấp ADMIN qua form.
- Một đơn một sân/ngày, nhiều ô30phút rời nhau; giữ toàn bộ10phút bằng transaction, snapshot giá từng ô.
- Thanh toán chỉ MÔ PHỎNG trong DEMO_MODE, có nhãn và không bật production. QR/ngân hàng thật còn dở.
- Khách có tài khoản gửi yêu cầu hủy/đổi; khách vãng lai gọi cơ sở; chủ sân xét duyệt/ghi nhận hoàn thủ công. Không tự áp chính sách gốc.
- OWNER chỉ thao tác cơ sở mình. Quyền/giá/người đặt/trạng thái lấy từ server; POST qua CSRF.
- Bảo toàn dữ liệu cũ; migration mặc định dry-run, apply riêng. Không tự seed/xóa/sửa index Atlas thật.
- Không đọc/in/commit .env, credentials hoặc token riêng. Tests dùng DB tạm cục bộ.
- Chạy npm run check và npm test cho thay đổi nghiệp vụ. Không coi schema/UI/CI xanh là đã có thanh toán thật.
