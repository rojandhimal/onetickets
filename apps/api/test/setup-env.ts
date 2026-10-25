import { randomBytes } from 'node:crypto';
import { appDatabaseUrl } from './db.js';

// The api under test connects as the RLS-bound app role, never as the migration superuser.
process.env.DATABASE_URL = appDatabaseUrl();
process.env.WEB_URL = 'http://localhost:3000';
process.env.SESSION_COOKIE_SECURE = 'false';
process.env.MAIL_TRANSPORT = 'outbox';
process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
// High enough that the suite never trips it; magic-link-cap.int.test.ts sets its own.
process.env.MAGIC_LINK_HOURLY_CAP = '100000';
// Banners go to a throwaway folder per run.
process.env.BANNER_DIR = `${process.env.TMPDIR ?? '/tmp'}/onetickets-banners-${process.pid}`;
// A fresh ticket signing key per run: no seed is ever committed, not even a test one.
process.env.TICKET_SIGNING_KEY = randomBytes(32).toString('base64');
