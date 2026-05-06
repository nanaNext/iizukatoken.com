require('./loadEnv');

module.exports = {
  port: process.env.PORT,
  appBaseUrl: process.env.APP_BASE_URL || '',
  dbUrl: process.env.DB_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtSecretCurrent: process.env.JWT_SECRET_CURRENT || process.env.JWT_SECRET,
  jwtSecretPrevious: process.env.JWT_SECRET_PREVIOUS || '',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  accessTokenExpires: parseInt(process.env.ACCESS_TOKEN_EXPIRES || '900', 10),
  refreshTokenExpiresDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10),
  idleTimeoutSeconds: parseInt(process.env.IDLE_TIMEOUT_SECONDS || '1500', 10),
  resetTokenExpiresMinutes: parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES || '30', 10),
  timesheetMaxDays: parseInt(process.env.TIMESHEET_MAX_DAYS || '93', 10) || 0,
  companyName: process.env.COMPANY_NAME || '飯塚塗研株式会社'
  ,
  salaryBaseMonthly: parseInt(process.env.SALARY_BASE_MONTHLY || '0', 10),
  salaryEmploymentAllowance: parseInt(process.env.SALARY_EMPLOYMENT_ALLOWANCE || '0', 10),
  salaryWorkingMinutesPerMonth: parseInt(process.env.SALARY_WORKING_MINUTES_PER_MONTH || String(160 * 60), 10),
  salaryOvertimeRate: parseFloat(process.env.SALARY_OVERTIME_RATE || '1.25'),
  salaryLateNightRate: parseFloat(process.env.SALARY_LATE_NIGHT_RATE || '1.35'),
  salaryHolidayRate: parseFloat(process.env.SALARY_HOLIDAY_RATE || '1.35'),
  salaryRoundingMinutes: parseInt(process.env.SALARY_ROUNDING_MINUTES || '5', 10),
  salaryRoundingMode: process.env.SALARY_ROUNDING_MODE || 'half_up',
  salaryHealthRate: parseFloat(process.env.SALARY_HEALTH_RATE || '0'),
  salaryCareRate: parseFloat(process.env.SALARY_CARE_RATE || '0'),
  salaryPensionRate: parseFloat(process.env.SALARY_PENSION_RATE || '0'),
  salaryEmploymentInsuranceRate: parseFloat(process.env.SALARY_EMPLOYMENT_INSURANCE_RATE || '0'),
  salaryTaxRate: parseFloat(process.env.SALARY_TAX_RATE || '0'),
  salaryRentDeduction: parseInt(process.env.SALARY_RENT_DEDUCTION || '0', 10)
  ,
  mailProvider: process.env.MAIL_PROVIDER || '',
  mailApiKey: process.env.MAIL_API_KEY || '',
  mailFrom: process.env.MAIL_FROM || '',
  companySupportEmail: process.env.COMPANY_SUPPORT_EMAIL || '',
  disablePayslipUpload: String(process.env.DISABLE_PAYSLIP_UPLOAD || '').toLowerCase() === 'true',
  disablePayslipDownload: String(process.env.DISABLE_PAYSLIP_DOWNLOAD || '').toLowerCase() === 'true',
  maintenanceMode: String(process.env.MAINTENANCE_MODE || '').toLowerCase() === 'true'
  ,
  payslipEncKey: process.env.PAYSLIP_ENC_KEY || '',
  payslipKeyVersion: process.env.PAYSLIP_KEY_VERSION || 'v1',
  leaveGrantMode: String(process.env.LEAVE_GRANT_MODE || 'HYBRID').toUpperCase()
};

