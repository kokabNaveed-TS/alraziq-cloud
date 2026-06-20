import { createCrudRouter } from './crudRouterFactory.js';
export default createCrudRouter({
  table: 'backups',
  columns: ['source_type','source_id','status','size_gb'],
  writeRoles: ['admin','member'],
});
