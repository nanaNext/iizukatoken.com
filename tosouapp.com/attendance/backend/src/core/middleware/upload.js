const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Cấu hình nơi lưu file và tên file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../../uploads/');
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    cb(null, dir); // Thư mục lưu file
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Giới hạn loại file và dung lượng (ảnh điện thoại thường lớn hơn 2MB)
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    if (ok) cb(null, true);
    else cb(new Error('Chỉ cho phép upload ảnh hoặc PDF!'), false);
  }
});

module.exports = upload;
