# Hướng dẫn chạy dự án và quy trình làm việc nhóm

Tài liệu này hướng dẫn các thành viên trong nhóm cách thiết lập môi trường, chạy dự án và tuân thủ quy trình Git khi phát triển hệ thống **Quản lý đặt sân thể thao** (`dat-san-tu-dau`).

---

## 1. Yêu cầu môi trường

- **Node.js**: Phiên bản 24.x LTS (kiểm tra bằng lệnh `node -v`).
- **Git**: Đã cài đặt trên máy và cấu hình thông tin cá nhân:
  ```bash
  git config --global user.name "Họ và Tên của bạn"
  git config --global user.email "email-cua-ban@gmail.com"
  ```
- **MongoDB Atlas**: Tài khoản có quyền truy cập vào cơ sở dữ liệu phát triển của dự án.

---

## 2. Lấy mã nguồn dự án

### Trường hợp 1: Lấy mã nguồn lần đầu (Clone repo)
Nếu bạn chưa có mã nguồn trên máy, mở terminal tại thư mục làm việc và chạy:
```bash
git clone https://github.com/indominusrex932005-arch/dat-san-tu-dau.git
cd dat-san-tu-dau
```

### Trường hợp 2: Cập nhật mã nguồn đã có sẵn (Pull repo)
Nếu bạn đã clone dự án từ trước, hãy chắc chắn nhánh `main` trên máy được cập nhật mới nhất với máy chủ:
```bash
git switch main
git pull --ff-only origin main
```

---

## 3. Cài đặt thư viện và cấu hình môi trường

### 3.1. Cài đặt thư viện phụ thuộc
Chạy lệnh `npm ci` để cài đặt chính xác các thư viện theo phiên bản được khóa trong `package-lock.json`:
```bash
npm ci
```
*(Lưu ý: Dùng `npm ci` thay vì `npm install` để đảm bảo môi trường đồng nhất giữa các thành viên và CI).*

### 3.2. Cấu hình biến môi trường (`.env`)
1. Tạo file `.env` từ file mẫu:
   - Trên Windows PowerShell:
     ```powershell
     if (-not (Test-Path .env)) { Copy-Item .env.example .env }
     ```
   - Trên macOS / Linux:
     ```bash
     cp -n .env.example .env
     ```
2. Liên hệ **nhóm trưởng** qua kênh trao đổi nội bộ để nhận chuỗi kết nối MongoDB Atlas cho môi trường phát triển.
3. Điền chuỗi kết nối vào file `.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. **Quyền truy cập mạng**: Nhờ nhóm trưởng thêm địa chỉ IP mạng máy tính của bạn vào danh sách **Network Access** (IP Whitelist) trên MongoDB Atlas.

> [!CAUTION]
> **Tuyệt đối không đưa file `.env` hoặc chuỗi kết nối chứa mật khẩu thật lên GitHub, Pull Request hay bình luận Issue!** File `.env` đã được đưa vào `.gitignore`.

---

## 4. Chạy và kiểm tra dự án

### 4.1. Khởi động ứng dụng
- **Chế độ phát triển (khuyên dùng khi lập trình):**
  ```bash
  npm run dev
  ```
  Lệnh này sử dụng cờ `--watch` của Node.js, server sẽ tự khởi động lại mỗi khi bạn lưu file.
- **Chế độ thông thường:**
  ```bash
  npm start
  ```
  *(hoặc `node server.js`)*

Sau khi khởi động thành công, mở trình duyệt và truy cập:
👉 **`http://localhost:3000`**

### 4.2. Kiểm tra chất lượng mã nguồn (Linting)
Trước khi commit, luôn chạy linter để đảm bảo code sạch và tuân thủ chuẩn JavaScript:
```bash
npm run lint
```
Lệnh này kiểm tra mã nguồn bằng ESLint. Mọi lỗi cú pháp hoặc vi phạm chuẩn cần được sửa hết trước khi đẩy lên Git.

