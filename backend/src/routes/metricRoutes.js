import { createCrudRouter } from './crudRouterFactory.js';

export default createCrudRouter({
  table: 'metrics',
  columns: ['resource_type', 'resource_id', 'metric_name', 'metric_value'],
  orderBy: 'recorded_at DESC',
  writeRoles: ['admin'],
});
