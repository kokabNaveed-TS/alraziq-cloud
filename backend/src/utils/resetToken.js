import crypto from 'crypto';

/**
 * Generates a random reset token and its SHA-256 hash.
 * The raw token is sent to the user via email; only the hash is stored in the DB.
 */
export function generateResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
