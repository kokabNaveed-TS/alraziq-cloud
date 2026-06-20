import { createCrudRouter } from './crudRouterFactory.js';

export default createCrudRouter({
  table: 'policies',
  columns: ['name', 'description', 'effect'],
  writeRoles: ['admin'],
});
