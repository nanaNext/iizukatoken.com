import { getChatbotCategories, getChatbotQuestions, getChatbotAnswer, searchChatbot, submitChatbotQuestion } from '../api/chatbot.api.js';

const $ = (sel) => document.querySelector(sel);

async function init() {
  try {
    const cats = await getChatbotCategories();
    const catSelect = $('#cat');
    catSelect.innerHTML = cats.map(c => `<option value="${c.id}">${c.name_ja}</option>`).join('');
    loadQuestions(cats[0]?.id);
  } catch (e) {
    console.error(e);
  }
}

async function loadQuestions(categoryId) {
  const list = await getChatbotQuestions(categoryId);
  const ul = $('#faq-list');
  ul.innerHTML = list.map(it => `<li><button data-id="${it.id}" class="faq-item">${it.question}</button></li>`).join('');
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
  }
  if (t.matches('#askBtn')) {
    const question = $('#ask').value.trim();
    const categoryId = parseInt($('#cat').value, 10);
    if (!question) return;
    await submitChatbotQuestion(question, categoryId);
    $('#ask').value = '';
    alert('Đã gửi câu hỏi');
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
