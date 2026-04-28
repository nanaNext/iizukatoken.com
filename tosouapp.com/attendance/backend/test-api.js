#!/usr/bin/env node
const http = require('http');

function testApi(path) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          console.log(`\n✅ ${path}`);
          console.log('Status:', res.statusCode);
          console.log('Data:', JSON.stringify(JSON.parse(data), null, 2));
        } catch (e) {
          console.log('Raw:', data);
        }
        resolve();
      });
    });
    
    req.on('error', (e) => {
      console.log(`\n❌ ${path}`);
      console.log('Error:', e.message);
      resolve();
    });
  });
}

(async () => {
  console.log('Testing FAQ API...');
  await testApi('/api/faq');
  await testApi('/api/faq/debug/all-questions');
  process.exit(0);
})();
