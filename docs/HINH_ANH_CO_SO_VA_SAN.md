# Ảnh cơ sở, sân và tổng bốn cơ sở mẫu

## Dùng chức năng trên web

OWNER đã được ADMIN cấp cơ sở mở `/owner`:

- Chọn **Sửa thông tin cơ sở** → **Ảnh cơ sở** để tải ảnh đại diện cho trang chủ/danh sách cơ sở.
- Chọn **Sửa sân và giá** → **Ảnh sân** để quản lý bộ ảnh của từng sân. Sân mới cần tạo xong trước khi thêm ảnh.
- Chọn file từ máy, xem trước, bấm **Tải ảnh lên**; có nút **Chọn đại diện** và **Xóa ảnh**. Mỗi cơ sở/sân tối đa 5 ảnh; mỗi lần một JPG/PNG/WebP, tối đa 5 MB.

Trang chủ hiển thị một ảnh cho mỗi cơ sở: ưu tiên ảnh cơ sở đã chọn, tiếp đến ảnh của sân con đã cập nhật. Chưa có ảnh thì dùng SVG vẽ riêng cho dự án, ghi **Ảnh minh họa**, không phải ảnh chụp địa điểm thật. Thẻ dẫn tới danh sách sân đã lọc đúng cơ sở. Danh sách sân có ảnh bìa; chi tiết sân có ảnh lớn và ảnh nhỏ bấm xem lớn.

## Tạo tài khoản Cloudinary và cấu hình

1. Đăng ký tại https://cloudinary.com/ và xác minh email.
2. Mở Console/API Keys, lấy **Cloud name**, **API Key**, **API Secret**. Vị trí menu có thể khác theo giao diện Cloudinary.
3. Điền ba giá trị vào `.env` riêng cạnh `package.json`; trên Render thì điền trong Environment của service:

   ```dotenv
   CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
   CLOUDINARY_API_KEY=YOUR_API_KEY
   CLOUDINARY_API_SECRET=YOUR_API_SECRET
   ```

4. Không commit giá trị thật vào `.env.example`, GitHub, chat hoặc ảnh chụp. Khởi động lại server, đăng nhập OWNER đã duyệt, tải thử ảnh trên form sửa cơ sở rồi mở trang chủ để kiểm tra.

Upload được ký từ backend; không cần unsigned upload preset. MongoDB lưu metadata/đường dẫn, file ở Cloudinary nên không mất theo ổ đĩa tạm của Render. Khi chưa cấu hình, chỉ phần tải ảnh bị khóa; các trang và đặt sân vẫn hoạt động với ảnh minh họa. Hiện chưa có tài khoản/secret Cloudinary thật trong môi trường thực thi: các kiểm thử upload dùng storage thay thế trên server và DB local, không phải kết luận đã nghiệm thu Cloudinary thật.

## Bổ sung tới tổng bốn cơ sở

```powershell
npm run seed
```

Lệnh seed trong repo đã bổ sung **Cơ sở mẫu Hải Châu**, **Cơ sở mẫu Thanh Khê**, **Cơ sở mẫu Sơn Trà**, mỗi cơ sở mới có hai sân. Địa chỉ ghi rõ minh họa, không có thông tin người thật.

DB trống sẽ có 4 cơ sở/8 sân gồm Demo MVC ban đầu. DB đã có 1–3 cơ sở sẽ giữ nguyên và chỉ thêm số mẫu còn thiếu tới tổng 4. DB đã có từ 4 cơ sở thì không thêm và không xóa. Chạy một tiến trình seed khi không có người khác đang tạo cơ sở. ID cố định giúp chạy lại sau đổi tên không tạo trùng. Không thêm lại sân vào cơ sở đã có, không đổi chủ, ảnh, giá hoặc liên hệ cũ. Mỗi cơ sở mới và hai sân được tạo trong cùng transaction.

Không tự seed khi khởi động server hoặc mở trang chủ. Tạo PR chưa đồng nghĩa đã thêm dữ liệu trên Atlas. Sau merge, nhóm trưởng chạy seed trên đúng DB phát triển/demo. ADMIN chọn **cơ sở có sẵn** khi duyệt OWNER; OWNER cập nhật số liên hệ trước khi nhận đặt.

## Xử lý và dọn ảnh

- Kiểm tra session, OWNER/APPROVED, quyền cơ sở và CSRF trước khi nhận file. Upload dùng header `X-CSRF-Token`; form thường vẫn dùng `_csrf`. Quyền được kiểm tra lại sau lần gọi storage.
- Không nhận URL/public ID do client tự đặt. Sharp giải mã file thật, từ chối định dạng khác/ảnh động/trên 40 megapixel, xoay đúng hướng và tạo WebP tối đa 1600×1200, không giữ metadata gốc.
- Upload có giới hạn riêng: mặc định 30/IP và 10/chủ sân trong 60 giây; mỗi instance xử lý tối đa hai upload đồng thời. Các biến tương ứng là `RATE_LIMIT_IMAGES_WINDOW_SECONDS`, `RATE_LIMIT_IMAGES_IP_MAX`, `RATE_LIMIT_IMAGES_ACTOR_MAX`.
- Cập nhật dùng `imageVersion` để chặn ghi đè khi gửi đồng thời. Form sửa thông tin thường không nhận các trường ảnh.
- Xóa ảnh cập nhật danh sách/ảnh bìa và lưu public ID vào `pendingImageDeletes` của cùng document. Nếu kho ảnh lỗi, ID vẫn còn để thử lại:

  ```powershell
  npm run images:cleanup
  ```

  Chạy lại sau khi storage phục hồi; lệnh chỉ dọn ID chờ xóa, không xóa ảnh đang hiển thị. Nếu upload xong nhưng DB lỗi, server thử xóa file vừa tạo. Nếu cả DB và storage cùng lỗi, kiểm tra tài nguyên mồ côi trong thư mục `dat-san/` trên Cloudinary; không đưa secret/token đặt sân vào log.

Các phần chính: model Facility/Court thêm ảnh và trường nội bộ; `owner-images.service.js` xử lý nghiệp vụ; `image-storage.js` gọi Cloudinary; `owner-images.routes.js` nhận file; `facility-catalog.service.js` lấy dữ liệu trang chủ/danh sách theo truy vấn hàng loạt; `demo-seed.service.js` bổ sung mẫu. View, `media.css`, `media.js` phụ trách hiển thị/xem trước. Không thay nghiệp vụ giữ chỗ, giá, thanh toán hay hủy/đổi.

Kiểm thử bổ sung ở `tests/owner-images.test.js`; chạy `npm run check` và toàn bộ `npm test` bằng MongoDB replica set local dùng một lần.
