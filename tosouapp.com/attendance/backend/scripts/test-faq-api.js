const axios = require('axios');

async function testFaqApi() {
  try {
    console.log('Testing FAQ API...\n');

    // Test 1: Get FAQ items (public)
    console.log('1️⃣ GET /api/faq (get FAQ items)');
    const faqRes = await axios.get('http://localhost:3000/api/faq');
    console.log('✓ Status:', faqRes.status);
    console.log('✓ Items:', faqRes.data.data.length, 'FAQ items');
    console.log('');

    // Test 2: Get categories (public)
    console.log('2️⃣ GET /api/faq/categories (get categories)');
    const catRes = await axios.get('http://localhost:3000/api/faq/categories');
    console.log('✓ Status:', catRes.status);
    console.log('✓ Categories:', catRes.data.data);
    console.log('');

    // Test 3: Create question (requires auth - will fail without token)
    console.log('3️⃣ POST /api/faq/questions (submit question - should fail without auth)');
    try {
      const qRes = await axios.post('http://localhost:3000/api/faq/questions', {
        question: 'テスト質問',
        detail: 'これはテストです',
        category: 'テスト'
      });
      console.log('✓ Status:', qRes.status);
    } catch (e) {
      console.log('✗ Expected error (no auth):', e.response?.status, e.response?.data?.message);
    }
    console.log('');

    console.log('✅ API endpoints are working!');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

testFaqApi();
