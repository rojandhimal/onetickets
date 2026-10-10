// Loaded with `node --import ./dist/instrument.js` before anything else, so Sentry's
// OpenTelemetry hooks can wrap http, express, Nest and pg as they load (ESM needs the flag).
import * as Sentry from '@sentry/nestjs';
import { sentryOptions } from './observability/sentry.js';

Sentry.init(sentryOptions());
