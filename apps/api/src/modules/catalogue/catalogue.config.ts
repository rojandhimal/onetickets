export const CATALOGUE_CONFIG = Symbol('CATALOGUE_CONFIG');

export interface CatalogueConfig {
  /** The `paid_tickets` flag. Off until Sprint 4: every ticket type is free. */
  paidTickets: boolean;
}

export function loadCatalogueConfig(env: NodeJS.ProcessEnv = process.env): CatalogueConfig {
  return { paidTickets: env.FEATURE_PAID_TICKETS === 'on' };
}