### 4.3. Hiểu về hệ thống CI (GitHub Actions)
- Mỗi khi bạn mở Pull Request hoặc push commit lên nhánh chính, hệ thống CI tự động chạy quy trình kiểm tra `npm run lint`.
- **Lưu ý quan trọng**: CI chỉ kiểm tra mã nguồn JavaScript, **không tự kiểm tra giao diện**. Vì vậy, bạn **bắt buộc phải tự mở trình duyệt** để kiểm tra giao diện EJS/CSS ở cả hai kích thước màn hình:
  - Máy tính: **1366px** (Desktop)
  - Điện thoại: **390px** (Mobile)
  Đảm bảo không bị cuộn ngang, vỡ khung hoặc tràn chữ.

---

## 5. Quy trình làm việc với Git & GitHub

Để đảm bảo lịch sử Git rõ ràng và tránh xung đột code, tất cả thành viên bắt buộc tuân theo quy trình sau:

### Bước 1: Nhận task trên GitHub Issues
1. Truy cập mục **Issues** trên repo GitHub.
2. Chọn một Issue đang mở phù hợp với phần việc của mình.
3. Ở mục **Assignees** bên phải, bấm **assign yourself** (hoặc bình luận để nhóm trưởng gán).
4. Đọc kỹ mục tiêu, điều kiện bắt đầu và giới hạn phạm vi của Issue.

### Bước 2: Tạo nhánh riêng từ `main` mới nhất
Luôn kéo code mới nhất từ `main` trước khi rẽ nhánh:
```bash
git switch main
git pull --ff-only origin main
git switch -c <loai-nhanh>/<ten-ngan-gon>
```
*Quy ước đặt tên nhánh:*
- Tính năng / Giao diện mới: `feat/<ten-tinh-nang>` (Ví dụ: `feat/ui-facility-new`)
- Viết tài liệu: `docs/<ten-tai-lieu>` (Ví dụ: `docs/team-guide`)
- Sửa lỗi: `fix/<ten-loi>` (Ví dụ: `fix/db-connection`)

### Bước 3: Lập trình trong phạm vi quy định
- Chỉ sửa các file nằm trong phạm vi được giao của Issue.
- Dự án sử dụng cấu trúc thư mục MVC chuẩn ở thư mục gốc (`controllers`, `models`, `routes`, `views`, `public`), **không tạo thêm thư mục `src`**.
- Không tự ý sửa các file dùng chung hoặc file của thành viên khác khi chưa trao đổi với nhóm trưởng.

### Bước 4: Kiểm tra trước khi commit
```bash
npm run lint
```
Mở trình duyệt kiểm tra thực tế giao diện và tính năng.

### Bước 5: Commit và Push
Viết commit message theo chuẩn Conventional Commits, ngắn gọn, có ý nghĩa và ghi số Issue liên kết:
```bash
git add <cac-file-thay-doi>
git commit -m "docs: huong dan chay du an va quy trinh git (#6)"
git push -u origin <ten-nhanh>
```

### Bước 6: Mở Pull Request (PR) và hoàn tất
1. Lên GitHub, bấm **Compare & pull request** từ nhánh của bạn vào nhánh `main`.
2. Tiêu đề PR rõ ràng, mô tả tóm tắt những gì đã làm, file đã sửa, các bước kiểm tra.
3. **Bắt buộc** ghi từ khóa liên kết Issue ở phần mô tả (ví dụ: `Closes #6`) để GitHub tự động đóng Issue khi PR được merge.
4. Đính kèm ảnh chụp màn hình kiểm tra (đối với các task UI).
5. Chờ GitHub Actions chạy kiểm tra lint. Nếu có lỗi, sửa và commit push tiếp lên nhánh đó.
6. Thông báo cho nhóm trưởng và đồng đội review code.
7. **Nhóm trưởng là người duyệt và bấm Merge PR** vào `main`. Không tự ý merge hoặc push thẳng vào `main`.
