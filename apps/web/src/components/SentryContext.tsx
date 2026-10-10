'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/** Tags browser errors with the signed-in ids. Ids only: never the email or names. */
export function SentryContext({
  userId,
  organisationId,
}: {
  userId: string;
  organisationId: string;
}) {
  useEffect(() => {
    Sentry.setUser({ id: userId });
    Sentry.setTag('organisation_id', organisationId);
    return () => {
      Sentry.setUser(null);
      Sentry.setTag('organisation_id', undefined);
    };
  }, [userId, organisationId]);
  return null;
}
