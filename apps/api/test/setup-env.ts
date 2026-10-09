import { appDatabaseUrl } from './db.js';

// The api under test connects as the RLS-bound app role, never as the migration superuser.
process.env.DATABASE_URL = appDatabaseUrl();
process.env.WEB_URL = 'http://localhost:3000';
process.env.SESSION_COOKIE_SECURE = 'false';
process.env.MAIL_TRANSPORT = 'outbox';
process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
// High enough that the suite never trips it; magic-link-cap.int.test.ts sets its own.
process.env.MAGIC_LINK_HOURLY_CAP = '100000';
