import * as Sentry from '@sentry/nextjs';
import { sentryOptions, serverEnvironment } from './lib/sentry-scrub';

export function register() {
  // Same options on the Node and edge runtimes; Sentry picks the right SDK per runtime.
  Sentry.init(sentryOptions(serverEnvironment()));
}

export const onRequestError = Sentry.captureRequestError;
