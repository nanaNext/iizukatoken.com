import { bootLegacyTab } from '../legacy/legacy-tab.page.js';

export async function mount() {
  await bootLegacyTab({ tab: 'departments', hash: '' });
}
