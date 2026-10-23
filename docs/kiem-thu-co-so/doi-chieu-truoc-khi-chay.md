# Đối chiếu điều kiện trước khi chạy #17

Ghi nhận ngày **23/10/2026**, bằng đọc Git/API, **không chạy server, gửi form hoặc truy cập database**. Đây là bằng chứng chuẩn bị, không phải báo cáo ca chức năng đã chạy.

## Phiên bản đã đọc

- `main`: [`432e755b7fe6b56f42248261d8506a1f5ed00c29`](https://github.com/indominusrex932005-arch/dat-san-tu-dau/tree/432e755b7fe6b56f42248261d8506a1f5ed00c29).
- PR #13: [`cf5ad45247b0f64e8dbb2bb2316201313d370b0a`](https://github.com/indominusrex932005-arch/dat-san-tu-dau/tree/cf5ad45247b0f64e8dbb2bb2316201313d370b0a), nhánh `feat/backend-facilities`; API trả `state: open`, `merged: false` tại thời điểm đọc.
- [#9](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/9), [#10](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/10), [#16](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/16), [#17](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/17): còn mở; chưa có phần bàn giao đáp ứng đủ điều kiện thực thi #17 trong các nguồn này.

Đây là ảnh chụp trạng thái bằng văn bản tại thời điểm trên. Khi bắt đầu chạy, fetch/đọc lại trạng thái và ghi **SHA ứng dụng thực sự chạy**, không dùng SHA PR chưa tích hợp làm chứng cứ hoàn thành.

## Main hiện có gì

[`routes/facility.routes.js`](https://github.com/indominusrex932005-arch/dat-san-tu-dau/blob/432e755b7fe6b56f42248261d8506a1f5ed00c29/routes/facility.routes.js) chỉ khai báo `router.get('/', showFacilities)`, được gắn tại `/facilities` trong [`app.js`](https://github.com/indominusrex932005-arch/dat-san-tu-dau/blob/432e755b7fe6b56f42248261d8506a1f5ed00c29/app.js). [`controllers/facility.controller.js`](https://github.com/indominusrex932005-arch/dat-san-tu-dau/blob/432e755b7fe6b56f42248261d8506a1f5ed00c29/controllers/facility.controller.js) đọc `Facility.find()` rồi render danh sách.

Trên cây `main` này chưa có `views/facility-new.ejs`, `views/facility-edit.ejs` hoặc route POST cho cơ sở. Không có đủ luồng mở form → lưu → đọc lại để chạy #17.

## Thông tin chỉ có trong PR #13 chưa merge

Theo [route tại SHA PR](https://github.com/indominusrex932005-arch/dat-san-tu-dau/blob/cf5ad45247b0f64e8dbb2bb2316201313d370b0a/routes/facility.routes.js):

| Thao tác | Route trong PR chưa merge |
| --- | --- |
| Mở form thêm | `GET /facilities/new` |
| Lưu mới | `POST /facilities` |
| Mở form sửa | `GET /facilities/:id/edit` |
| Lưu sửa | `POST /facilities/:id/edit` |

Các đường dẫn này giúp đối chiếu khi được bàn giao; **không khẳng định đang tồn tại trên `main` hoặc là hợp đồng cuối cùng**. Sau khi merge/sửa lỗi phải đối chiếu lại route, view, action/method, biến EJS, lỗi, đích sau lưu và điều hướng #16.

## Điểm cần hồi quy về điện thoại

Trong `updateFacility` ở [controller của PR](https://github.com/indominusrex932005-arch/dat-san-tu-dau/blob/cf5ad45247b0f64e8dbb2bb2316201313d370b0a/controllers/facility.controller.js), đối tượng cập nhật truyền vào `Facility.findByIdAndUpdate(...)` còn biểu thức:

```js
phone: phone ? phone.trim() : undefined
```

Với chuỗi điện thoại rỗng, biểu thức trên cho giá trị `undefined`. Đây là **quan sát tĩnh**, chưa chứng minh kết quả cập nhật MongoDB hoặc khẳng định lỗi đã được sửa/tái hiện trong đợt này. [Issue #17](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/17) yêu cầu hồi quy thao tác xóa điện thoại rồi lưu; ca **F06** phải kiểm bằng lần đọc lại độc lập trên dữ liệu được phép sau khi đủ điều kiện.

Không sửa biểu thức này hoặc bất kỳ source/CI nào trong nhánh QA. Không thử lưu trên PR chưa tích hợp hoặc dùng dữ liệu giả lập để gắn kết quả ĐẠT cho điều kiện #17.

Quay lại [kế hoạch kiểm thử](../KIEM_THU_THEM_SUA_CO_SO.md) hoặc [quy ước bằng chứng](README.md).
