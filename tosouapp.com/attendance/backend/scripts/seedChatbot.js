(async () => {
  try {
    const repo = require('../src/modules/chatbot/chatbot.repository');
    await repo.init();
    await repo.ensureSeedCategories();
    await repo.ensureSeedFaqs();
    console.log('Chatbot seed completed');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
