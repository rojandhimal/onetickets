// Must stay first: configures zod before any schema below is defined.
import './zod-config.js';

export { formatAud } from './money.js';
export type { Cents } from './money.js';
export { can, canGrant, MFA_REQUIRED, OWNER_ONLY_GRANTS, PERMISSIONS, ROLES } from './roles.js';
export type { Permission, Role } from './roles.js';
export { addMemberRequest, createOrganisationRequest, roleSchema } from './api/organisations.js';
export type {
  AddMemberRequest,
  ApiErrorBody,
  CreateOrganisationRequest,
  MemberDto,
  OrganisationDto,
} from './api/organisations.js';
export { magicLinkRequest, magicLinkVerify, mfaCode, organiserNameSchema } from './api/auth.js';
export type {
  MagicLinkRequest,
  MagicLinkVerify,
  MfaCode,
  RecoveryCodes,
  Session,
  SessionUser,
  TotpSetup,
} from './api/auth.js';
export { REDACTED, isSensitiveKey, redact, redactString, stripQuery } from './redact.js';
export { scrubBreadcrumb, scrubEvent, scrubSpan } from './telemetry-scrub.js';
export type { ScrubbableBreadcrumb, ScrubbableEvent, ScrubbableSpan } from './telemetry-scrub.js';
export {
  ACCESSIBILITY_FEATURES,
  accessibilityFeature,
  BANNER_CONTENT_TYPES,
  BROWSE_WHEN,
  browseQuery,
  cancellationPolicy,
  CANCELLATION_POLICIES,
  CITIES,
  city,
  CITY_TIME_ZONES,
  createEventRequest,
  EVENT_LIMITS,
  EVENT_STATUSES,
  EVENT_TEMPLATES,
  eventDraftPatch,
  eventTemplate,
  placeSearchQuery,
  PUBLISH_REQUIREMENTS,
  SALES_END_RELATIVE,
  salesEnd,
  salesStart,
  ticketTypeInput,
  venueInput,
  WIZARD_STEPS,
  wizardStep,
} from './api/events.js';
export type {
  AccessibilityFeature,
  BannerDto,
  BrowseCardDto,
  BrowseQuery,
  BrowseResponse,
  CancellationPolicy,
  City,
  CreateEventRequest,
  EventDraftDto,
  EventDraftPatch,
  EventListDto,
  EventStatus,
  EventTemplate,
  PlaceDto,
  PlaceSearchQuery,
  PlaceSearchResponse,
  PlaceSuggestionDto,
  PublicEventDto,
  PublicTicketTypeDto,
  PublicVenueDto,
  PublishNotReadyBody,
  PublishRequirement,
  SalesEnd,
  SalesStart,
  StaleDraftBody,
  TicketTypeDto,
  TicketTypeInput,
  VenueInput,
  WizardStep,
} from './api/events.js';
export { holdTokenBody, reserveHoldBody } from './api/inventory.js';
export type {
  HoldDto,
  HoldPublicDto,
  HoldStatus,
  HoldTokenBody,
  InsufficientSpotsBody,
  ReserveHoldBody,
} from './api/inventory.js';
export {
  decodeTicketToken,
  encodeTicketPayload,
  encodeTicketToken,
  TICKET_KEY_ID_BYTES,
  TICKET_PAYLOAD_BYTES,
  TICKET_SIGNATURE_BYTES,
  TICKET_SIGNING_CONTEXT,
  TICKET_TOKEN_BYTES,
  TICKET_TOKEN_VERSION,
  ticketSigningInput,
} from './api/tickets.js';
export type {
  DecodedTicketToken,
  TicketDto,
  TicketStatus,
  TicketTokenClaims,
} from './api/tickets.js';
export { confirmationPath, createOrderBody, MAX_HOLDS_PER_ORDER } from './api/orders.js';
export type {
  CreatedOrderDto,
  CreateOrderBody,
  OrderEventDto,
  OrderTicketsDto,
} from './api/orders.js';

export { attendeeLinkRequest, attendeeLinkVerify, attendeeOrdersQuery } from './api/attendee.js';
export type {
  AttendeeLinkRequest,
  AttendeeLinkVerify,
  AttendeeOrdersQuery,
  AttendeeSession,
  AttendeeOrdersDto,
} from './api/attendee.js';
