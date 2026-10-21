/**
 * Inventory & Hold configuration (ADR 0007, S2-1, S2-2).
 * Holds expire after 10 minutes (600s), renew every 5 minutes (300s) on activity,
 * and may be kept for a maximum of 20 minutes (1200s) from creation.
 */
export const HOLD_DURATION_SECONDS = 600;
export const MAX_HOLD_DURATION_SECONDS = 1200;
export const HOLD_RENEW_INTERVAL_SECONDS = 300;
