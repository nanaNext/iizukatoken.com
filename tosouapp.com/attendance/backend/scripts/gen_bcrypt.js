const bcrypt = require('bcrypt');
const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
const pwd = process.argv[2];
if (!pwd) {
  console.error('Usage: node scripts/gen_bcrypt.js <plaintext_password>');
  process.exit(1);
}
const hash = bcrypt.hashSync(pwd, rounds);
console.log(hash);
