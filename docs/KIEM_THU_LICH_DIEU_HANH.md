# Kiểm thử lịch điều hành — #66, sửa review PR #71

**CHƯA NGHIỆM THU #66. Không merge #71 để đưa backend/UI vào main.**

## SHA và bằng chứng lịch sử

Commit báo cáo cũ: `bde7ba5d93ebf7d240aa81030986f0865be00586`, Hoàng Triều, 25/10/2026.
SHA đầy đủ ghi trong báo cáo/JSON cũ không tồn tại. `git rev-parse 3d76e10` xác nhận commit cha UI là **`3d76e102bdc88a94778c889e1ad9ff5f328b9b50`**.
Quan hệ commit không chứng minh lần QA cũ đã chạy đúng source đó. Không sửa SHA suy đoán rồi tiếp tục công bố 7/7 nghiệm thu.

[JSON HTTP lịch sử đã che token](kiem-thu-lich-dieu-hanh/qa-results-66.json) giữ nội dung được báo cáo, đánh dấu nguồn lần chạy chưa xác minh: `targetSHA: null`, `reportedTargetSHA` giữ SHA sai, `existingCandidateSHA` ghi commit tồn tại.
HTTP TestBrowser chỉ gửi request/đọc HTML. Class/ARIA/escape không chứng minh bố cục, cuộn và bàn phím; TC-06 lịch sử chỉ đạt một phần HTML.

## Kiểm thử trình duyệt bổ sung 26/10/2026

- Người yêu cầu/bàn giao: Hoàng Triều (`lhtrieu2703-beep`). Codex thực thi thao tác; không ghi thành Triều tự thao tác.
- Checkout: `bde7ba5d93ebf7d240aa81030986f0865be00586`; source ứng dụng giống commit cha UI ở trên. Phiên sửa chỉ thay tài liệu/ảnh và runner QA tạm, không sửa source ứng dụng.
- Browser: Codex in-app browser qua CUA. Chưa thu được số phiên bản engine; không tự gán phiên bản Chrome/Brave.
- Node 24.15.0; MongoDB 8.3 cục bộ, replica set rs0 cổng 27029; DB một lần `booking_test_1792997991961_18960`. Không đọc `.env`, không dùng Atlas.
- Ứng dụng thật qua createApp/route/controller/service/EJS/MongoStore. Fixture tổng hợp gồm ba OWNER/cơ sở normal, long, empty. Normal/long có sân 06–12, 17–22 và inactive 06–22. Tên sân dài 132 ký tự. Tạo fixture trực tiếp trong DB QA không kiểm chứng luồng ADMIN duyệt.
- [JSON đo đạc và giới hạn](kiem-thu-lich-dieu-hanh/browser-review-2026-10-26.json).

| Ca mới | Thực tế | Bằng chứng | Trạng thái |
| --- | --- | --- | --- |
| Thường 390×844 / 1366×900 | Có ba sân, inactive; document không tràn ngang | [390](kiem-thu-lich-dieu-hanh/normal-390.png), [1366](kiem-thu-lich-dieu-hanh/normal-1366.png) | ĐẠT trên source trên |
| Tên dài hai viewport | Tên xuống dòng; document 390/390 và 1366/1366; bảng cuộn riêng 4480/319 và 4552/1133 | [390](kiem-thu-lich-dieu-hanh/long-390.png), [1366](kiem-thu-lich-dieu-hanh/long-1366.png), [bảng](kiem-thu-lich-dieu-hanh/long-table-390.png) | ĐẠT bố cục đã quan sát; hàng tên dài rất cao |
| Chưa có sân hai viewport | Có thông báo rỗng; document không tràn ngang | [390](kiem-thu-lich-dieu-hanh/empty-390.png), [1366](kiem-thu-lich-dieu-hanh/empty-1366.png) | ĐẠT |
| Tab/Enter mobile | Điền 2026-10-27, Tab qua segment native đến Xem lịch, Enter; URL chuyển ?date=2026-10-27 và tiêu đề đúng ngày | [Focus](kiem-thu-lich-dieu-hanh/focus-390.png) | ĐẠT chuỗi thao tác này |
| Mũi tên mobile | Focus bảng, ArrowRight; scrollLeft tăng đến 86.4px, document vẫn 390px; có viền focus, cột tên cố định | [Sau cuộn](kiem-thu-lich-dieu-hanh/scroll-390.png) | ĐẠT |

Ảnh full-page giữ chiều rộng viewport, chiều cao có thể lớn hơn 844/900. Chưa thử đầy đủ bàn phím desktop, mọi vị trí cuộn, trình duyệt khác hoặc điện thoại thật. Chưa chạy lại toàn bộ bảy ca HTTP nghiệp vụ trong phiên bổ sung; không chuyển kết quả lịch sử thành kết quả mới.

## Tách PR và điều kiện nghiệm thu

#71 ban đầu chứa cả backend #68 và UI #69. Bản sửa đã loại source và tài liệu backend/UI khỏi diff với main, chỉ giữ báo cáo/JSON/ảnh QA. Backend chưa merge, UI còn draft; giữ #71 draft, chỉ Refs #66.
Sau khi nhóm trưởng chốt/merge backend/UI: tạo nhánh QA từ main mới, chỉ mang báo cáo/JSON/ảnh #66, chạy lại trên đúng SHA đó và hoàn tất ca thiếu. Không cherry-pick nguyên chuỗi commit hiện tại. Chưa tạo PR QA hoàn chỉnh hoặc đóng #66 khi điều kiện này chưa đạt.

Token đã che trong JSON hiện tại; giá trị cũ vẫn có trong lịch sử Git. Không viết lại lịch sử/force-push trong phiên này. Không tái sử dụng token QA cũ.

## Kiểm tra thực thi phiên sửa

Trước khi loại source backend/UI khỏi diff: npm run check PASS (18 EJS), npm test 134/134 PASS, 0 fail/skip trên source ứng dụng bde7ba5. Đây là kết quả tự động, tách riêng ảnh/trình duyệt ở trên. Bản PR chỉ QA cần kiểm tra lại theo nền main; không gán 134 test cho main thiếu backend lịch.

Sau khi loại source: npm run check PASS (17 EJS), npm test 111/111 PASS, 0 fail/skip. App QA đã dừng; hai DB fixture (gồm lần chuẩn bị lỗi tên vượt giới hạn schema) đã được dọn. Diff cuối với main chỉ chứa tài liệu/JSON/ảnh #66.
