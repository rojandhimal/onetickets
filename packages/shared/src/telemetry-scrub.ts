import { redact, redactString, stripQuery } from './redact.js';

// Threat model section 6: no bodies, cookies, query strings, tokens or personal data reach
// Sentry or traces. Web (@sentry/nextjs) and api (@sentry/nestjs) run events through these
// before sending. The types are structural so this package doesn't depend on Sentry.

export interface ScrubbableBreadcrumb {
  message?: string;
  data?: Record<string, unknown>;
}

export interface ScrubbableEvent {
  request?: { url?: string; method?: string };
  user?: { id?: string | number };
  breadcrumbs?: ScrubbableBreadcrumb[];
  transaction?: string;
  sdk?: unknown;
  contexts?: Record<string, unknown>;
}

export interface ScrubbableSpan {
  name: string;
  attributes?: Record<string, unknown>;
}

// Describe the SDK and the runtime, not the person. Their `name` fields (browser, OS, Node) are
// what Sentry groups and filters on, so they skip the key-based redaction. `device` is left out
// on purpose: on phones its name can be the owner's ("Priya's iPhone").
const DESCRIPTIVE_CONTEXTS = ['browser', 'os', 'runtime'] as const;

export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  const out = redact(event);
  if (event.sdk !== undefined) out.sdk = event.sdk;
  if (event.contexts && out.contexts) {
    for (const key of DESCRIPTIVE_CONTEXTS) {
      if (key in event.contexts) out.contexts[key] = event.contexts[key];
    }
  }
  if (out.request) {
    const { url, method } = out.request;
    out.request = { method, url: url ? stripQuery(url) : url };
  }
  if (out.user) out.user = out.user.id ? { id: out.user.id } : {};
  if (out.breadcrumbs) out.breadcrumbs = out.breadcrumbs.map(scrubBreadcrumb);
  if (out.transaction) out.transaction = stripQuery(out.transaction);
  return out;
}

export function scrubBreadcrumb<B extends ScrubbableBreadcrumb>(crumb: B): B {
  const out = redact(crumb);
  const data = out.data;
  if (data) {
    for (const key of ['url', 'from', 'to']) {
      const value = data[key];
      if (typeof value === 'string') data[key] = stripQuery(value);
    }
  }
  if (out.message) out.message = redactString(out.message);
  return out;
}

// Span attributes that can carry who the user is or where they connect from.
const DROP_SPAN_ATTRIBUTE = /^(user\.|client\.address|network\.peer\.address|http\.client_ip)/;
const URL_ATTRIBUTE = /(url|target|route|path)/i;

export function scrubSpan<S extends ScrubbableSpan>(span: S): S {
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(span.attributes ?? {})) {
    if (DROP_SPAN_ATTRIBUTE.test(key) || key.endsWith('.query')) continue;
    attributes[key] =
      typeof value === 'string' && URL_ATTRIBUTE.test(key) ? stripQuery(value) : value;
  }
  return { ...span, name: redactString(stripQuery(span.name)), attributes: redact(attributes) };
}
