import { createCrudRouter } from './crudRouterFactory.js';
export default createCrudRouter({
  table: 'volumes',
  columns: ['volume_id','name','size_gb','status','region','owner_id'],
  ownerColumn: 'owner_id',
  writeRoles: ['admin','member'],
});
