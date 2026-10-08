import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from './lib/sentry-scrub';

// Session Replay is deliberately not enabled: it would record what organisers type.
Sentry.init(sentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
