if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch {}
}

module.exports = {
  port: process.env.PORT,
  dbUrl: process.env.DB_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtSecretCurrent: process.env.JWT_SECRET_CURRENT || process.env.JWT_SECRET,
  jwtSecretPrevious: process.env.JWT_SECRET_PREVIOUS || '',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  accessTokenExpires: parseInt(process.env.ACCESS_TOKEN_EXPIRES || '1800', 10),
  refreshTokenExpiresDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10),
  resetTokenExpiresMinutes: parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES || '30', 10),
  timesheetMaxDays: parseInt(process.env.TIMESHEET_MAX_DAYS || '93', 10) || 0,
  companyName: process.env.COMPANY_NAME || ''
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
  disablePayslipUpload: String(process.env.DISABLE_PAYSLIP_UPLOAD || '').toLowerCase() === 'true',
  disablePayslipDownload: String(process.env.DISABLE_PAYSLIP_DOWNLOAD || '').toLowerCase() === 'true',
  maintenanceMode: String(process.env.MAINTENANCE_MODE || '').toLowerCase() === 'true'
  ,
  payslipEncKey: process.env.PAYSLIP_ENC_KEY || '',
  payslipKeyVersion: process.env.PAYSLIP_KEY_VERSION || 'v1'
};

