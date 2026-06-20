import { createCrudRouter } from './crudRouterFactory.js';

export default createCrudRouter({
  table: 'logs',
  columns: ['level', 'source', 'message'],
  writeRoles: ['admin'],
});
