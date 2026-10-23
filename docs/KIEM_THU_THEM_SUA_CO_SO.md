# Kế hoạch kiểm thử luồng thêm/sửa cơ sở

> **BẢN KẾ HOẠCH — CHƯA CHẠY LUỒNG GHI DỮ LIỆU.** Tài liệu cho [issue #17](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/17). Tất cả ca chức năng bên dưới đang **CHỜ**; không coi việc soạn ca, đọc code hoặc lint đạt là kết quả kiểm thử thêm/sửa thành công.

Ngày đối chiếu: **23/10/2026**. Phạm vi: **mở form → nhập → lưu → đọc lại dữ liệu**, gồm hồi quy xóa điện thoại và giao diện 390px/1366px. Không viết lại checklist trang chủ/danh sách của #7.

## 1. Điều kiện trước khi chạy

| Mã | Điều kiện cần có | Tình trạng đối chiếu | Nguồn |
| --- | --- | --- | --- |
| G01 | Backend PR #13 đã sửa lỗi và merge; ghi được commit chứa bản sửa. | **CHỜ** — PR #13 còn mở, chưa merge. Đọc code chưa xác nhận lỗi điện thoại đã được khắc phục. | [PR #13](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/13), ghi nhận tĩnh trong [bằng chứng đối chiếu](kiem-thu-co-so/doi-chieu-truoc-khi-chay.md). |
| G02 | UI #9/#10 và điều hướng #16 đã ghép, form mở được từ nút/link thật tại vị trí được chốt. | **CHỜ** — `main` đối chiếu chưa có form thêm/sửa và lối vào; các issue liên quan còn mở. | [#9](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/9), [#10](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/10), [#16](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/16). |
| G03 | Nhóm trưởng cấp database/dữ liệu thử và thống nhất bản ghi được phép tạo/sửa. | **CHỜ** — chưa có xác nhận môi trường, bản ghi A/B, dữ liệu nhập và phạm vi thao tác cho đợt kiểm thử này. | Điều kiện trong #17; không suy ra quyền từ việc máy có `.env`. |
| G04 | Bàn giao phiên bản tích hợp, route/action/method, phản hồi lỗi và đích sau lưu; có mẫu ID sai/không tồn tại. | **CHỜ** — chưa có bản bàn giao đủ điều kiện #17 và kỳ vọng cuối cùng để đối chiếu. | #17 và hợp đồng backend/UI cần nhóm trưởng xác nhận. |

**Dừng trước khi mở/gửi form ghi dữ liệu nếu còn thiếu điều kiện.** Các đường dẫn thấy trong PR #13 chỉ là thông tin đối chiếu, chưa được dùng thay cho luồng đã ghép. Không tự chuyển sang nhánh PR chưa được thống nhất để đánh dấu ca đạt, không tự tạo database hay bản ghi dùng chung.

Nếu nhóm trưởng bàn giao phiên bản kiểm thử khác `main`, cần ghi rõ SHA, các phần đã tích hợp và xác nhận việc thay điều kiện ban đầu; không tự coi PR riêng lẻ là bản tích hợp.

## 2. Phiên bản và phiên chạy

### Bản đối chiếu R00 — chỉ chuẩn bị tài liệu

| Trường | Giá trị hiện tại |
| --- | --- |
| SHA `main` đã đọc | `432e755b7fe6b56f42248261d8506a1f5ed00c29` |
| SHA PR #13 đã đọc | `cf5ad45247b0f64e8dbb2bb2316201313d370b0a` — chưa merge; không phải SHA của một lần chạy kiểm thử |
| SHA ứng dụng thực sự được chạy | **Chưa có — chưa chạy** |
| Trình duyệt / phiên bản | **Chưa dùng trình duyệt để chạy ca** |
| Kích thước dự kiến | `390 × 844` và `1366 × 900` CSS px; khi chạy ghi kích thước thực tế |
| Môi trường / nguồn dữ liệu | **Chưa được bàn giao cho đợt thử**; chưa kết nối hoặc ghi Atlas; không dùng dữ liệu giả lập để thay kết quả lưu thật |
| Bản ghi / thời gian thực thi | **Chưa có** |
| Kết luận chức năng | **0 ca đã chạy; 11 ca cấp cao đang CHỜ**; các biến thể cũng chưa chạy |

Mỗi ca dưới đây tham chiếu **R00** cho SHA, trình duyệt và nguồn dữ liệu hiện tại. Khi bắt đầu thực thi, tạo bản ghi R01/R02… theo [mẫu ghi kết quả](kiem-thu-co-so/README.md), điền SHA chạy thật, trình duyệt/phiên bản, viewport, nguồn dữ liệu, kết quả thực tế và ảnh cho **từng biến thể**. Không thay các ô “chưa chạy” bằng kết quả dự đoán.

Quy ước: **CHỜ** = thiếu điều kiện/chưa chạy; **ĐẠT** = đã chạy đủ bước và có bằng chứng; **LỖI** = đã chạy và sai kỳ vọng được bàn giao. Trạng thái “nhóm trưởng xác nhận hoãn” phải có liên kết xác nhận; hiện **chưa có** xác nhận đó.

## 3. Chuẩn bị dữ liệu khi được bàn giao

| Ký hiệu trong ca | Nhóm trưởng cần cung cấp/xác nhận |
| --- | --- |
| A | Cơ sở thử được phép sửa, `_id`, tên/địa chỉ/điện thoại ban đầu; điện thoại ban đầu có dữ liệu để chạy hồi quy. |
| B | Cơ sở đối chứng được phép đọc; giá trị ban đầu để xác minh sửa A không làm đổi B. |
| NEW-P / NEW-E | Hai bộ tên/địa chỉ dành cho tạo mới: một bộ có điện thoại hợp lệ theo hợp đồng, một bộ để trống. Ghi `_id` thực tế sau mỗi lần tạo. |
| EDIT-A | Tên/địa chỉ/điện thoại mới được phép lưu cho A; điện thoại còn dữ liệu sau ca F05 để dùng cho F06. |
| LONG | Tên/địa chỉ dài, nằm trong giới hạn backend đã bàn giao, dùng cho kiểm tra bố cục. Không tự đặt giới hạn ký tự. |
| BAD-ID / MISSING-ID | ID sai định dạng và ID đúng định dạng nhưng không tồn tại do nhóm trưởng cung cấp; không xóa cơ sở để tạo tình huống. |

Các ký hiệu trên là **chỗ chờ bàn giao, không phải bản ghi đã tồn tại hoặc dữ liệu được duyệt**. Lưu giá trị trước/sau và ID thử trong phạm vi bằng chứng được phép chia sẻ; không đưa URI, mật khẩu hoặc dữ liệu cá nhân thật vào Git/ảnh. Không dùng tổng số cơ sở của database dùng chung để suy ra ca lưu thành công; đọc lại đúng ID vừa tạo/sửa.

## 4. Các ca kiểm thử

### F01 — Vào form thêm và quay lại

- **Thao tác:** từ đúng trang/vị trí nhóm trưởng bàn giao, dùng nút **Thêm cơ sở**; ghi URL thực tế. Kiểm tra ba trường `name`, `address`, `phone`, label và nút lưu/quay lại; bấm quay lại khi chưa lưu.
- **Mong đợi:** mở đúng form thêm; tên/địa chỉ bắt buộc, điện thoại tùy chọn theo hợp đồng. Quay lại đúng danh sách/đích được bàn giao và không tạo bản ghi. Không nhập URL trực tiếp để thay bằng chứng nút hoạt động.
- **Thực tế:** chưa chạy; `main` đối chiếu chưa có form/lối vào. Chưa phát sinh dữ liệu.
- **Trạng thái / phiên:** **CHỜ G01–G04; R00**.
- **Bằng chứng:** chưa có ảnh thực thi. Khi chạy lưu màn có nút vào, URL form và đích quay lại ở cả hai viewport.

### F02 — Thêm hợp lệ, có điện thoại

- **Thao tác:** từ lối vào F01, nhập bộ NEW-P đã duyệt, gửi một lần. Ghi phản hồi và đích sau lưu; tìm bản ghi mới trong danh sách bằng dữ liệu thử, ghi `_id`, tải lại danh sách và mở lại đúng bản ghi qua liên kết sửa.
- **Mong đợi:** tạo được bản ghi với tên/địa chỉ/điện thoại theo quy tắc backend; giá trị còn đúng sau lần đọc lại độc lập. Đích sau lưu theo bàn giao, không tự mặc định mã HTTP/thông báo. Nếu điện thoại mẫu có số 0 đầu, đối chiếu với chuỗi được bàn giao.
- **Thực tế:** chưa chạy; chưa có bộ NEW-P, ID mới hoặc kết quả lưu/đọc lại.
- **Trạng thái / phiên:** **CHỜ G01–G04; R00**.
- **Bằng chứng:** chưa có. Khi chạy ghi đầu vào, phản hồi/URL sau lưu, ID và ảnh danh sách/form mở lại chứng minh giá trị đã lưu.

### F03 — Thêm hợp lệ, để trống điện thoại

- **Thao tác:** nhập bộ NEW-E đã duyệt, giữ ô điện thoại trống; gửi một lần. Ghi ID mới, tải lại danh sách và mở lại đúng cơ sở vừa tạo.
- **Mong đợi:** điện thoại không bắt buộc; tên/địa chỉ được lưu và đọc lại đúng. Danh sách/form xử lý điện thoại trống bình thường, không hiện `undefined`/`null` hoặc số của bản ghi khác. Không tự chốt database phải lưu chuỗi rỗng hay bỏ trường.
- **Thực tế:** chưa chạy; chưa có bộ NEW-E, ID mới hoặc phản hồi.
- **Trạng thái / phiên:** **CHỜ G01–G04; R00**.
- **Bằng chứng:** chưa có. Khi chạy lưu ảnh form trống điện thoại, kết quả danh sách và lần mở lại theo ID.

### F04 — Mở sửa đúng cơ sở và quay lại

- **Thao tác:** ghi dữ liệu A/B ban đầu, bấm **Sửa** của A tại lối vào đã ghép. So sánh ID trong URL/action và ba giá trị điền sẵn với A; quay lại khi chưa lưu.
- **Mong đợi:** form thuộc A, không lẫn dữ liệu B. Quay lại đúng đích bàn giao; thao tác mở/quay lại không cập nhật dữ liệu.
- **Thực tế:** chưa chạy; A/B và liên kết sửa chưa được bàn giao cho đợt thử.
- **Trạng thái / phiên:** **CHỜ G01–G04; R00**.
- **Bằng chứng:** chưa có. Khi chạy ghi giá trị ban đầu, URL/ID, ảnh form sửa và đích quay lại.

### F05 — Sửa tên/địa chỉ/điện thoại của đúng bản ghi

- **Thao tác:** mở lại A, nhập bộ EDIT-A đã duyệt, lưu một lần. Theo đích sau lưu, tải lại và mở lại A; đối chiếu B bằng lần đọc riêng. Ghi giá trị A sau lưu làm đầu vào F06.
- **Mong đợi:** A giữ đúng ID và có giá trị mới theo hợp đồng; B không đổi. Dữ liệu đúng sau tải lại/mở lại, không chỉ xuất hiện trong form phản hồi submit.
- **Thực tế:** chưa chạy; chưa có đầu vào EDIT-A hay kết quả trước/sau.
- **Trạng thái / phiên:** **CHỜ G01–G04; R00**.
- **Bằng chứng:** chưa có. Khi chạy ghi ID A/B, đầu vào, URL sau lưu và dữ liệu A/B đọc lại.

### F06 — Hồi quy: xóa hết điện thoại rồi lưu

- **Thao tác:** dùng A sau F05 có điện thoại, ghi lại số cũ. Mở sửa A, xóa **toàn bộ** nội dung ô `phone`, giữ tên/địa chỉ hợp lệ, lưu một lần. Tải lại danh sách rồi mở lại A trong lượt điều hướng mới.
- **Mong đợi:** số cũ không còn trên danh sách hoặc form sửa sau khi đọc lại; tên/địa chỉ và ID vẫn đúng. Không tự chốt cách biểu diễn trường trống trong MongoDB. Nếu số cũ vẫn xuất hiện, ghi lỗi với bước tái hiện, SHA và bằng chứng trước/sau.
- **Thực tế:** **chưa tái hiện bằng runtime**. Issue #17 nêu đây là lỗi hồi quy của PR #13; ghi nhận tĩnh chưa thay thế chạy lưu/đọc lại.
- **Trạng thái / phiên:** **CHỜ G01–G04 và F05 có dữ liệu phù hợp; R00**.
- **Bằng chứng:** chưa có ảnh thực thi. Bắt buộc lưu số cũ, ô đã xóa trước submit, phản hồi và lần mở lại đúng ID; ghi nhận tĩnh ở [đối chiếu trước khi chạy](kiem-thu-co-so/doi-chieu-truoc-khi-chay.md).

### F07 — Tên bắt buộc và giữ dữ liệu khi lỗi

- **Thao tác:** chạy riêng **F07-A** thêm/tên rỗng, **F07-B** thêm/tên chỉ khoảng trắng, **F07-C** sửa/tên rỗng, **F07-D** sửa/tên chỉ khoảng trắng. Địa chỉ và điện thoại dùng giá trị thử hợp lệ, dễ nhận biết. Ghi lỗi ở trình duyệt hay phản hồi backend.
- **Mong đợi:** tên không hợp lệ không được lưu. Khi backend render lỗi, giá trị các trường được giữ theo hợp đồng để sửa lại; form sửa vẫn trỏ đúng A, dữ liệu đã lưu của A không đổi. Thông báo/HTTP code theo bàn giao.
- **Thực tế:** cả bốn biến thể chưa chạy; chưa có phản hồi lỗi hoặc kiểm chứng giữ dữ liệu.
- **Trạng thái / phiên:** **CHỜ G01–G04; R00** cho F07-A/B/C/D.
- **Bằng chứng:** chưa có. Khi chạy ghi riêng đầu vào, nơi chặn, phản hồi, các ô sau lỗi và dữ liệu đọc lại. Nếu `required` của trình duyệt chặn submit, đó chỉ là kết quả phía trình duyệt; phần lỗi backend vẫn CHỜ cho đến khi gửi bằng cách nhóm trưởng cho phép trên môi trường thử, không sửa source để bỏ chặn.

### F08 — Địa chỉ bắt buộc và giữ dữ liệu khi lỗi

- **Thao tác:** chạy riêng **F08-A** thêm/địa chỉ rỗng, **F08-B** thêm/địa chỉ chỉ khoảng trắng, **F08-C** sửa/địa chỉ rỗng, **F08-D** sửa/địa chỉ chỉ khoảng trắng. Giữ tên và điện thoại hợp lệ, dễ nhận biết.
- **Mong đợi:** địa chỉ không hợp lệ không được lưu; khi backend render lỗi, các trường giữ giá trị theo hợp đồng, ID/action sửa vẫn thuộc A và dữ liệu đã lưu không đổi.
- **Thực tế:** cả bốn biến thể chưa chạy; chưa có phản hồi lỗi hoặc kiểm chứng giữ dữ liệu.
- **Trạng thái / phiên:** **CHỜ G01–G04; R00** cho F08-A/B/C/D.
- **Bằng chứng:** chưa có. Khi chạy ghi riêng đầu vào, lỗi phía trình duyệt/backend, các ô sau lỗi và dữ liệu đọc lại. Áp dụng phân biệt chặn `required` và lỗi backend như F07.

### F09 — ID sai định dạng

- **Thao tác:** dùng BAD-ID nhóm trưởng cung cấp để **F09-A** mở đường dẫn sửa, **F09-B** gửi cập nhật bằng method/action và cách thử đã được cho phép. Dữ liệu submit dùng giá trị thử hợp lệ. Không sửa một ID thật để tạo tình huống trên database chung.
- **Mong đợi:** phản hồi xử lý ID sai theo hợp đồng được bàn giao; không tạo cơ sở mới hoặc làm đổi A/B. Ghi chính xác HTTP code, nội dung và hướng quay lại; chưa có hợp đồng thì chưa được kết luận đạt.
- **Thực tế:** hai biến thể chưa chạy; chưa có BAD-ID/kỳ vọng cuối cùng được bàn giao.
- **Trạng thái / phiên:** **CHỜ G01–G04; R00** cho F09-A/B.
- **Bằng chứng:** chưa có. Khi chạy lưu URL/method, dữ liệu, HTTP code, thông báo thực tế và đối chiếu với kỳ vọng có nguồn.

### F10 — ID hợp lệ nhưng không tồn tại

- **Thao tác:** dùng MISSING-ID do nhóm trưởng xác nhận để **F10-A** mở sửa, **F10-B** gửi cập nhật theo cách thử được cho phép. Không xóa bản ghi để tạo ID không tồn tại.
- **Mong đợi:** báo không tìm thấy theo hợp đồng backend, không cập nhật nhầm A/B hoặc tạo mới. Ghi phản hồi/điều hướng thật; không tự áp mã HTTP hay chuỗi thông báo từ PR chưa merge.
- **Thực tế:** hai biến thể chưa chạy; chưa có MISSING-ID/kỳ vọng cuối cùng được bàn giao.
- **Trạng thái / phiên:** **CHỜ G01–G04; R00** cho F10-A/B.
- **Bằng chứng:** chưa có. Khi chạy ghi xác nhận mẫu ID không tồn tại, URL/method, dữ liệu và phản hồi thực tế.

Sau **F09-B/F10-B**, đọc lại A/B độc lập để đối chiếu trước/sau; với F10, kiểm tra thêm đúng MISSING-ID bằng đường đọc nhóm trưởng cho phép. Việc xác minh không tạo bản ghi phải có cách kiểm chứng chỉ đọc do nhóm trưởng bàn giao; không suy ra từ ảnh lỗi hoặc tổng số cơ sở trong database chung. Nếu chưa có cách kiểm chứng, ghi rõ phần chưa xác minh và giữ ca **CHỜ**, không kết luận toàn bộ ca đạt. Không tự tạo API hoặc chạy truy vấn ngoài phạm vi được duyệt.

### F11 — Kiểm tra luồng tại 390px và 1366px

- **Thao tác:** thực hiện các bước F01–F10 trong hai nhóm viewport **F11-M** `390 × 844` và **F11-D** `1366 × 900` trên bản tích hợp, dùng dữ liệu thử được duyệt cho từng lần tạo/sửa. Kiểm tra form thêm, form sửa điền sẵn, lỗi backend và kết quả đọc lại; dùng bộ LONG đúng giới hạn được bàn giao.
- **Mong đợi:** không tràn ngang/che nội dung; tên/địa chỉ dài không phá bố cục. Label, lỗi và nút đọc được; Tab/Shift+Tab đến các trường/nút theo thứ tự, focus rõ, nút/link dùng được bằng bàn phím. Lỗi vẫn giữ dữ liệu theo hợp đồng. Không thay kiểm thử lưu thật bằng ảnh form tĩnh.
- **Thực tế:** chưa chạy ở cả hai viewport; chưa có ảnh giao diện tích hợp.
- **Trạng thái / phiên:** **CHỜ G01–G04; R00** cho F11-M/D.
- **Bằng chứng:** chưa có. Sau khi chạy phải có ít nhất **6 ảnh**: thêm, sửa, lỗi backend × mobile/desktop; kèm ID ca/biến thể, SHA, trình duyệt và viewport. Lưu thêm ảnh chứng minh F06 trước/sau và kết quả đọc lại. Quy ước tại [thư mục bằng chứng](kiem-thu-co-so/README.md).

## 5. Lỗi cần theo dõi

### REG-PHONE-01 — Điện thoại cũ còn sau thao tác xóa

- **Nguồn:** [issue #17](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/17) ghi đây là lỗi đã phát hiện ở PR #13.
- **Bước tái hiện dự kiến:** A có điện thoại → mở sửa → xóa hết điện thoại → lưu → tải lại danh sách → mở lại A; chi tiết ở F06.
- **Mong đợi:** số cũ không còn sau lần đọc lại.
- **Thực tế đã xác minh trong đợt này:** chưa chạy lưu/đọc lại. Chỉ đọc PR #13 tại SHA `cf5ad45247b0f64e8dbb2bb2316201313d370b0a`; nhánh xử lý điện thoại vẫn cần được kiểm lại sau bản sửa. Không ghi “đã tái hiện” hoặc “đã sửa”.
- **Trạng thái:** **CHỜ** backend sửa/merge, tích hợp UI/điều hướng và dữ liệu thử; chưa có ảnh runtime. Xem [ghi nhận tĩnh](kiem-thu-co-so/doi-chieu-truoc-khi-chay.md).

Lỗi mới khi chạy phải ghi theo [mẫu báo lỗi](kiem-thu-co-so/README.md), gồm ca/biến thể, SHA, trình duyệt/viewport, dữ liệu thử, bước tái hiện, mong đợi có nguồn, thực tế và bằng chứng. Không tự sửa backend trong nhánh QA.

## 6. Kết quả và bàn giao hiện tại

| Phần | Kết quả |
| --- | --- |
| Kế hoạch | Đã soạn 11 ca cấp cao, có các biến thể thêm/sửa và desktop/mobile; có mẫu ghi kết quả/báo lỗi và quy ước ảnh. |
| Đối chiếu điều kiện | Đã đọc `main`, PR #13 và issue #9/#10/#16/#17; thiếu điều kiện được ghi G01–G04, chưa có xác nhận hoãn của nhóm trưởng. |
| Chạy luồng chức năng, lưu và đọc lại | **CHƯA CHẠY — CHỜ**; chưa dùng Atlas hoặc dữ liệu giả lập để kết luận đạt. |
| Ảnh form thêm/sửa/lỗi desktop/mobile | **CHƯA CÓ — CHỜ** bản tích hợp và dữ liệu thử. Không dùng thiết kế #8 hay ảnh giả lập làm bằng chứng thực thi. |
| Nhóm trưởng duyệt kết quả hoặc phần hoãn | **CHƯA CÓ — CHỜ XÁC NHẬN**. |

**Nội dung cần nhóm trưởng bổ sung khi review:** commit tích hợp có bản sửa điện thoại + UI/điều hướng, môi trường và bản ghi được phép thử, hợp đồng phản hồi/đích sau lưu, hai mẫu ID, cùng xác nhận kế hoạch chạy hoặc phần cần hoãn. Sau đó người kiểm thử cập nhật kết quả từng biến thể và ảnh thật vào PR.

PR kế hoạch dùng **`Refs #17`**, giữ issue mở. Chưa tích các điều kiện hoàn thành của issue; chỉ kết luận đợt QA hoàn tất sau khi có kết quả thực thi hoặc phần hoãn được nhóm trưởng xác nhận theo yêu cầu #17.
