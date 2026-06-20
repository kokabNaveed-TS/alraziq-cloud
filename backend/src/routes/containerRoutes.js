import { createCrudRouter } from './crudRouterFactory.js';
export default createCrudRouter({
  table: 'containers',
  columns: ['container_id','name','image','status','owner_id'],
  ownerColumn: 'owner_id',
  writeRoles: ['admin','member'],
});
