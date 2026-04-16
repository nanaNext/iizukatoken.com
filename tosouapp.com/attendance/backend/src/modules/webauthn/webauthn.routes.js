const express = require('express');
const router = express.Router();
const controller = require('./webauthn.controller');

router.post('/register/options', controller.registerOptions);
router.post('/register/verify', controller.registerVerify);
router.post('/login/options', controller.loginOptions);
router.post('/login/verify', controller.loginVerify);

module.exports = router;
