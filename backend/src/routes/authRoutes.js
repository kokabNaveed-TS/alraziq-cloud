import { Router } from 'express';
import { signup, login, me, logout, forgotPassword, resetPassword } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
