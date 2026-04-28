import { getChatbotCategories, getChatbotQuestions, getChatbotAnswer, searchChatbot, submitChatbotQuestion } from '../api/chatbot.api.js';

const $ = (sel) => document.querySelector(sel);

async function init() {
  try {
    console.log('🚀 Chatbot page initializing...');
    
    // Add timeout to prevent infinite loading
    const catPromise = getChatbotCategories();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Categories loading timeout')), 8000)
    );
    
    let cats = [];
    try {
      cats = await Promise.race([catPromise, timeoutPromise]);
      console.log('✅ Categories loaded:', cats);
    } catch (e) {
      console.error('⚠️ Failed to load categories:', e.message);
      cats = [];
    }
    
    const catSelect = $('#cat');
    if (!catSelect) {
      console.error('❌ Element #cat not found');
      return;
    }
    
    if (cats && cats.length > 0) {
      catSelect.innerHTML = cats.map(c => `<option value="${c.id}">${c.name_ja}</option>`).join('');
      console.log('✅ Category select populated');
      
      if (cats[0]?.id) {
        try {
          await loadQuestions(cats[0].id);
          console.log('✅ Questions loaded');
        } catch (e) {
          console.warn('⚠️ Could not load initial questions:', e.message);
        }
      }
    } else {
      catSelect.innerHTML = '<option>Loading categories...</option>';
      console.warn('⚠️ No categories returned');
    }
    
    console.log('✅ Chatbot page ready');
  } catch (e) {
    console.error('❌ Init error:', e);
    const container = $('#faq-list');
    if (container) {
      container.innerHTML = `<div style="color:red;padding:20px;">エラー: ${e.message}</div>`;
    }
  }
}

async function loadQuestions(categoryId) {
  try {
    const questionsPromise = getChatbotQuestions(categoryId);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Questions loading timeout')), 8000)
    );
    
    const list = await Promise.race([questionsPromise, timeoutPromise]);
    const ul = $('#faq-list');
    if (ul) {
      ul.innerHTML = list.map(it => `<li><button data-id="${it.id}" class="faq-item">${it.question}</button></li>`).join('');
    }
  } catch (e) {
    console.error('⚠️ Error loading questions:', e.message);
    const ul = $('#faq-list');
    if (ul) {
      ul.innerHTML = `<li style="color:red;">質問の読み込みエラー: ${e.message}</li>`;
    }
  }
}

document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.matches('.faq-item')) {
    const id = t.getAttribute('data-id');
    const ans = await getChatbotAnswer(id);
    $('#answer').textContent = ans.answer;
  }
  if (t.matches('#searchBtn')) {
    const text = $('#search').value.trim();
    if (!text) return;
    const list = await searchChatbot(text);
    const ul = $('#faq-list');
    ul.innerHTML = list.map(it => `<li><button data-id="${it.id}" class="faq-item">${it.question}</button></li>`).join('');
    $('#answer').textContent = '';
  }  if (t.matches('#askBtn')) {
    const question = $('#ask').value.trim();
    const categoryId = parseInt($('#cat').value, 10);
    if (!question) {
      console.warn('⚠️ Question is empty');
      return;
    }
    console.log('📤 Submitting question:', { question, categoryId });
    try {
      await submitChatbotQuestion(question, categoryId);
      console.log('✅ Question submitted successfully');
      $('#ask').value = '';
      alert('質問が送信されました。\nお返事までしばらくお待ちください。');
    } catch (e) {
      console.error('❌ Submit error:', e);
      alert('エラー: ' + e.message);
    }
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.matches('#cat')) {
    const categoryId = parseInt(t.value, 10);
    await loadQuestions(categoryId);
    $('#answer').textContent = '';
  }
});

init();
