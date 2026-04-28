// Test API trực tiếp để check data
const http = require('http');

function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n=== ${method} ${path} ===`);
        console.log(`Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log(JSON.stringify(json, null, 2));
        } catch {
          console.log(data);
        }
        resolve();
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    console.log('🧪 Testing FAQ Debug APIs...\n');
    
    // 1. Get all FAQ items
    await makeRequest('GET', '/api/faq');
    
    // 2. Get all user questions (debug)
    await makeRequest('GET', '/api/faq/debug/all-questions');
    
    console.log('\n✅ Test complete!');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

main();
