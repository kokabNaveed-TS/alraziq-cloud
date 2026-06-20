import { createCrudRouter } from './crudRouterFactory.js';
export default createCrudRouter({
  table: 'functions',
  columns: ['name','runtime','status','invocations','owner_id'],
  ownerColumn: 'owner_id',
  writeRoles: ['admin','member'],
});
