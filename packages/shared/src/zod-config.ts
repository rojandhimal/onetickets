import { z } from 'zod';

// zod 4 probes for eval with `new Function("")` the first time an object schema is defined. The
// web app's CSP has no 'unsafe-eval', so that probe raised a CSP violation report on every page
// load and would break once the CSP is enforced. Jitless mode skips the probe and the compiled
// fast path; parsing our small payloads is just as quick. index.ts imports this first so it runs
// before any schema is created.
z.config({ jitless: true });
