import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isSensitiveKey, REDACTED, redact, redactString, stripQuery } from '@onetickets/shared';
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
 * A copy of an error with its message, stack and own fields redacted. It stays an instance of
 * the same class so the err serializers (ours and pino-http's) still report its type. redact()
 * alone would turn it into `{}`: message and stack are not enumerable.
 */
function redactError(error: Error): Error {
  const copy = Object.create(Object.getPrototypeOf(error) as object) as Error;
  for (const [key, value] of Object.entries(error)) {
    (copy as unknown as Record<string, unknown>)[key] = isSensitiveKey(key)
      ? REDACTED
      : redact(value);
  }
  Object.defineProperty(copy, 'message', { value: redactString(error.message), writable: true });
  Object.defineProperty(copy, 'stack', {
    value: error.stack === undefined ? undefined : redactString(error.stack),
    writable: true,
  });
  if (error.cause !== undefined) {
    Object.defineProperty(copy, 'cause', {
      value: error.cause instanceof Error ? redactError(error.cause) : redact(error.cause),
      writable: true,
    });
  }
  return copy;
}

/** Redacts every field of a log line, errors included. */
function redactLine(object: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object)) {
    out[key] = value instanceof Error ? redactError(value) : redact({ [key]: value })[key];
  }
  return out;
}

/** The error a log call carries, logged on its own or as `{ err }`. */
function errorIn(arg: unknown): Error | undefined {
  if (arg instanceof Error) return arg;
  const err = (arg as { err?: unknown } | null)?.err;
  return err instanceof Error ? err : undefined;
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
    formatters: { log: redactLine },
    hooks: {
      logMethod(args, method) {
        const redacted: unknown[] = args.map((arg) =>
          typeof arg === 'string' ? redactString(arg) : arg,
        );
        // An error logged with no message (as Nest's exception handler does) would get pino's
        // own msg from err.message, which never passes through this hook.
        const error = errorIn(redacted[0]);
        if (error && typeof redacted[1] !== 'string') {
          redacted.splice(1, 0, redactString(error.message));
        }
        method.apply(this, redacted as Parameters<typeof method>);
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
