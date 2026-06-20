import bcrypt from 'bcryptjs';
import { UserModel, PasswordResetModel } from '../models/userModel.js';
import { signToken } from '../utils/jwt.js';
import { generateResetToken, hashResetToken } from '../utils/resetToken.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatar_url || null,
  };
}

export async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await UserModel.findByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserModel.create({ name, email, passwordHash });

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'This account has been disabled.' });
    }

    await UserModel.updateLastLogin(user.id);

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: sanitizeUser({ ...user, avatar_url: user.avatar_url }) });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res) {
  // Stateless JWT - client just discards the token.
  // For server-side invalidation, maintain a token blocklist (e.g. in Redis).
  res.json({ message: 'Logged out successfully.' });
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    // Always respond with the same generic message, whether or not the
    // account exists, to avoid leaking which emails are registered.
    const genericResponse = {
      message: 'If an account exists for that email, a password reset link has been sent.',
    };

    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.json(genericResponse);
    }

    const { rawToken, tokenHash } = generateResetToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await PasswordResetModel.create({ userId: user.id, tokenHash, expiresAt });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (mailErr) {
      console.error('Failed to send password reset email:', mailErr.message);
      return res.status(500).json({
        message: 'Could not send the password reset email. Please check the server SMTP configuration and try again.',
      });
    }

    res.json(genericResponse);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const tokenHash = hashResetToken(token);
    const resetRecord = await PasswordResetModel.findValidByTokenHash(tokenHash);

    if (!resetRecord) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await UserModel.updatePassword(resetRecord.user_id, passwordHash);
    await PasswordResetModel.markUsed(resetRecord.id);

    res.json({ message: 'Your password has been reset successfully. You can now sign in.' });
  } catch (err) {
    next(err);
  }
}
