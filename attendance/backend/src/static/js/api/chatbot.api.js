const CHATBOT_BASE = '/api/chatbot';

async function chatbotFetchJSON(url, options) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getChatbotCategories() {
  return chatbotFetchJSON(`${CHATBOT_BASE}/categories`);
}

export async function getChatbotQuestions(categoryId) {
  return chatbotFetchJSON(`${CHATBOT_BASE}/questions?categoryId=${categoryId}`);
}

export async function getChatbotAnswer(id) {
  return chatbotFetchJSON(`${CHATBOT_BASE}/answer/${id}`);
}

export async function searchChatbot(text) {
  return chatbotFetchJSON(`${CHATBOT_BASE}/search`, { method: 'POST', body: JSON.stringify({ text }) });
}

export async function submitChatbotQuestion(question, categoryId) {
  return chatbotFetchJSON(`${CHATBOT_BASE}/question`, { method: 'POST', body: JSON.stringify({ question, categoryId }) });
}
