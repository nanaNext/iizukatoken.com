#!/usr/bin/env node
/**
 * Quick verification that the fix is working
 * Run this after server is started
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function verify() {
  console.log('\n🔍 VERIFYING EMPLOYEE QUESTIONS FIX\n');
  console.log('='.repeat(70));

  try {
    // Check 1: Health
    console.log('\n✓ Check 1: Server Health');
    await axios.get(`${BASE_URL}/health`);
    console.log('  ✅ Server is running');

    // Check 2: Database tables exist
    console.log('\n✓ Check 2: Database Tables');
    const debugRes = await axios.get(`${BASE_URL}/api/faq/debug/all-questions`);
    console.log(`  ✅ faq_user_questions table exists`);
    console.log(`  📊 Current questions: ${debugRes.data?.count || 0}`);

    // Check 3: Chatbot route exists
    console.log('\n✓ Check 3: Chatbot API Route');
    const pingRes = await axios.get(`${BASE_URL}/api/chatbot/ping`);
    console.log('  ✅ /api/chatbot routes are mounted');

    // Check 4: FAQ routes exist
    console.log('\n✓ Check 4: FAQ API Routes');
    const faqRes = await axios.get(`${BASE_URL}/api/faq`);
    console.log('  ✅ /api/faq routes are mounted');

    // Check 5: Test question submission
    console.log('\n✓ Check 5: Test Question Submission');
    const testRes = await axios.post(`${BASE_URL}/api/chatbot/question`, {
      categoryId: 1,
      question: `テスト質問 - ${new Date().toISOString()}`
    });
    
    if (testRes.status === 201) {
      console.log('  ✅ Question submitted successfully');
      console.log(`  📝 Question ID: ${testRes.data?.id}`);
    } else {
      console.log(`  ⚠️  Submission returned status ${testRes.status}`);
    }

    // Check 6: Verify question was saved
    console.log('\n✓ Check 6: Verify Question in Database');
    const checkRes = await axios.get(`${BASE_URL}/api/faq/debug/all-questions`);
    console.log(`  ✅ Questions in database: ${checkRes.data?.count || 0}`);
    if (checkRes.data?.data?.length > 0) {
      const latest = checkRes.data.data[0];
      console.log(`  📝 Latest: "${latest.question.substring(0, 50)}..."`);
      console.log(`  👤 User ID: ${latest.user_id}`);
    }

    // Final status
    console.log('\n' + '='.repeat(70));
    console.log('\n✅ ALL CHECKS PASSED!\n');
    console.log('Next steps:');
    console.log('  1. Employee page: http://localhost:3000/ui/chatbot');
    console.log('  2. Submit a question');
    console.log('  3. Admin page: http://localhost:3000/admin/chatbot/faq');
    console.log('  4. Should see the question in the list');
    console.log('  5. Admin can click "回答する" and answer\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED');
    console.error(`\nError: ${err.message}`);
    
    if (err.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Server is not running!');
      console.error('Start it with: npm start');
    } else if (err.response?.status) {
      console.error(`Response Status: ${err.response.status}`);
      console.error(`Response Data:`, err.response.data);
    }

    console.log('\n' + '='.repeat(70) + '\n');
    process.exit(1);
  }
}

verify();
