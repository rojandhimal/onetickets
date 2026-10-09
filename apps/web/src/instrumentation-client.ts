import * as Sentry from '@sentry/nextjs';
import { browserEnvironment, sentryOptions } from './lib/sentry-scrub';

// Session Replay is deliberately not enabled: it would record what organisers type.
Sentry.init(sentryOptions(browserEnvironment(window.location.hostname)));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
