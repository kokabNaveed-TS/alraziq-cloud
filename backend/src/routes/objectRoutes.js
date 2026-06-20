import { createCrudRouter } from './crudRouterFactory.js';
export default createCrudRouter({
  table: 'storage_objects',
  columns: ['bucket_name','object_key','size_bytes','content_type','owner_id'],
  ownerColumn: 'owner_id',
  writeRoles: ['admin','member'],
});
