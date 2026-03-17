const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const controller = require('./manager.controller');
// Routes quản lý
router.get('/report', authenticate, authorize('manager','admin'), controller.groupReport);
router.post('/shifts', authenticate, authorize('manager','admin'), controller.assignShift);
// Quản lý thông tin nhân viên cùng phòng ban
router.get('/users', authenticate, authorize('manager','admin'), controller.listMyDepartment);
router.patch('/users/:id', authenticate, authorize('manager','admin'), controller.updateEmployeeInfo);
router.get('/departments', authenticate, authorize('manager','admin'), controller.listDepartments);
// Xem trước bảng lương theo phòng ban
router.get('/salary/preview', authenticate, authorize('manager','admin'), controller.salaryPreviewDepartment);
// Xử lý nghỉ việc cho nhân viên
router.post('/users/:id/resign', authenticate, authorize('manager','admin'), controller.resignEmployee);
// Phê duyệt yêu cầu cập nhật hồ sơ
router.get('/profile-change/pending', authenticate, authorize('manager','admin'), controller.listProfileChangePending);
router.get('/profile-change/:id', authenticate, authorize('manager','admin'), controller.getProfileChange);
router.patch('/profile-change/:id/status', authenticate, authorize('manager','admin'), controller.approveProfileChange);
module.exports = router;
