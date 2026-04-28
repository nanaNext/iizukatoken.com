import { FaqAdminComponent } from '../faq-admin-component.js';

export const path = '/admin/chatbot/faq';

export async function mount() {
  const host = document.querySelector('#adminContent');
  host.className = 'card';
  host.innerHTML = `
    <div style="padding: 20px;">
      <h1>FAQ管理</h1>
      <div id="faqAdminContainer"></div>
    </div>
  `;
  
  const component = new FaqAdminComponent('faqAdminContainer');
  await component.init();
  
  return async () => {
    console.log('Cleaning up FAQ Admin Page');
  };
}
