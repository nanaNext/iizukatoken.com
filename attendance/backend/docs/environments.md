## Môi trường Staging và Production

### Mục tiêu

- Tách môi trường thử nghiệm (staging) và môi trường thật (production) để nâng cấp an toàn.
- Không ảnh hưởng người dùng đang sử dụng production khi deploy, chạy backfill, hoặc thay đổi schema.

### Cách nạp biến môi trường

Ứng dụng sẽ tự nạp các file theo thứ tự:

- .env
- .env.${NODE_ENV} (ví dụ: .env.production)
- .env.${APP_ENV} (ví dụ: .env.staging)
- .env.local

Bạn có thể dùng APP_ENV để phân biệt staging/production kể cả khi NODE_ENV đều là production.

### Thiết lập Staging

1) Copy file mẫu:

- Từ .env.staging.example thành .env.staging
  - Lưu ý: nếu không tạo `.env.staging` thì hệ thống sẽ chỉ đọc `.env` và có thể trỏ nhầm sang DB thật.

2) Dùng database riêng:

- DB_NAME=attendance_staging

3) Chạy server staging ở port riêng:

- PORT=3001

3b) Khởi tạo bảng cho staging (nếu DB mới tạo chưa có bảng):

- Mở PowerShell tại `attendance/backend` và chạy:
  - $env:APP_ENV="staging"; $env:NODE_ENV="production"; node scripts/init-db.js

4) Bật debug routes nếu cần:

- ENABLE_DEBUG_ROUTES=true

5) Tắt các scheduler của hệ thống (khuyến nghị cho staging):

- DISABLE_SCHEDULERS=true

### Thiết lập Production

1) Copy file mẫu:

- Từ .env.production.example thành .env.production

2) Dùng database thật:

- DB_NAME=attendance

3) Tắt debug routes:

- ENABLE_DEBUG_ROUTES=false

### Quy trình deploy an toàn

- Deploy staging trước, kiểm tra luồng:
  - 予定/実績/欠勤/休日 hiển thị đúng
  - ステータス: 承認待ち → 承認済み, hiển thị tên người duyệt
  - 作業報告 lưu sang 月次勤怠
- Khi staging ổn mới deploy production.

### Backfill dữ liệu 作業報告 → 月次勤怠

Endpoint:

- POST /api/admin/work-reports/backfill/daily

Ví dụ backfill theo tháng:

{
  "month": "2026-03"
}

Hoặc theo khoảng ngày:

{
  "fromDate": "2026-03-01",
  "toDate": "2026-03-31"
}

Có thể thêm userId để backfill 1 người:

{
  "month": "2026-03",
  "userId": 3
}
