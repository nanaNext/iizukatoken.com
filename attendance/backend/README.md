# iizukatoken.com Attendance System

## Giới thiệu
Hệ thống chấm công dành cho công ty Nhật, hỗ trợ quản lý thời gian làm việc, tăng ca, phòng ban, lương, và phân quyền người dùng.

## Cấu trúc thư mục chính
- `src/` - Mã nguồn backend
  - `modules/` - Các module chức năng (auth, attendance, salary, payslip, users, ...)
  - `core/` - Thành phần lõi (database, middleware, errors, logging, metrics)
  - `config/` - Cấu hình hệ thống và biến môi trường
  - `routes/` - Định tuyến API (mount tất cả modules vào `/api/*`)
  - `services/` - Dịch vụ dùng chung (ví dụ server)
  - `utils/` - Tiện ích
  - `static/` - Tài nguyên tĩnh (css/js/html trang nội bộ)
  - `uploads/` - Tài nguyên upload (bị ignore khi commit)
- `tests/` - Thư mục test (placeholder, chưa cấu hình runner)
- `docker/` - Dockerfile & docker-compose (chỉ dùng cho local/dev)

## Hướng dẫn cài đặt
1. Clone repository về máy:
   ```sh
   git clone <repo-url>
   ```
2. Cài đặt dependencies:
   ```sh
   cd attendance/backend
   npm install
   ```
3. Tạo file `.env` dựa trên `config/env.js` (không commit file `.env`).
   - Biến tối thiểu: `PORT`, `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `JWT_SECRET`
   - Có thể tách môi trường bằng các file: `.env.staging`, `.env.production` và dùng `APP_ENV` để chọn.
   - Xem hướng dẫn: `docs/environments.md`
4. Khởi động database (MySQL) và điền thông tin kết nối.
5. Chạy ứng dụng (dev):
   ```sh
   npm start
   ```

## Hướng dẫn chạy bằng Docker
1. Cài Docker và Docker Compose.
2. Chạy lệnh:
   ```sh
   docker-compose up --build
   ```

## Test
- Hiện chưa cấu hình test runner. Thư mục `tests/` là placeholder.
- Khi cần, thêm Jest/Vitest/Mocha và scripts tương ứng trong `package.json`.

## Swagger API docs
Truy cập http://localhost:3000/api-docs để xem tài liệu API tự động sinh.

## Đóng góp & Hỗ trợ
- Vui lòng tạo issue hoặc pull request nếu bạn muốn đóng góp hoặc báo lỗi.
- Liên hệ: [nana123thanhcong@gmail.com]
