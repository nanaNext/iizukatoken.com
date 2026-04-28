// FAQ Admin Management Page
import { FaqAdminComponent } from '../faq-admin-component.js?v=navy-20260427-faqfix1';

export async function mount() {
  console.log('🎯 Mounting FAQ Admin Page');
  
  const host = document.querySelector('#adminContent');
  if (!host) {
    console.error('❌ Admin content host not found');
    return;
  }

  // Create main container
  host.className = 'card';
  host.innerHTML = `
    <div style="padding: 20px;">
      <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: bold;">FAQ管理</h1>
      <div id="faqAdminContainer"></div>
    </div>
  `;

  // Initialize component
  const component = new FaqAdminComponent('faqAdminContainer');
  await component.init();

  // Return cleanup function
  return async () => {
    console.log('🧹 Cleaning up FAQ Admin Page');
  };
}
