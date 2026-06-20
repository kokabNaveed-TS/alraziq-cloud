import { createCrudRouter } from './crudRouterFactory.js';
export default createCrudRouter({
  table: 'instances',
  columns: ['instance_id','name','type','status','region','owner_id'],
  ownerColumn: 'owner_id',
  writeRoles: ['admin','member'],
});
