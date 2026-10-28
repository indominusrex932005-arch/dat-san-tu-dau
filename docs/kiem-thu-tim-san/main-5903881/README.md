# Tái kiểm thử bộ lọc trên main sau #54 — issue #36

Kết quả trên **main `590388158f8f3982259dde43f311e7604f74437f`**: **41/41 ca HTTP/DB PASS**, **10/10 ca UI gốc PASS**; BUG-01 **PASS RETEST**. Hai quan sát UX OBS-01/02 vẫn còn, được ghi riêng bên dưới; kết quả này không có nghĩa giao diện đã hết mọi vấn đề. PR chỉ bổ sung tài liệu và bằng chứng.

## Phiên bản, môi trường và dữ liệu

| Mục | Thực tế |
| --- | --- |
| Issue / báo cáo cũ | [#36](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/36), [PR #51 đã merge](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/51) |
| SHA ứng dụng thật đã chạy | [590388158f8f3982259dde43f311e7604f74437f](https://github.com/indominusrex932005-arch/dat-san-tu-dau/tree/590388158f8f3982259dde43f311e7604f74437f), origin/main sau #45/#46/#52/#54/#55/#56/#57 |
| Bản sửa BUG-01 | [PR #54](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/54), đã có trong SHA trên; tiêu đề/vị trí cơ sở dùng overflow-wrap:anywhere |
| Thời gian | 24/10/2026 UTC+7; HTTP/DB hoàn tất **19:46:03** (2026-10-24T12:46:03.081Z); thời gian từng ảnh/DOM ghi trong JSON |
| Browser | ChatGPT in-app browser (IAB); công cụ không cung cấp phiên bản/build |
| Viewport | **390×844** và **1366×900**; cùng browser, chưa phải điện thoại thật |
| Runtime | Node **24.15.0**, MongoDB **8.3.11**; replica set riêng qaSearch36Main, bind 127.0.0.1:27056 |
| App | createApp/controller/service/query/EJS/CSS thật; server QA 127.0.0.1:3019. Không mock query hoặc đồng hồ |
| DB | **qa_search36main_1792845937362_8192f1**; 5 cơ sở, 15 sân; fixture D=27/10/2026, D+1=28/10/2026 |
| Phạm vi an toàn | Không đọc/sửa .env; không dùng Atlas. Dữ liệu tổng hợp trên DB riêng. Không sửa source ứng dụng |

[fixtures.json](fixtures.json) có bộ dữ liệu và chuỗi dài. Tên cơ sở, địa chỉ dài và tên sân 150 ký tự **giống chính xác fixture cũ**. Chỉ ID/DB/thời gian được tạo mới. Sân full có 32 ô BOOKED, held có HOLD còn hạn tại 14:30, booked tại 14:00, after tại 15:00; expired có hai timestamp hết hạn lùi 60 giây trên DB thử. Sau GET, expired vẫn còn trong DB. POST tranh chấp chạy sau snapshot GET sẽ dọn expired theo nghiệp vụ thật.

HTTP chạy qua TestBrowser/Node fetch với hai cookie jar riêng, không gọi đó là hai phiên trình duyệt đồ họa. Không chạy worker định kỳ của server.js trong bài snapshot; getAvailability/searchCourts và service đặt sân vẫn là code thật. Ảnh dùng viewport screenshot; thanh cuộn dọc 15px làm clientWidth=375/1351px, nên không suy viewport từ kích thước JPEG.

## Bảng HTTP/DB chạy lại

Các hàng dưới là **lần chạy mới trên main**, không phải đánh dấu lại kết quả cũ. Bước/mong đợi kế thừa ma trận đã bàn giao; thực tế được đối chiếu với [41 ca JSON mới](http-results.json), theo id. A/B là cơ sở; D=2026-10-27, D1=2026-10-28. Khoảng [14:00,15:00) cần đủ hai ô 14:00 và 14:30.

**Thay đổi hợp đồng tại HTTP-29:** main đã tích hợp bản từ chối query lặp (02dbe9c), trả 400 thay vì lấy chuỗi đầu như SHA UI cũ. Lần thăm dò dùng mong đợi cũ trả 40/41; sau đối chiếu backend, đã tạo lại DB và chạy lại toàn bộ ma trận, đạt 41/41. Đây là cập nhật mong đợi theo hợp đồng đã merge, không sửa ứng dụng để làm ca thử đạt.

| Mã ca | Bước thực hiện | Mong đợi | Kết quả thực tế | Trạng thái | Bằng chứng |
|---|---|---|---|---|---|
| HTTP-01 | GET không có bộ lọc. | HTTP 200; trả mọi sân active; chưa lọc khả năng nhận đặt nếu thiếu ngày. | HTTP 200; 14 sân: after, bFree, bLong, booked, edge, expired, free, full, held, invalidPhone, late, pastOnly, pending, unowned; không có inactive; không có alert lỗi. | PASS | [JSON · HTTP-01](http-results.json) |
| HTTP-02 | GET chỉ `facilityId=A`. | HTTP 200; chỉ sân active của A. | HTTP 200; 9 sân: after, booked, edge, expired, free, full, held, late, pastOnly. | PASS | [JSON · HTTP-02](http-results.json) |
| HTTP-03 | GET chỉ `facilityId=B`. | HTTP 200; chỉ sân active của B. | HTTP 200; 2 sân: bFree, bLong. | PASS | [JSON · HTTP-03](http-results.json) |
| HTTP-04 | GET chỉ `date=D`. | Cơ sở phải nhận đặt được; sân còn ít nhất một ô trống trong ngày; loại full. | HTTP 200; 10 sân: after, bFree, bLong, booked, edge, expired, free, held, late, pastOnly; full và ba sân thuộc cơ sở chưa đủ điều kiện đều vắng. | PASS | [JSON · HTTP-04](http-results.json) |
| HTTP-05 | GET chỉ `date=D1`. | Khóa của D không làm bận D1. | HTTP 200; 11 sân: after, bFree, bLong, booked, edge, expired, free, full, held, late, pastOnly; full xuất hiện lại trên D1. | PASS | [JSON · HTTP-05](http-results.json) |
| HTTP-06 | GET D, từ 14:00 đến 15:00, không chọn cơ sở. | Cả hai ô 14:00 và 14:30 phải trống; một ô HOLD hoặc BOOKED cũng loại sân; bỏ qua khóa hết hạn. | HTTP 200; 6 sân: after, bFree, bLong, edge, expired, free; held, booked, full bị loại. | PASS | [JSON · HTTP-06](http-results.json) |
| HTTP-07 | GET A, D, 14:00–15:00. | Kết hợp điều kiện cơ sở, ngày và toàn khoảng giờ. | HTTP 200; 4 sân: after, edge, expired, free. | PASS | [JSON · HTTP-07](http-results.json) |
| HTTP-08 | GET B, D, 14:00–15:00. | Không lẫn sân của A. | HTTP 200; 2 sân: bFree, bLong. | PASS | [JSON · HTTP-08](http-results.json) |
| HTTP-09 | GET A, D, 14:00–14:30. | HOLD bắt đầu đúng 14:30 nằm ngoài khoảng tìm; held được trả về. | HTTP 200; 5 sân: after, edge, expired, free, held; booked tại 14:00 vẫn bị loại. | PASS | [JSON · HTTP-09](http-results.json) |
| HTTP-10 | GET A, D, 14:30–15:00. | BOOKED tại 14:00 nằm trước khoảng tìm; booked được trả về. | HTTP 200; 5 sân: after, booked, edge, expired, free; held tại 14:30 bị loại. | PASS | [JSON · HTTP-10](http-results.json) |
| HTTP-11 | GET A, D, 13:30–14:30. | Loại edge vì sân mở lúc 14:00; không cho khớp một phần khoảng giờ. | HTTP 200; 4 sân: after, expired, free, held; edge vắng. | PASS | [JSON · HTTP-11](http-results.json) |
| HTTP-12 | GET A, D, 14:30–15:30. | Loại edge vì đóng lúc 15:00; loại after vì BOOKED tại 15:00. | HTTP 200; 3 sân: booked, expired, free. | PASS | [JSON · HTTP-12](http-results.json) |
| HTTP-13 | GET A, D, 22:00–22:30. | Không có sân phục vụ trọn khoảng ngoài giờ mở cửa. | HTTP 200; 0 sân; không có alert lỗi query. | PASS | [JSON · HTTP-13](http-results.json) |
| HTTP-14 | GET D với ObjectId cơ sở hợp lệ về dạng nhưng không tồn tại (`000000000000000000000000`). | Không lỗi máy chủ; danh sách rỗng. | HTTP 200; 0 sân; không có alert lỗi query. | PASS | [JSON · HTTP-14](http-results.json) |
| HTTP-15-unowned | GET D và cơ sở unowned. | Cơ sở chưa cấp chủ không khớp tìm theo ngày. | HTTP 200; 0 sân. | PASS | [JSON · HTTP-15-unowned](http-results.json) |
| HTTP-15-pending | GET D và cơ sở pending. | OWNER chưa APPROVED không đủ điều kiện nhận đặt. | HTTP 200; 0 sân. | PASS | [JSON · HTTP-15-pending](http-results.json) |
| HTTP-15-invalidPhone | GET D và cơ sở invalidPhone. | Điện thoại cơ sở sai không đủ điều kiện nhận đặt. | HTTP 200; 0 sân. | PASS | [JSON · HTTP-15-invalidPhone](http-results.json) |
| HTTP-16 | GET `facilityId=not-an-object-id`. | HTTP 400; lỗi cơ sở rõ ràng. | HTTP 400; 0 sân; alert “Cơ sở không hợp lệ.” | PASS | [JSON · HTTP-16](http-results.json) |
| HTTP-17 | GET `date=24/10/2026`. | HTTP 400 vì sai dạng ngày ISO. | HTTP 400; 0 sân; alert “Ngày không hợp lệ.” | PASS | [JSON · HTTP-17](http-results.json) |
| HTTP-18 | GET `date=2030-02-30`. | HTTP 400 vì ngày không tồn tại. | HTTP 400; 0 sân; alert “Ngày không tồn tại.” | PASS | [JSON · HTTP-18](http-results.json) |
| HTTP-19 | GET `date=2026-10-23`, trước hôm nay theo giờ Việt Nam. | HTTP 400 vì tìm ngày quá khứ. | HTTP 400; 0 sân; alert “Ngày tìm kiếm không được trong quá khứ.” | PASS | [JSON · HTTP-19](http-results.json) |
| HTTP-20 | GET D và chỉ `startTime=14:00`. | HTTP 400; yêu cầu đủ hai mốc giờ. | HTTP 400; 0 sân; alert “Vui lòng chọn đầy đủ cả giờ bắt đầu và giờ kết thúc.” | PASS | [JSON · HTTP-20](http-results.json) |
| HTTP-21 | GET D và chỉ `endTime=15:00`. | HTTP 400; yêu cầu đủ hai mốc giờ. | HTTP 400; 0 sân; cùng alert yêu cầu đủ giờ bắt đầu/kết thúc. | PASS | [JSON · HTTP-21](http-results.json) |
| HTTP-22 | GET 14:00–15:00 nhưng bỏ ngày. | HTTP 400; phải chọn ngày khi tìm theo giờ. | HTTP 400; 0 sân; alert “Vui lòng chọn ngày khi tìm theo khoảng giờ.” | PASS | [JSON · HTTP-22](http-results.json) |
| HTTP-23 | GET D, `startTime=14:15`, `endTime=15:00`. | HTTP 400; thời gian phải đúng bước 30 phút. | HTTP 400; 0 sân; alert “Giờ phải có dạng HH:00 hoặc HH:30.” | PASS | [JSON · HTTP-23](http-results.json) |
| HTTP-24 | GET D, `startTime=24:00`, `endTime=23:30`. | HTTP 400 vì 24:00 ngoài miền giờ hợp lệ. | HTTP 400; 0 sân; alert yêu cầu dạng HH:00 hoặc HH:30. | PASS | [JSON · HTTP-24](http-results.json) |
| HTTP-25 | GET D, 14:00–14:00. | HTTP 400 vì giờ kết thúc bằng giờ bắt đầu. | HTTP 400; 0 sân; alert “Giờ kết thúc phải sau giờ bắt đầu.” | PASS | [JSON · HTTP-25](http-results.json) |
| HTTP-26 | GET D, 15:00–14:00. | HTTP 400 vì khoảng giờ đảo ngược. | HTTP 400; 0 sân; alert “Giờ kết thúc phải sau giờ bắt đầu.” | PASS | [JSON · HTTP-26](http-results.json) |
| HTTP-27 | GET D, `startTime=8:00`, `endTime=15:00`. | HTTP 400 vì giờ thiếu chữ số đầu. | HTTP 400; 0 sân; alert yêu cầu dạng HH:00 hoặc HH:30. | PASS | [JSON · HTTP-27](http-results.json) |
| HTTP-28 | GET `date=2030-13-01`. | HTTP 400 vì tháng không tồn tại. | HTTP 400; 0 sân; alert “Ngày không tồn tại.” | PASS | [JSON · HTTP-28](http-results.json) |
| HTTP-29 | GET lặp `facilityId=A&facilityId=B`, D, 14–15. | Main hiện tại phải từ chối tham số lặp; không chọn tùy tiện một cơ sở. | HTTP 400; 0 sân; “Tham số tìm kiếm không được lặp lại.”; ô cơ sở rỗng. Mong đợi đã cập nhật theo backend tích hợp. | PASS | [JSON · HTTP-29](http-results.json) |
| HTTP-30 | GET A, D, 14:00–15:00 nhưng bọc mỗi giá trị query bằng khoảng trắng. | Trim giá trị chuỗi rồi tìm bình thường. | HTTP 200; 4 sân after, edge, expired, free; không có alert. | PASS | [JSON · HTTP-30](http-results.json) |
| HTTP-31 | GET A, D, 14:00–15:00 rồi tải lại cùng URL. | Giữ đúng bốn giá trị bộ lọc; kết quả không đổi khi tải lại. | Form trả về A, 2026-10-27, 14:00, 15:00; `reloadStable=true`. Đây là kiểm tra HTML phản hồi, thao tác trình duyệt được ghi riêng. | PASS | [JSON · HTTP-31](http-results.json) |
| HTTP-32 | Tìm A, D, 22:00–22:30; kiểm tra thông báo rỗng và href reset; GET `/courts`. | Có thông báo không khớp bộ lọc; reset về danh sách và xóa cả bốn trường. | Có thông báo rỗng; href reset `/courts`; trả lại đủ 14 sân active; facility/date/start/end đều rỗng. | PASS | [JSON · HTTP-32](http-results.json) |
| HTTP-33 | Tìm B, D, 14:00–15:00; đọc card bLong; GET liên kết chi tiết của card. | Giữ đủ tên dài, không chèn thẻ thực thi; ngày D đi từ href sang lịch và form đặt. | Danh sách/chi tiết đều HTTP 200; đủ 150 ký tự tên; không có thẻ thực thi trong card; cả input lịch và hidden ngày đặt đều `2026-10-27`. | PASS | [JSON · HTTP-33](http-results.json) |
| HTTP-34 | GET facilityId chứa payload thẻ ảnh có `onerror`, cùng D và 14:00–15:00. | Từ chối query; không đưa payload thành thẻ thực thi trong HTML. | HTTP 400; có lỗi cơ sở rõ ràng; không có payload thô hoặc thẻ ảnh mang onerror trong phản hồi. | PASS | [JSON · HTTP-34](http-results.json) |
| HTTP-35 | GET ngày hôm nay; đối chiếu giờ Việt Nam và sân pastOnly chỉ mở 00:00–00:30. | Không trả sân chỉ có giờ đã qua; ngày đúng UTC+7. | HTTP 200; 19:46 ngày 24/10/2026; pastOnly vắng; còn 6 sân. Không dùng số lượng 10 sân lúc 00:48 của lần cũ. | PASS | [JSON · HTTP-35](http-results.json) |
| HTTP-36 | GET `/assets/css/courts.css` và `/assets/css/demo.css`. | Hai tài nguyên CSS có thể tải qua HTTP. | Cả hai trả HTTP 200; ca này không kết luận về bố cục đã render. | PASS | [JSON · HTTP-36](http-results.json) |
| HTTP-37 | So count và SHA-256 bốn collection trước/sau toàn bộ GET trên; đọc lại fixture expired. | GET tìm kiếm/chi tiết không tạo, sửa hoặc xóa dữ liệu đặt sân; expired lock chỉ bị bỏ qua khi tính khả dụng. | Count trước/sau bằng nhau: Booking 5, SlotLock 36, Payment 3, BookingRequest 0; cả bốn digest không đổi; đơn expired vẫn HOLD và còn 1 lock lưu DB. | PASS | [JSON · HTTP-37](http-results.json) |
| HTTP-38 | Tạo hai cookie jar độc lập; GET `/login` để nhận CSRF; cả hai GET D, 14:00–15:00. | Hai phiên đều nhìn thấy free; chỉ tìm kiếm không giữ ô. | Hai phản hồi HTTP 200; cookie phiên khác nhau; cả hai có free; digest/count dữ liệu nghiệp vụ không đổi. | PASS | [JSON · HTTP-38](http-results.json) |
| HTTP-39 | Phiên B POST `/bookings` giữ free lúc 14:30; phiên A POST từ kết quả cũ với cả 14:00 và 14:30; kiểm tra DB rồi GET tìm lại. | B giữ thành công; A bị xung đột, không giữ một phần; tải lại phải loại free khỏi khoảng 14:00–15:00. | B HTTP 303 về checkout; A HTTP 409; lock 14:00 = 0, lock 14:30 = 1; count/digest sau B và sau A không đổi; GET lại không có free. | PASS | [JSON · HTTP-39](http-results.json) |

HTTP-37: count Booking/SlotLock/Payment/BookingRequest vẫn **5/36/3/0**, digest trước/sau bằng nhau; expired vẫn HOLD với 1 lock lưu DB. HTTP-38: hai session khác nhau cùng thấy free, GET không ghi dữ liệu. HTTP-39: B giữ 14:30 → **303**, A gửi lịch cũ 14:00+14:30 → **409**; lock 14:00=0, lock 14:30=1; snapshot sau B và sau A không đổi. Tìm lại loại free. Tìm kiếm không giữ chỗ và không đảm bảo ô còn trống đến lúc POST.

## Bảng UI chạy lại

[browser-results.json](browser-results.json) ghi số đo DOM, giá trị bộ lọc, chuỗi focus, ngày chuyển sang detail và thời gian chụp. 10 mã UI dưới kế thừa tiêu chí của báo cáo cũ; hai quan sát bổ sung được giữ riêng, không bị bỏ qua bởi kết luận PASS.

| Mã | Bước | Mong đợi | Thực tế | Trạng thái | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| UI-01 | 1366×900: chọn B, D, 14–15; Tìm sân; reload | Hai sân B, giữ cả bốn giá trị, tên dài không tràn | 2 sân; form giữ đúng; document 1351/1351, card 377/377px; tên `<em>` là văn bản | PASS | [Ảnh](thuong-desktop-1366.jpg), JSON captures |
| UI-02 | Cùng kết quả ở 390×844 | Một cột, form/thẻ trong khung | document 375/375; card 333/333px; chuỗi cơ sở dài xuống dòng | PASS | [Form](thuong-mobile-390.jpg), [thẻ dài](the-ten-dai-mobile-390.jpg) |
| UI-03 | Desktop B, D, 19–20 | 0 sân, thông báo rỗng, giữ bộ lọc/reset | 0 sân; đúng thông báo và 4 trường; 1351/1351px | PASS | [Ảnh](rong-desktop-1366.jpg) |
| UI-04 | Ca rỗng trên mobile | Dễ đọc, không tràn | 0 sân; 375/375px; thông báo và link reset đọc được | PASS | [Ảnh](rong-mobile-390.jpg) |
| UI-05 | Desktop B, D, 14–13 | Báo lỗi giờ, giữ các giá trị, không 500 | 400 qua HTTP; giá trị đúng; 1351/1351px. Có hai alert và khối rỗng: OBS-01/02 | PASS theo tiêu chí gốc, còn OBS | [Ảnh](loi-desktop-1366.jpg) |
| UI-06 | Ca lỗi trên mobile | Alert đọc được, form còn dùng được, không tràn | Đúng thông báo; 14:00/13:00 giữ nguyên; 375/375px. Cùng OBS-01/02 | PASS theo tiêu chí gốc, còn OBS | [Ảnh](loi-mobile-390.jpg), [form lỗi](loi-thong-bao-mobile-390.jpg) |
| UI-07 | Desktop: Tab từ cơ sở qua ngày/giờ; Enter tìm; Tab đến reset, Enter | Focus rõ, gửi/reset được | Outline solid; Enter trả 2 sân B; reset 14 sân, 4 trường rỗng | PASS | [Focus](focus-desktop-1366.jpg), JSON keyboard[viewport=1366] |
| UI-08 | Cùng thao tác bàn phím trên mobile | Không kẹt focus, tìm/reset được | Qua đủ ngày/hai mốc/nút; Enter 2 sân, reset 14 sân và 4 trường rỗng | PASS | [Focus](focus-mobile-390.jpg), JSON keyboard[viewport=390] |
| UI-09 | Từ kết quả B,D,14–15 mở B01 ở cả hai viewport | Detail vẫn ngày D, chưa chọn/giữ ô | URL ?date=2026-10-27, input lịch đúng D, 0 ô được chọn; ngày hidden đối chiếu riêng bằng HTTP-33 | PASS | [Desktop](chi-tiet-desktop-1366.jpg), [mobile](chi-tiet-mobile-390.jpg), JSON detail |
| UI-10 | B01 cơ sở dài ở 390px; thêm B02 tên sân 150 ký tự, reload | BUG-01 hết; chữ xuống dòng trong khung | B01 và B02 document 375/375px; tiêu đề/vị trí 335/335px; overflow-wrap:anywhere. Reload B02 vẫn đạt | **PASS RETEST — BUG-01** | [B01](chi-tiet-mobile-390.jpg), [B02](chi-tiet-ten-san-dai-mobile-390.jpg), JSON detail |

Input ngày/giờ native có nhiều phần nên trace có thể lặp cùng ID trước khi Tab sang ô kế tiếp. Ảnh focus chụp trước Enter trên kết quả hợp lệ; kết quả gửi/reset sau Enter nằm trong JSON. Browser không ghi nhận console error trong phiên QA. Chưa thử Firefox/Safari/điện thoại thật; không suy rộng kết quả IAB sang mọi thiết bị.

## BUG-01 và các quan sát còn lại

- **BUG-01: PASS RETEST trên main 5903881 sau #54.** Với đúng tên cơ sở cũ, document mobile giảm từ **1241 > 375px** trong bằng chứng lịch sử xuống **375 = 375px**; đoạn cơ sở/địa chỉ từ 1221 > 335px xuống **335 = 335px**. Desktop đạt **1351 = 1351px**, đoạn chữ 1100 = 1100px. Không còn tái hiện lỗi tràn. Ảnh cũ vẫn giữ để truy vết.
- **OBS-01: CÒN.** Query sai vẫn có khối “Không tìm được sân phù hợp bộ lọc.”, dễ bị hiểu là truy vấn hợp lệ nhưng không khớp. [Ảnh desktop](loi-desktop-1366.jpg).
- **OBS-02: CÒN — thông báo validation bị lặp.** Một query 14–13 tạo **2 role=alert giống nhau** ở cả hai viewport. Mong đợi UX: một thông báo đủ rõ. Thực tế: đầu main và trong form cùng hiển thị “Giờ kết thúc phải sau giờ bắt đầu.”. Tái hiện bằng B,D,14:00–13:00 → Tìm sân. Vị trí đối chiếu trên SHA này: views/courts.ejs khối _filterError và khối filterError. Có [ảnh mobile](loi-mobile-390.jpg) và mảng alerts trong JSON. Đề xuất xử lý riêng; PR QA không sửa source.

## Kiểm tra bổ trợ, tái lập và bàn giao

- npm run check **PASS**: ESLint + **17 EJS**. npm test **111/111 PASS**, không fail/skip. [verification.json](verification.json). Không dùng lint thay thử HTTP/DB hoặc trình duyệt.
- Để tái lập: checkout đúng SHA trên, MongoDB replica set localhost riêng; tạo DB mới theo fixtures.json; tạo HOLD/DEMO_PAID bằng route thật, chỉ lùi expiry của expired trên DB thử; chạy GET trước POST tranh chấp rồi thử UI theo bảng. Không dùng ID đã dọn hoặc Atlas chung.
- [cleanup.json](cleanup.json) ghi việc xóa đúng DB QA có marker, xác minh replica set, dừng app/replica QA; không tác động dữ liệu thật.
- Chỉ docs thay đổi; không thay code bộ lọc/đặt sân. Báo cáo là bằng chứng trên SHA đã chạy; commit PR bổ sung chỉ thêm docs, không được gán kết quả này cho source thay đổi sau đó.
- Không thay kiểm thử toàn luồng issue #33, không chứng minh thanh toán ngân hàng/QR thật; dữ liệu DEMO_PAID chỉ mô phỏng. Nhóm trưởng review kết quả và quyết định đóng #36; OBS-01/02 cần quyết định xử lý riêng.
