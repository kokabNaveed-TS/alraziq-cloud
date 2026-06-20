import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { createCrudController } from '../controllers/crudFactory.js';

/**
 * Builds a CRUD router for a table.
 *
 * @param {object} options - same as createCrudController, plus:
 * @param {string[]} [options.writeRoles=['admin']] - roles allowed to create/update/delete
 */
export function createCrudRouter(options) {
  const { writeRoles = ['admin'] } = options;
  const controller = createCrudController(options);
  const router = Router();

  router.use(authenticate);

  router.get('/', controller.list);
  router.get('/:id', controller.getOne);
  router.post('/', authorize(...writeRoles), controller.create);
  router.put('/:id', authorize(...writeRoles), controller.update);
  router.delete('/:id', authorize(...writeRoles), controller.remove);

  return router;
}
