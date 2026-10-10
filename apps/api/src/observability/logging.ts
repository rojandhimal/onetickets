import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { redact, redactString, stripQuery } from '@onetickets/shared';
import type { Params } from 'nestjs-pino';
import pino from 'pino';

// A caller-supplied request id is kept only if it looks like one, so it can't smuggle text into logs.
const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function requestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', id);
  return id;
}

/**
 * Structured JSON logs. Every line written during a request carries `requestId`, and
 * `organisationId` and `userId` once the access guard knows them (see AccessGuard). Every line
 * passes through the shared redactor (threat model section 6): no emails, names, tokens,
 * cookies, auth headers or IPs, and URLs lose their query strings.
 */
export function loggerOptions(env: NodeJS.ProcessEnv = process.env): pino.LoggerOptions {
  return {
    level: env.LOG_LEVEL ?? 'info',
    base: { service: 'api', environment: env.APP_ENV || 'development' },
    formatters: { log: (object) => redact(object) },
    hooks: {
      logMethod(args, method) {
        method.apply(
          this,
          args.map((arg) => (typeof arg === 'string' ? redactString(arg) : arg)) as Parameters<
            typeof method
          >,
        );
      },
    },
    serializers: {
      req: (req: { method?: string; url?: string }) => ({
        method: req.method,
        url: req.url ? stripQuery(req.url) : req.url,
      }),
      // pino-http hands over a wrapper whose statusCode can be null; the raw response has it.
      res: (res: { statusCode?: number | null; raw?: { statusCode?: number } }) => ({
        statusCode: res.raw?.statusCode ?? res.statusCode,
      }),
      err: pino.stdSerializers.err,
    },
  };
}

export function loggerParams(
  env: NodeJS.ProcessEnv = process.env,
  destination: pino.DestinationStream = process.stdout,
): Params {
  return {
    pinoHttp: [
      {
        ...loggerOptions(env),
        genReqId: requestId,
        // Bound to the request's logger, so every line written while handling it has the id.
        customProps: (req) => ({ requestId: (req as IncomingMessage & { id?: unknown }).id }),
        // Load balancer health checks would drown everything else.
        autoLogging: { ignore: (req) => (req.url ?? '').startsWith('/health') },
      },
      destination,
    ],
    // Lines written while handling a request get organisationId and userId, including the
    // completion line.
    assignResponse: true,
  };
}
