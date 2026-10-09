import { appDatabaseUrl } from './db.js';

// The api under test connects as the RLS-bound app role, never as the migration superuser.
process.env.DATABASE_URL = appDatabaseUrl();
