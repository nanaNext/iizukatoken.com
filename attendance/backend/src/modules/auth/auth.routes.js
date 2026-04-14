/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Các API xác thực người dùng
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Đăng ký người dùng mới
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo tài khoản thành công
 *       409:
 *         description: Email đã tồn tại
 */
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập hệ thống
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       401:
 *         description: Sai thông tin đăng nhập
 */
const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { rateLimit } = require('../../core/middleware/rateLimit');
const { body } = require('express-validator');
const { authenticate } = require('../../core/middleware/authMiddleware');

router.post('/login',
  rateLimit({ windowMs: 60_000, max: 10 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  authController.login
);
router.get('/me',
  authenticate,
  authController.me
);
router.post('/signup',
  body('username').isLength({ min: 2 }),
  body('email').isEmail(),
  body('password').isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 }),
  authController.signup
);
router.post('/forgot-password',
  rateLimit({ windowMs: 60_000, max: 10 }),
  body('email').isEmail(),
  body('birthDate').isISO8601().withMessage('birthDate must be YYYY-MM-DD'),
  body('employeeCode').isLength({ min: 2 }).withMessage('employeeCode is required'),
  authController.forgotPassword
);
router.post('/reset-password',
  rateLimit({ windowMs: 60_000, max: 10 }),
  body('token').isLength({ min: 10 }),
  body('newPassword').isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 }),
  authController.resetPassword
);
router.post('/super-reset',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('code').isLength({ min: 6 }),
  authController.superReset
);
router.post('/super-bootstrap',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('code').isLength({ min: 6 }),
  authController.superBootstrap
);
router.post('/refresh',
  rateLimit({ windowMs: 60_000, max: 30 }),
  body('refreshToken').optional().isLength({ min: 10 }),
  authController.refresh
);
router.post('/logout',
  body('refreshToken').optional().isLength({ min: 10 }),
  authController.logout
);
router.post('/revoke-all',
  authenticate,
  authController.revokeAll
);

module.exports = router;
