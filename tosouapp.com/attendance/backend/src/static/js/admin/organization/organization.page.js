import { listDepartments } from '../../api/departments.api.js';
import { listUsers } from '../../api/users.api.js';
import { mountDepartments } from '../legacy/legacy-departments.page.js';

export async function mount() {
  const content = document.querySelector('#adminContent');
  if (!content) return;
  await mountDepartments({ content, listDepartments, listUsers });
  return () => {};
}
