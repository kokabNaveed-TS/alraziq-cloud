import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { listUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/userController.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', listUsers);
router.get('/:id', getUser);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
