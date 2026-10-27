# Bằng chứng kiểm thử đặt sân #33

Bộ ảnh mới ngày **26/10/2026** thay toàn bộ bộ ảnh cũ không khớp ca kiểm thử.

- [Báo cáo từng ca và giới hạn nghiệm thu](../KIEM_THU_LUONG_DAT_SAN.md)
- [Danh mục 64 ảnh mới ở hai viewport](review-2026-10-26/README.md)
- [Manifest thời điểm, kích thước và SHA-256 từng ảnh](review-2026-10-26/browser-evidence.json)
- [Đối chiếu HTTP/DB đã loại query, body, cookie và token](review-2026-10-26/http-db-evidence.json)

Người bàn giao: Hoàng Triều (`lhtrieu2703-beep`); Codex thực thi. Source đã chạy: `ba4e9de81bfce2420a3d06bf220e9601c7a1fb53`, source ứng dụng đồng nhất main `f8c1cfb900ab4ba4cd568e520dce46d9e2dbf0b7`.

Browser CUA in-app, HTTP User-Agent Chrome/156.0.0.0. Ảnh full-page chụp trạng thái thật ở 1366×900 và 390×844 bằng resize cùng phiên. Nội dung ảnh là fixture tổng hợp, không phải dữ liệu người thật. Định dạng ảnh JPEG do API screenshot trả về, đuôi .jpg đúng định dạng.

[Bổ sung hoàn tất C04/C06](completion-2026-10-26/README.md): hai trình duyệt có giao diện, DB không có đơn giữ một phần và PDF thực một trang đã kiểm tra render. Lần bổ sung chạy SHA `ec14ee0c55b296af80f137936847618c08b6034b`, Chrome 155.0.8059.86. Sẵn sàng nhóm trưởng review; các giới hạn còn lại ghi rõ trong báo cáo.
