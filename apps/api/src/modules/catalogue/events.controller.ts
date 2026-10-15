import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  BANNER_CONTENT_TYPES,
  createEventRequest,
  EVENT_LIMITS,
  eventDraftPatch,
  ticketTypeInput,
  type CreateEventRequest,
  type EventDraftDto,
  type EventDraftPatch,
  type EventListDto,
  type TicketTypeInput,
} from '@onetickets/shared';
import {
  ApiError,
  type AppRequest,
  OrganisationAccess,
  type OrganisationContext,
  ZodBody,
} from '../identity/index.js';
import { type Actor, EventsService } from './events.service.js';

function actor(request: AppRequest): Actor {
  const organisation = request.organisation as OrganisationContext;
  return { organisationId: organisation.id, userId: request.auth!.userId };
}

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new ApiError(HttpStatus.NOT_FOUND, 'event_not_found', 'Event not found.'),
});

/** Organiser routes: owners and admins of the organisation in the path. */
@Controller('organisations/:organisationId/events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @HttpCode(201)
  @OrganisationAccess('manageEvents')
  async create(
    @Req() request: AppRequest,
    @Body(new ZodBody(createEventRequest)) body: CreateEventRequest,
  ): Promise<EventDraftDto> {
    return this.events.create(actor(request), body.template);
  }

  @Get()
  @OrganisationAccess('manageEvents')
  async list(@Req() request: AppRequest): Promise<EventListDto> {
    return { items: await this.events.list(actor(request)) };
  }

  @Get(':eventId')
  @OrganisationAccess('manageEvents')
  async get(
    @Req() request: AppRequest,
    @Param('eventId', uuid) eventId: string,
  ): Promise<EventDraftDto> {
    return this.events.get(actor(request), eventId);
  }

  @Patch(':eventId')
  @OrganisationAccess('manageEvents')
  async update(
    @Req() request: AppRequest,
    @Param('eventId', uuid) eventId: string,
    @Body(new ZodBody(eventDraftPatch)) body: EventDraftPatch,
  ): Promise<EventDraftDto> {
    return this.events.update(actor(request), eventId, body);
  }

  @Post(':eventId/publish')
  @HttpCode(200)
  @OrganisationAccess('manageEvents')
  async publish(
    @Req() request: AppRequest,
    @Param('eventId', uuid) eventId: string,
  ): Promise<EventDraftDto> {
    return this.events.publish(actor(request), eventId);
  }

  @Post(':eventId/ticket-types')
  @HttpCode(201)
  @OrganisationAccess('manageEvents')
  async addTicketType(
    @Req() request: AppRequest,
    @Param('eventId', uuid) eventId: string,
    @Body(new ZodBody(ticketTypeInput)) body: TicketTypeInput,
  ): Promise<EventDraftDto> {
    return this.events.addTicketType(actor(request), eventId, body);
  }

  @Patch(':eventId/ticket-types/:ticketTypeId')
  @OrganisationAccess('manageEvents')
  async updateTicketType(
    @Req() request: AppRequest,
    @Param('eventId', uuid) eventId: string,
    @Param('ticketTypeId', uuid) ticketTypeId: string,
    @Body(new ZodBody(ticketTypeInput)) body: TicketTypeInput,
  ): Promise<EventDraftDto> {
    return this.events.updateTicketType(actor(request), eventId, ticketTypeId, body);
  }

  @Delete(':eventId/ticket-types/:ticketTypeId')
  @OrganisationAccess('manageEvents')
  async removeTicketType(
    @Req() request: AppRequest,
    @Param('eventId', uuid) eventId: string,
    @Param('ticketTypeId', uuid) ticketTypeId: string,
  ): Promise<EventDraftDto> {
    return this.events.removeTicketType(actor(request), eventId, ticketTypeId);
  }

  /** The image is the raw request body, not multipart. */
  @Put(':eventId/banner')
  @OrganisationAccess('manageEvents')
  async setBanner(
    @Req() request: AppRequest,
    @Param('eventId', uuid) eventId: string,
  ): Promise<EventDraftDto> {
    const type = (request.header('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (!(BANNER_CONTENT_TYPES as readonly string[]).includes(type)) {
      throw new ApiError(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'unsupported_image',
        'Use a JPG, PNG or WebP image.',
      );
    }
    return this.events.setBanner(actor(request), eventId, await readUpload(request));
  }

  @Delete(':eventId/banner')
  @OrganisationAccess('manageEvents')
  async removeBanner(
    @Req() request: AppRequest,
    @Param('eventId', uuid) eventId: string,
  ): Promise<EventDraftDto> {
    return this.events.removeBanner(actor(request), eventId);
  }
}

const tooLarge = () =>
  new ApiError(HttpStatus.PAYLOAD_TOO_LARGE, 'image_too_large', 'Use an image up to 10 MB.');

/** Reads the request body up to the banner limit, refusing early when it says it is larger. */
async function readUpload(request: AppRequest): Promise<Buffer> {
  const declared = Number(request.header('content-length') ?? '0');
  if (declared > EVENT_LIMITS.bannerBytes) throw tooLarge();
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > EVENT_LIMITS.bannerBytes) {
      request.destroy();
      throw tooLarge();
    }
    chunks.push(chunk);
  }
  if (size === 0) {
    throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'invalid_request', 'No image sent.');
  }
  return Buffer.concat(chunks);
}
