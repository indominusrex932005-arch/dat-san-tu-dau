# Kiểm thử bộ lọc tìm sân theo cơ sở/ngày/giờ — issue #36

Ngày chạy: **24/10/2026**, giờ Việt Nam (UTC+7). Kết quả: **41/41 ca HTTP/DB PASS**; **9/10 ca giao diện PASS, 1 FAIL** khi mở trang chi tiết với tên cơ sở dài trên mobile. Lỗi được ghi tại BUG-01 để nhóm trưởng phân công; báo cáo QA không sửa source.

## 1. Bản được kiểm thử và môi trường

| Mục | Thực tế |
| --- | --- |
| Issue | [#36](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/36) |
| Bản ứng dụng đã chạy | Nhánh `feat/ui-courts-filter`, SHA [`30ee256133ac87417481ccf52407281af9e385e7`](https://github.com/indominusrex932005-arch/dat-san-tu-dau/tree/30ee256133ac87417481ccf52407281af9e385e7) |
| Backend được tích hợp trong SHA trên | [`3d05d75a729402f7260f208d5ded958e9ec401d7`](https://github.com/indominusrex932005-arch/dat-san-tu-dau/tree/3d05d75a729402f7260f208d5ded958e9ec401d7), [PR #45 / issue #34](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/45) |
| UI | [PR #50 / issue #35](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/50), base là `feat/search-courts-backend`; SHA UI đã chứa backend trên |
| Main khi bắt đầu | `94ee45eeb39e3de15b3d5c05cf15ff66ee94cb49`; **chưa có #34/#35**. Không gán các kết quả này cho main hoặc cho bản merge tương lai |
| Nền của nhánh báo cáo | `main` tại `94ee45e`; PR báo cáo chỉ thêm tài liệu/ảnh/bằng chứng |
| Thời gian | HTTP/DB lúc 00:48; kiểm tra trình duyệt kết thúc 00:54; dọn DB lúc 00:55, ngày 24/10/2026 |
| Trình duyệt | ChatGPT in-app browser (IAB). Công cụ không cung cấp số phiên bản/build; không suy đoán phiên bản |
| Viewport trình duyệt | Desktop **1366 × 900**, mobile **390 × 844**, cùng trình duyệt ở hai kích thước; chưa phải thử trên điện thoại thật |
| Runtime | Node.js 24.15.0; MongoDB 8.3, replica set riêng `qaSearch36`, chỉ bind `127.0.0.1:27039` |
| Ứng dụng thử | `createApp` thật, controller/service/query/EJS/CSS thật, server tạm cổng 3016. Không mock query, không dùng HTML render sẵn thay kết quả tìm kiếm |
| Nguồn dữ liệu | DB cục bộ riêng `qa_search36_1792777549506_24556c`; 5 cơ sở, 15 sân. Không đọc/sửa `.env`, không kết nối hoặc ghi Atlas |
| Cách chạy HTTP | Hai cookie jar độc lập qua helper HTTP của repo; gọi route thật, kèm CSRF khi POST. Đây là ca HTTP/DB, không gọi hai cookie jar là hai phiên trình duyệt đồ họa |

Ngày giờ theo nghiệp vụ dùng `Asia/Ho_Chi_Minh` (UTC+7), cùng độ lệch múi giờ với máy người thực hiện. Các mốc UTC trong JSON được giữ để đối chiếu. Viewport là kích thước cửa sổ nội dung; `clientWidth` lần lượt 1351/375px do thanh cuộn dọc 15px. Ảnh toàn trang có thể dài hơn viewport; ảnh lỗi chi tiết mobile và focus chụp phần đang thấy. Kích thước JPEG do công cụ xuất; viewport được lấy từ innerWidth/innerHeight, không suy từ kích thước ảnh.

## 2. Dữ liệu và cách tái lập

Các tên, địa chỉ, tài khoản và SĐT trong DB đều là dữ liệu tổng hợp để thử. [fixtures.json](kiem-thu-tim-san/fixtures.json) ghi ID/tên/giờ phục vụ và chuỗi dài chính xác; ID này đã hết hiệu lực sau khi dọn DB. Khi chạy lại cần tạo bản ghi thử mới và thay ID tương ứng, không dùng ID trên Atlas chung.

| Alias | Dữ liệu trên ngày D = 27/10/2026 |
| --- | --- |
| Cơ sở A | OWNER APPROVED, SĐT hợp lệ, gồm các sân A bên dưới |
| Cơ sở B | OWNER APPROVED, SĐT hợp lệ; tên dài có đoạn không ngắt, địa chỉ dài |
| `unowned` / `pending` / `invalidPhone` | Ba cơ sở đối chứng: chưa có chủ / chủ PENDING / SĐT sai; mỗi cơ sở có một sân active |
| `free` | QA A01, 06:00–22:00, ban đầu không có lock |
| `held` | QA A02, 06:00–22:00, HOLD còn hạn tại 14:30 |
| `booked` | QA A03, 06:00–22:00, CONFIRMED/DEMO_PAID và lock vĩnh viễn tại 14:00 |
| `expired` | QA A04, 06:00–22:00; HOLD/lock tại 14:30 đã hết hạn nhưng còn trong DB ở bước GET |
| `full` | QA A05, đủ 32 ô 06:00–22:00 đã BOOKED |
| `edge` | QA A06, chỉ mở 14:00–15:00 |
| `late` | QA A07, chỉ mở 15:00–18:00 |
| `after` | QA A08, 06:00–22:00, BOOKED tại 15:00; không nằm trong khoảng `[14:00,15:00)` |
| `inactive` | QA A09, `active=false`, luôn bị loại khỏi danh sách |
| `pastOnly` | QA A10, chỉ mở 00:00–00:30; dùng kiểm tra ngày hiện tại lúc 00:48, khi ô đã qua |
| `bFree` | QA B01, 09:00–18:00, chưa có lock |
| `bLong` | QA B02, 10:00–19:00, tên đúng 150 ký tự, có `<em>QA</em>` và chuỗi không ngắt; HTML phải hiển thị như văn bản |

D+1 = 28/10/2026 không có lock. Giá thường/cao điểm lần lượt 50.000/75.000đ mỗi ô; khoảng cao điểm nằm trong giờ mở/đóng của từng sân. Không thay quy tắc giá trong lúc QA.

Để tái lập trên DB riêng:

1. Dùng đúng SHA ứng dụng ở mục 1, MongoDB replica set cục bộ và DB mới; tạo OWNER/cơ sở/sân theo fixture. Khởi tạo index model hiện có.
2. Tạo HOLD/CONFIRMED bằng `POST /bookings` và thanh toán mô phỏng trên route thật. Sân `full` chọn đủ 32 ô. Riêng ca hết hạn, lùi cả `Booking.holdExpiresAt` và `SlotLock.expiresAt` 60 giây trên **DB thử**, không đổi đồng hồ hoặc quy tắc ứng dụng.
3. Chạy các GET trong bảng trước khi chạy tranh chấp; so kết quả theo alias/ID và snapshot bốn collection. Không chạy worker hết hạn của `server.js` trong bài so snapshot; dùng cùng `createApp` và service thật. Điều này giúp xác nhận riêng GET tìm kiếm không xóa lock hết hạn.
4. Chạy ca hai session cuối cùng. POST giữ chỗ mới sẽ dọn HOLD hết hạn theo service thật; vì vậy trạng thái fixture sau ca tranh chấp khác bước GET ban đầu. Không lấy ảnh chụp sau đó để suy ngược số lượng kết quả ban đầu.
5. Thử form và ảnh theo mục 4, sau đó dừng server, kiểm tra marker/DB name/replica set và dọn đúng DB thử.

Helper chạy QA nằm cục bộ, không được đưa vào source ứng dụng. Kết quả đã lọc bỏ HTML thô, cookie, CSRF, mật khẩu, token riêng và link phiếu khách. `DEMO_PAID` chỉ là mô phỏng, không chứng minh đã nhận tiền ngân hàng.

## 3. Bảng ca HTTP/DB đã chạy

Bằng chứng đầy đủ từng ca nằm trong [http-results.json](kiem-thu-tim-san/http-results.json), tìm theo trường `id`. PASS được quyết định từ phản hồi HTTP và dữ liệu DB thực tế; lint không được dùng để kết luận chức năng. Alias trong bảng tra ở mục 2; `D` là 27/10/2026.

Ma trận dưới đây được chuyển từ kết quả HTTP đã chạy, không chạy lại server hoặc database. Tổng cộng **41/41 ca PASS** trên SHA `30ee256133ac87417481ccf52407281af9e385e7`; báo cáo hoàn tất lúc **00:48:08 ngày 24/10/2026, giờ Việt Nam** (`2026-10-23T17:48:08.810Z`). Công cụ là Node `fetch` qua `TestBrowser` của repository; các ca này không thay thế kiểm tra bố cục, bàn phím và ảnh trên trình duyệt.

Quy ước: **A/B** là hai cơ sở trong bộ dữ liệu thử, không phải hai phiên HTTP. **D = 2026-10-27**, **D1 = 2026-10-28**, **hôm nay = 2026-10-24**. Tên `free`, `held`, `booked`, `expired`… là bí danh sân trong bảng dữ liệu thử. Mọi bước GET bên dưới dùng `/courts` trừ khi ghi route khác. Khoảng giờ có dạng `[bắt đầu, kết thúc)`, không gồm ô bắt đầu đúng giờ kết thúc. Bấm liên kết bằng chứng rồi tìm trường `id` tương ứng trong phụ lục JSON.

| Mã ca | Bước thực hiện | Mong đợi | Kết quả thực tế | Trạng thái | Bằng chứng |
|---|---|---|---|---|---|
| HTTP-01 | GET không có bộ lọc. | HTTP 200; trả mọi sân active; chưa lọc khả năng nhận đặt nếu thiếu ngày. | HTTP 200; 14 sân: after, bFree, bLong, booked, edge, expired, free, full, held, invalidPhone, late, pastOnly, pending, unowned; không có inactive; không có alert lỗi. | PASS | [JSON · HTTP-01](kiem-thu-tim-san/http-results.json) |
| HTTP-02 | GET chỉ `facilityId=A`. | HTTP 200; chỉ sân active của A. | HTTP 200; 9 sân: after, booked, edge, expired, free, full, held, late, pastOnly. | PASS | [JSON · HTTP-02](kiem-thu-tim-san/http-results.json) |
| HTTP-03 | GET chỉ `facilityId=B`. | HTTP 200; chỉ sân active của B. | HTTP 200; 2 sân: bFree, bLong. | PASS | [JSON · HTTP-03](kiem-thu-tim-san/http-results.json) |
| HTTP-04 | GET chỉ `date=D`. | Cơ sở phải nhận đặt được; sân còn ít nhất một ô trống trong ngày; loại full. | HTTP 200; 10 sân: after, bFree, bLong, booked, edge, expired, free, held, late, pastOnly; full và ba sân thuộc cơ sở chưa đủ điều kiện đều vắng. | PASS | [JSON · HTTP-04](kiem-thu-tim-san/http-results.json) |
| HTTP-05 | GET chỉ `date=D1`. | Khóa của D không làm bận D1. | HTTP 200; 11 sân: after, bFree, bLong, booked, edge, expired, free, full, held, late, pastOnly; full xuất hiện lại trên D1. | PASS | [JSON · HTTP-05](kiem-thu-tim-san/http-results.json) |
| HTTP-06 | GET D, từ 14:00 đến 15:00, không chọn cơ sở. | Cả hai ô 14:00 và 14:30 phải trống; một ô HOLD hoặc BOOKED cũng loại sân; bỏ qua khóa hết hạn. | HTTP 200; 6 sân: after, bFree, bLong, edge, expired, free; held, booked, full bị loại. | PASS | [JSON · HTTP-06](kiem-thu-tim-san/http-results.json) |
| HTTP-07 | GET A, D, 14:00–15:00. | Kết hợp điều kiện cơ sở, ngày và toàn khoảng giờ. | HTTP 200; 4 sân: after, edge, expired, free. | PASS | [JSON · HTTP-07](kiem-thu-tim-san/http-results.json) |
| HTTP-08 | GET B, D, 14:00–15:00. | Không lẫn sân của A. | HTTP 200; 2 sân: bFree, bLong. | PASS | [JSON · HTTP-08](kiem-thu-tim-san/http-results.json) |
| HTTP-09 | GET A, D, 14:00–14:30. | HOLD bắt đầu đúng 14:30 nằm ngoài khoảng tìm; held được trả về. | HTTP 200; 5 sân: after, edge, expired, free, held; booked tại 14:00 vẫn bị loại. | PASS | [JSON · HTTP-09](kiem-thu-tim-san/http-results.json) |
| HTTP-10 | GET A, D, 14:30–15:00. | BOOKED tại 14:00 nằm trước khoảng tìm; booked được trả về. | HTTP 200; 5 sân: after, booked, edge, expired, free; held tại 14:30 bị loại. | PASS | [JSON · HTTP-10](kiem-thu-tim-san/http-results.json) |
| HTTP-11 | GET A, D, 13:30–14:30. | Loại edge vì sân mở lúc 14:00; không cho khớp một phần khoảng giờ. | HTTP 200; 4 sân: after, expired, free, held; edge vắng. | PASS | [JSON · HTTP-11](kiem-thu-tim-san/http-results.json) |
| HTTP-12 | GET A, D, 14:30–15:30. | Loại edge vì đóng lúc 15:00; loại after vì BOOKED tại 15:00. | HTTP 200; 3 sân: booked, expired, free. | PASS | [JSON · HTTP-12](kiem-thu-tim-san/http-results.json) |
| HTTP-13 | GET A, D, 22:00–22:30. | Không có sân phục vụ trọn khoảng ngoài giờ mở cửa. | HTTP 200; 0 sân; không có alert lỗi query. | PASS | [JSON · HTTP-13](kiem-thu-tim-san/http-results.json) |
| HTTP-14 | GET D với ObjectId cơ sở hợp lệ về dạng nhưng không tồn tại (`000000000000000000000000`). | Không lỗi máy chủ; danh sách rỗng. | HTTP 200; 0 sân; không có alert lỗi query. | PASS | [JSON · HTTP-14](kiem-thu-tim-san/http-results.json) |
| HTTP-15-unowned | GET D và cơ sở unowned. | Cơ sở chưa cấp chủ không khớp tìm theo ngày. | HTTP 200; 0 sân. | PASS | [JSON · HTTP-15-unowned](kiem-thu-tim-san/http-results.json) |
| HTTP-15-pending | GET D và cơ sở pending. | OWNER chưa APPROVED không đủ điều kiện nhận đặt. | HTTP 200; 0 sân. | PASS | [JSON · HTTP-15-pending](kiem-thu-tim-san/http-results.json) |
| HTTP-15-invalidPhone | GET D và cơ sở invalidPhone. | Điện thoại cơ sở sai không đủ điều kiện nhận đặt. | HTTP 200; 0 sân. | PASS | [JSON · HTTP-15-invalidPhone](kiem-thu-tim-san/http-results.json) |
| HTTP-16 | GET `facilityId=not-an-object-id`. | HTTP 400; lỗi cơ sở rõ ràng. | HTTP 400; 0 sân; alert “Cơ sở không hợp lệ.” | PASS | [JSON · HTTP-16](kiem-thu-tim-san/http-results.json) |
| HTTP-17 | GET `date=24/10/2026`. | HTTP 400 vì sai dạng ngày ISO. | HTTP 400; 0 sân; alert “Ngày không hợp lệ.” | PASS | [JSON · HTTP-17](kiem-thu-tim-san/http-results.json) |
| HTTP-18 | GET `date=2030-02-30`. | HTTP 400 vì ngày không tồn tại. | HTTP 400; 0 sân; alert “Ngày không tồn tại.” | PASS | [JSON · HTTP-18](kiem-thu-tim-san/http-results.json) |
| HTTP-19 | GET `date=2026-10-23`, trước hôm nay theo giờ Việt Nam. | HTTP 400 vì tìm ngày quá khứ. | HTTP 400; 0 sân; alert “Ngày tìm kiếm không được trong quá khứ.” | PASS | [JSON · HTTP-19](kiem-thu-tim-san/http-results.json) |
| HTTP-20 | GET D và chỉ `startTime=14:00`. | HTTP 400; yêu cầu đủ hai mốc giờ. | HTTP 400; 0 sân; alert “Vui lòng chọn đầy đủ cả giờ bắt đầu và giờ kết thúc.” | PASS | [JSON · HTTP-20](kiem-thu-tim-san/http-results.json) |
| HTTP-21 | GET D và chỉ `endTime=15:00`. | HTTP 400; yêu cầu đủ hai mốc giờ. | HTTP 400; 0 sân; cùng alert yêu cầu đủ giờ bắt đầu/kết thúc. | PASS | [JSON · HTTP-21](kiem-thu-tim-san/http-results.json) |
| HTTP-22 | GET 14:00–15:00 nhưng bỏ ngày. | HTTP 400; phải chọn ngày khi tìm theo giờ. | HTTP 400; 0 sân; alert “Vui lòng chọn ngày khi tìm theo khoảng giờ.” | PASS | [JSON · HTTP-22](kiem-thu-tim-san/http-results.json) |
| HTTP-23 | GET D, `startTime=14:15`, `endTime=15:00`. | HTTP 400; thời gian phải đúng bước 30 phút. | HTTP 400; 0 sân; alert “Giờ phải có dạng HH:00 hoặc HH:30.” | PASS | [JSON · HTTP-23](kiem-thu-tim-san/http-results.json) |
| HTTP-24 | GET D, `startTime=24:00`, `endTime=23:30`. | HTTP 400 vì 24:00 ngoài miền giờ hợp lệ. | HTTP 400; 0 sân; alert yêu cầu dạng HH:00 hoặc HH:30. | PASS | [JSON · HTTP-24](kiem-thu-tim-san/http-results.json) |
| HTTP-25 | GET D, 14:00–14:00. | HTTP 400 vì giờ kết thúc bằng giờ bắt đầu. | HTTP 400; 0 sân; alert “Giờ kết thúc phải sau giờ bắt đầu.” | PASS | [JSON · HTTP-25](kiem-thu-tim-san/http-results.json) |
| HTTP-26 | GET D, 15:00–14:00. | HTTP 400 vì khoảng giờ đảo ngược. | HTTP 400; 0 sân; alert “Giờ kết thúc phải sau giờ bắt đầu.” | PASS | [JSON · HTTP-26](kiem-thu-tim-san/http-results.json) |
| HTTP-27 | GET D, `startTime=8:00`, `endTime=15:00`. | HTTP 400 vì giờ thiếu chữ số đầu. | HTTP 400; 0 sân; alert yêu cầu dạng HH:00 hoặc HH:30. | PASS | [JSON · HTTP-27](kiem-thu-tim-san/http-results.json) |
| HTTP-28 | GET `date=2030-13-01`. | HTTP 400 vì tháng không tồn tại. | HTTP 400; 0 sân; alert “Ngày không tồn tại.” | PASS | [JSON · HTTP-28](kiem-thu-tim-san/http-results.json) |
| HTTP-29 | GET với query lặp `facilityId=A&facilityId=B`, D, 14:00–15:00. | Theo controller hiện tại, lấy chuỗi đầu tiên; vẫn giữ A trên form. | HTTP 200; 4 sân after, edge, expired, free; option được chọn là A. | PASS | [JSON · HTTP-29](kiem-thu-tim-san/http-results.json) |
| HTTP-30 | GET A, D, 14:00–15:00 nhưng bọc mỗi giá trị query bằng khoảng trắng. | Trim giá trị chuỗi rồi tìm bình thường. | HTTP 200; 4 sân after, edge, expired, free; không có alert. | PASS | [JSON · HTTP-30](kiem-thu-tim-san/http-results.json) |
| HTTP-31 | GET A, D, 14:00–15:00 rồi tải lại cùng URL. | Giữ đúng bốn giá trị bộ lọc; kết quả không đổi khi tải lại. | Form trả về A, 2026-10-27, 14:00, 15:00; `reloadStable=true`. Đây là kiểm tra HTML phản hồi, thao tác trình duyệt được ghi riêng. | PASS | [JSON · HTTP-31](kiem-thu-tim-san/http-results.json) |
| HTTP-32 | Tìm A, D, 22:00–22:30; kiểm tra thông báo rỗng và href reset; GET `/courts`. | Có thông báo không khớp bộ lọc; reset về danh sách và xóa cả bốn trường. | Có thông báo rỗng; href reset `/courts`; trả lại đủ 14 sân active; facility/date/start/end đều rỗng. | PASS | [JSON · HTTP-32](kiem-thu-tim-san/http-results.json) |
| HTTP-33 | Tìm B, D, 14:00–15:00; đọc card bLong; GET liên kết chi tiết của card. | Giữ đủ tên dài, không chèn thẻ thực thi; ngày D đi từ href sang lịch và form đặt. | Danh sách/chi tiết đều HTTP 200; đủ 150 ký tự tên; không có thẻ thực thi trong card; cả input lịch và hidden ngày đặt đều `2026-10-27`. | PASS | [JSON · HTTP-33](kiem-thu-tim-san/http-results.json) |
| HTTP-34 | GET facilityId chứa payload thẻ ảnh có `onerror`, cùng D và 14:00–15:00. | Từ chối query; không đưa payload thành thẻ thực thi trong HTML. | HTTP 400; có lỗi cơ sở rõ ràng; không có payload thô hoặc thẻ ảnh mang onerror trong phản hồi. | PASS | [JSON · HTTP-34](kiem-thu-tim-san/http-results.json) |
| HTTP-35 | GET ngày hôm nay; đối chiếu ngày/giờ Việt Nam và sân pastOnly chỉ phục vụ 00:00–00:30. | Không trả sân chỉ còn các ô đã qua; tính ngày theo giờ Việt Nam. | HTTP 200; lúc 00:48 ngày 24/10/2026; ngày fixture trùng ngày Việt Nam; pastOnly vắng; còn 10 sân. | PASS | [JSON · HTTP-35](kiem-thu-tim-san/http-results.json) |
| HTTP-36 | GET `/assets/css/courts.css` và `/assets/css/demo.css`. | Hai tài nguyên CSS có thể tải qua HTTP. | Cả hai trả HTTP 200; ca này không kết luận về bố cục đã render. | PASS | [JSON · HTTP-36](kiem-thu-tim-san/http-results.json) |
| HTTP-37 | So count và SHA-256 bốn collection trước/sau toàn bộ GET trên; đọc lại fixture expired. | GET tìm kiếm/chi tiết không tạo, sửa hoặc xóa dữ liệu đặt sân; expired lock chỉ bị bỏ qua khi tính khả dụng. | Count trước/sau bằng nhau: Booking 5, SlotLock 36, Payment 3, BookingRequest 0; cả bốn digest không đổi; đơn expired vẫn HOLD và còn 1 lock lưu DB. | PASS | [JSON · HTTP-37](kiem-thu-tim-san/http-results.json) |
| HTTP-38 | Tạo hai cookie jar độc lập; GET `/login` để nhận CSRF; cả hai GET D, 14:00–15:00. | Hai phiên đều nhìn thấy free; chỉ tìm kiếm không giữ ô. | Hai phản hồi HTTP 200; cookie phiên khác nhau; cả hai có free; digest/count dữ liệu nghiệp vụ không đổi. | PASS | [JSON · HTTP-38](kiem-thu-tim-san/http-results.json) |
| HTTP-39 | Phiên B POST `/bookings` giữ free lúc 14:30; phiên A POST từ kết quả cũ với cả 14:00 và 14:30; kiểm tra DB rồi GET tìm lại. | B giữ thành công; A bị xung đột, không giữ một phần; tải lại phải loại free khỏi khoảng 14:00–15:00. | B HTTP 303 về checkout; A HTTP 409; lock 14:00 = 0, lock 14:30 = 1; count/digest sau B và sau A không đổi; GET lại không có free. | PASS | [JSON · HTTP-39](kiem-thu-tim-san/http-results.json) |

Phụ lục [kết quả JSON đầy đủ](kiem-thu-tim-san/http-results.json) giữ nguyên số đo, tập bí danh, thông báo lỗi và digest của lần chạy. Không chứa HTML thô, cookie, CSRF, thông tin xác thực hoặc URL phiếu có token. Các thay đổi dữ liệu trong ca HTTP-39 là POST nghiệp vụ có chủ đích trên DB tạm; kết luận GET không đổi dữ liệu dựa trên snapshot riêng ở HTTP-37/38, trước bước đặt thử này.

## 4. Giao diện và thao tác trên trình duyệt

Bằng chứng DOM, kích thước và focus: [browser-results.json](kiem-thu-tim-san/browser-results.json). Kiểm tra không tràn ngang so `documentElement.scrollWidth` với `clientWidth`, đồng thời xem ảnh. Ở kết quả tìm kiếm, thẻ sân và tiêu đề dài không có `scrollWidth` lớn hơn `clientWidth`; `<em>QA</em>` không tạo phần tử HTML trong tiêu đề.

| ID | Bước | Mong đợi | Thực tế | Trạng thái | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| UI-01 | Desktop 1366×900: chọn B, D, 14:00–15:00, bấm Tìm sân | Hai sân B; giữ cả 4 giá trị; tên dài không tràn | 2 sân, đủ 4 giá trị; document 1351/1351px, thẻ 377/377px | PASS | [Ảnh](kiem-thu-tim-san/thuong-desktop-1366.jpg), [DOM](kiem-thu-tim-san/browser-results.json) |
| UI-02 | Cùng kết quả ở 390×844 | Form một cột, nút/thẻ trong khung; không cuộn ngang | Document 375/375px; thẻ 333/333px; input/select/nút rộng khoảng 285px | PASS | [Ảnh](kiem-thu-tim-san/thuong-mobile-390.jpg), [DOM](kiem-thu-tim-san/browser-results.json) |
| UI-03 | Desktop: B, D, 19:00–20:00 | Rỗng, thông báo và nút xóa; giữ bộ lọc | 0 sân, đúng thông báo rỗng; 1351/1351px | PASS | [Ảnh](kiem-thu-tim-san/rong-desktop-1366.jpg) |
| UI-04 | Cùng ca rỗng trên mobile | Đọc được và không tràn ngang | 0 sân; các giá trị vẫn giữ; 375/375px | PASS | [Ảnh](kiem-thu-tim-san/rong-mobile-390.jpg) |
| UI-05 | Desktop: B, D, 14:00–13:00, bấm Tìm sân | Báo lỗi khoảng giờ, giữ giá trị hợp lệ | Alert “Giờ kết thúc phải sau giờ bắt đầu.”, đủ 4 giá trị, 1351/1351px; HTTP 400 được đối chiếu riêng trong bảng HTTP | PASS | [Ảnh](kiem-thu-tim-san/loi-desktop-1366.jpg) |
| UI-06 | Cùng lỗi trên mobile | Alert dễ đọc, form vẫn thao tác được, không tràn | Alert đúng, 14:00/13:00 vẫn giữ, 375/375px | PASS | [Ảnh](kiem-thu-tim-san/loi-mobile-390.jpg) |
| UI-07 | Desktop: Tab từ cơ sở qua các phần ngày/giờ đến Tìm sân; Enter gửi; Tab sang Xóa bộ lọc, Enter | Có focus, gửi/reset bằng bàn phím | Thứ tự đúng; outline rõ; Enter trả 2 sân B; reset về `/courts`, 4 ô rỗng, 14 sân active | PASS | [Focus](kiem-thu-tim-san/focus-desktop-1366.jpg), [DOM](kiem-thu-tim-san/browser-results.json) |
| UI-08 | Thực hiện các thao tác bàn phím trên mobile | Không bị kẹt focus; gửi/reset được | Qua đủ ngày/hai mốc/nút; có outline; gửi 2 sân, reset 14 sân và 4 giá trị rỗng | PASS | [Focus](kiem-thu-tim-san/focus-mobile-390.jpg), [DOM](kiem-thu-tim-san/browser-results.json) |
| UI-09 | Từ kết quả B, D, 14–15 mở QA B01; xem ở cả hai viewport | URL và ngày lịch vẫn D; không tự giữ/chọn ô | URL có `?date=2026-10-27`, input ngày đúng D, 0 checkbox được chọn; HTTP-33 còn đối chiếu ngày ẩn của form đặt bằng HTML server | PASS | [Desktop](kiem-thu-tim-san/chi-tiet-desktop-1366.jpg), [Mobile](kiem-thu-tim-san/chi-tiet-mobile-390.jpg), [DOM](kiem-thu-tim-san/browser-results.json) |
| UI-10 | Trên chi tiết QA B01/cơ sở B tên dài, viewport 390×844; tái hiện lần hai | Nội dung chi tiết xuống dòng, không cuộn ngang | Document **1241px > 375px**, đoạn tên cơ sở 1221px > khung 335px; bị cắt ở mép phải | **FAIL — BUG-01** | [Ảnh](kiem-thu-tim-san/chi-tiet-mobile-390.jpg), `detail.overflow` trong [DOM](kiem-thu-tim-san/browser-results.json) |

Input ngày/giờ native có nhiều phần bên trong nên cần nhiều lần Tab. Kiểm tra đã đi qua cả các phần này, nút tìm và liên kết reset; không suy ra khả năng tương thích bàn phím trên mọi hệ điều hành. Không đọc lại giá trị hidden bằng công cụ trình duyệt vì công cụ che chúng; ngày hidden ở UI-09 được chứng minh bởi phản hồi HTTP-33.

## 5. Lỗi và quan sát để nhóm trưởng xử lý

### BUG-01 — Tràn ngang ở trang chi tiết khi tên cơ sở có đoạn dài không ngắt

- Mức đề xuất: **P2**, ảnh hưởng bố cục mobile; không thấy ghi trùng Booking hoặc mất dữ liệu.
- Môi trường: SHA `30ee256…`, IAB, 390×844, dữ liệu cơ sở B trong fixture. Lặp lại được hai lần. Desktop 1366px có document 1351/1351px.
- Bước tái hiện: tạo cơ sở với `reproduction.longFacilityName` và địa chỉ trong [fixtures.json](kiem-thu-tim-san/fixtures.json), tạo QA B01; tìm cơ sở đó với ngày D và khoảng 14–15; bấm “Xem giờ và đặt sân”; đặt viewport 390×844.
- Mong đợi: tên/địa chỉ xuống dòng trong khung, `scrollWidth <= clientWidth`.
- Thực tế: `documentWidth=1241`, `clientWidth=375`; đoạn tên/địa chỉ cơ sở có `scrollWidth=1221`, `clientWidth=335`, `overflow-wrap: normal`, `word-break: normal`; chữ tràn và bị che ở mép phải. [Ảnh lỗi](kiem-thu-tim-san/chi-tiet-mobile-390.jpg).
- Vị trí cần xem: đoạn tên/địa chỉ dưới tiêu đề trong [court-detail.ejs tại SHA đã thử](https://github.com/indominusrex932005-arch/dat-san-tu-dau/blob/30ee256133ac87417481ccf52407281af9e385e7/views/court-detail.ejs), cùng CSS trang chi tiết. File này không đổi trong diff backend/UI tìm kiếm; không quy kết đây là lỗi mới do bộ lọc. Nhóm trưởng quyết định người sửa; PR QA giữ nguyên source.

### OBS-01 — Trang query lỗi còn kèm khối không có kết quả

Ở ca 14:00–13:00, backend trả 400 và alert đúng, nhưng bên dưới vẫn có khối “Không tìm được sân phù hợp bộ lọc.” như ca tìm hợp lệ mà rỗng. Bằng chứng ở ảnh lỗi desktop/mobile. Đề xuất nhóm trưởng cân nhắc tách phần thông báo này để người dùng phân biệt lỗi nhập liệu và kết quả rỗng rõ hơn. Đây là quan sát UX, chưa đổi tiêu chí hoặc tự sửa UI.

## 6. Vì sao tìm kiếm không giữ chỗ

HTTP-37 so count và SHA-256 toàn bộ dữ liệu đọc được của bốn collection trước/sau các GET: Booking **5→5**, SlotLock **36→36**, Payment **3→3**, BookingRequest **0→0**, các digest giống nhau. Đơn `expired` vẫn là HOLD và lock hết hạn vẫn còn trong DB tại bước này, nhưng sân đã được trả về trong tìm kiếm. Đây là bỏ qua lock hết hạn khi đọc, không phải tìm kiếm tự xóa/giữ sân.

HTTP-38/39 dùng **hai session HTTP riêng** cùng thấy QA A01 trong kết quả. B giữ ô 14:30 qua POST thật → **303** sang checkout. A dùng lựa chọn cũ gửi cả 14:00 và 14:30 → **409**. Sau đó lock tại 14:00 bằng **0**, tại 14:30 bằng **1**; snapshot sau B và sau A bị từ chối không đổi; tìm lại loại QA A01 khỏi khoảng 14–15. Kết quả tìm kiếm không đảm bảo ô còn trống đến lúc đặt; service phải kiểm tra và transaction lại khi POST.

## 7. Kiểm tra bổ trợ, phần chưa chạy và bàn giao

- Trên đúng SHA ứng dụng `30ee256…`: `npm run check` đạt (ESLint và **16 EJS**); `npm test` **37/37 PASS** trên MongoDB replica set cục bộ riêng. Đây là kiểm tra bổ trợ, không thay thế 41 ca HTTP/DB hoặc kiểm tra giao diện ở trên.
- Đã dừng đúng app QA và MongoDB riêng, xóa DB thử sau khi xác minh tên/marker/replica set; dữ liệu runtime tạm đã dọn. Không dừng MongoDB khác đang có trên máy.
- Không có ca bắt buộc nào của bộ lọc bị giả thành PASS từ lint hoặc từ đọc code. Đọc code chỉ dùng để xác định mong đợi; kết quả thực tế lấy từ request/DB/trình duyệt.

| Phần | Trạng thái | Lý do / việc cần làm |
| --- | --- | --- |
| Chạy lại trên `main` sau merge #34/#35 | **CHƯA CHẠY** | Main lúc QA chưa có hai phần này. Sau merge hoặc sửa nguồn cần ghi SHA mới và chạy lại ca bị ảnh hưởng; báo cáo hiện tại không phê duyệt bản chưa thử |
| Firefox, Safari và điện thoại thật | **CHƯA CHẠY** | Bài đã thử IAB ở hai viewport, không đánh đồng với mọi browser/thiết bị |
| Toàn luồng đặt sân #33, ngân hàng/QR thật | **KHÔNG THAY THẾ / NGOÀI PHẠM VI** | Bài #36 tập trung tìm kiếm và một ca tranh chấp POST; không kết luận đã hoàn tất #33 hoặc thanh toán thật |
| BUG-01 sau khi được sửa | **CHƯA RETEST** | Chờ nhóm trưởng phân công, có commit sửa mới chạy lại và thêm ảnh |

Nguồn đối chiếu: [controller](https://github.com/indominusrex932005-arch/dat-san-tu-dau/blob/30ee256133ac87417481ccf52407281af9e385e7/controllers/court.controller.js), [service tìm sân](https://github.com/indominusrex932005-arch/dat-san-tu-dau/blob/30ee256133ac87417481ccf52407281af9e385e7/services/court-search.service.js), [quy tắc ô](https://github.com/indominusrex932005-arch/dat-san-tu-dau/blob/30ee256133ac87417481ccf52407281af9e385e7/domain/booking-rules.js), [service đặt sân](https://github.com/indominusrex932005-arch/dat-san-tu-dau/blob/30ee256133ac87417481ccf52407281af9e385e7/services/booking.service.js), [view tìm kiếm](https://github.com/indominusrex932005-arch/dat-san-tu-dau/blob/30ee256133ac87417481ccf52407281af9e385e7/views/courts.ejs). [Mục lục ảnh và JSON](kiem-thu-tim-san/README.md).
