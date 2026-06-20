# Alraziq-Cloud Backend (Express + MySQL)

REST API backend for the Alraziq-Cloud dashboard, structured for easy reuse as a template.

## Setup

```bash
cp .env.example .env       # then fill in your DB credentials & JWT secret
npm install

# create the database & tables
mysql -u root -p < src/db/schema.sql

npm run dev                # nodemon, http://localhost:5000
```

## Structure

```
src/
  server.js            # entrypoint - connects to DB, starts express
  app.js               # express app, mounts all routes & middleware
  config/
    db.js              # mysql2 connection pool
  db/
    schema.sql         # full database schema (run once to set up)
  middleware/
    auth.js            # authenticate (JWT) + authorize(...roles)
    errorHandler.js    # 404 + centralized error handler
  models/
    userModel.js       # user queries (used by auth)
  controllers/
    authController.js     # signup, login, me, logout
    dashboardController.js # stats, charts, recent instances
    userController.js      # admin user management
    crudFactory.js          # generic CRUD handler generator
  routes/
    authRoutes.js
    dashboardRoutes.js
    crudRouterFactory.js     # generic CRUD router generator
    instanceRoutes.js, containerRoutes.js, functionRoutes.js
    objectRoutes.js, volumeRoutes.js, backupRoutes.js
    metricRoutes.js, alertRoutes.js, logRoutes.js
    userRoutes.js, roleRoutes.js, policyRoutes.js
    invoiceRoutes.js, paymentRoutes.js, costExplorerRoutes.js
    apiKeyRoutes.js, notificationRoutes.js, profileRoutes.js
  utils/
    jwt.js               # sign/verify JWT helpers
    mailer.js            # Nodemailer SMTP transport + sendPasswordResetEmail()
    resetToken.js        # crypto token generation + SHA-256 hashing
```

## Auth flow

1. `POST /api/auth/signup` `{ name, email, password }` → `{ token, user }`
2. `POST /api/auth/login` `{ email, password }` → `{ token, user }`
3. Send `Authorization: Bearer <token>` on subsequent requests.
4. `GET /api/auth/me` → current user.
5. `POST /api/auth/logout` → stateless (client discards token).
6. `POST /api/auth/forgot-password` `{ email }` → sends reset email, always returns a generic success message.
7. `POST /api/auth/reset-password` `{ token, newPassword }` → validates token, updates password, invalidates token.

**Password reset security:**
- Raw token is sent to the user via email. Only its **SHA-256 hash** is stored in the DB (same approach as bcrypt for API keys).
- Tokens expire after **1 hour**.
- Requesting a new reset invalidates any previous unused tokens for the same user.
- The `forgot-password` endpoint always returns the same generic success message whether or not the email is registered, to prevent email enumeration.

## SMTP setup (Gmail example)

1. Enable 2-Step Verification on your Google account.
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords), generate a password for "Mail".
3. Set in `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_16_char_app_password
   SMTP_FROM="Alraziq-Cloud <your_email@gmail.com>"
   FRONTEND_URL=http://localhost:5173
   ```

For **Outlook/Hotmail**: `SMTP_HOST=smtp-mail.outlook.com`, port `587`, secure `false`.
For **custom SMTP** (e.g. Mailhog in dev): `SMTP_HOST=localhost`, `SMTP_PORT=1025`, no auth needed — great for local testing without real emails.

## Endpoints overview

| Section      | Routes |
|--------------|--------|
| Auth         | `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/reset-password` |
| Dashboard    | `/api/dashboard/stats`, `/api/dashboard/charts/instance-growth`, `/api/dashboard/charts/revenue-trend`, `/api/dashboard/recent-instances` |
| Compute      | `/api/instances`, `/api/containers`, `/api/functions` (full CRUD) |
| Storage      | `/api/objects`, `/api/volumes`, `/api/backups` (full CRUD) |
| Monitoring   | `/api/metrics`, `/api/alerts` (+ `PATCH /:id/resolve`), `/api/logs` |
| Identity     | `/api/users` (admin only), `/api/roles`, `/api/policies` |
| Billing      | `/api/invoices`, `/api/payments`, `/api/cost-explorer/monthly` |
| Settings     | `/api/api-keys`, `/api/notifications`, `/api/profile` (+ `/api/profile/password`) |

All CRUD routes support `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` with pagination via `?limit=&offset=`.

## Using this as a template

1. **`db/schema.sql`** – add/remove tables for your domain.
2. **`controllers/crudFactory.js` + `routes/crudRouterFactory.js`** – for any new simple table, create a one-line route file like:
   ```js
   import { createCrudRouter } from './crudRouterFactory.js';
   export default createCrudRouter({ table: 'my_table', columns: ['col1', 'col2'], writeRoles: ['admin'] });
   ```
3. **`middleware/auth.js`** – `authenticate` + `authorize(...roles)` reused everywhere.
4. **`controllers/authController.js`** – swap/extend signup-login logic (e.g. add email verification, OAuth).
5. Mount new routers in `app.js`.

## Connecting the React frontend

In the frontend's `AuthContext.jsx`, replace the demo `login`/`signup` with:

```js
const res = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.message);
localStorage.setItem('token', data.token);
setUser(data.user);
```

Then attach `Authorization: Bearer <token>` to all subsequent API calls.
