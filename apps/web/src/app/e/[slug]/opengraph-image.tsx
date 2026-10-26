import { readFile } from 'node:fs/promises';
import { ImageResponse } from 'next/og';

import { TEMPLATE_WORDS, priceLabel } from '@/lib/event-page';
import { isEventBannerShown } from '@/lib/flags';
import { getPublicEvent } from '@/lib/public-events';
import { eventEyebrow } from '@/lib/zoned-time';

/** What the renderer takes in `fonts`; next/og doesn't export the type. */
type Font = { name: string; data: Buffer; weight: 700 | 800; style: 'normal' };

// Rich link preview, design artboard 2b: the banner full bleed with a white ticket-stub caption.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Event details on OneTickets';

const TINTS: Record<string, { ground: string; ink: string }> = {
  workshop: { ground: '#E6E3FF', ink: '#2E2799' },
  gig: { ground: '#FFE2B8', ink: '#7A3E00' },
  school_night: { ground: '#FFD9D4', ink: '#8C1D12' },
  meetup: { ground: '#D7F2E6', ink: '#0B5A3A' },
  blank: { ground: '#D7F2E6', ink: '#0B5A3A' },
};

/**
 * The page's own fonts (DES-9): Figtree 700 for the caption and Bricolage Grotesque 800 for the
 * rest. The renderer can't read WOFF2 or variable fonts, so these are static weights cut from the
 * site's latin subsets (42 KB together), read once per server. If one can't be read, the image
 * still renders with the renderer's built-in font.
 */
// Literal URLs, so the build copies the files next to the route.
const FONT_FILES = [
  {
    name: 'Figtree',
    url: new URL('../../../fonts/Figtree-700-latin.woff', import.meta.url),
    weight: 700,
  },
  {
    name: 'Bricolage Grotesque',
    url: new URL('../../../fonts/BricolageGrotesque-800-latin.woff', import.meta.url),
    weight: 800,
  },
] as const;
let fonts: Promise<Font[]> | null = null;
function loadFonts(): Promise<Font[]> {
  fonts ??= Promise.all(
    FONT_FILES.map(({ name, url, weight }) =>
      readFile(url).then(
        (data): Font => ({ name, data, weight, style: 'normal' }),
        () => null,
      ),
    ),
  ).then((loaded) => loaded.filter((f): f is Font => f !== null));
  return fonts;
}
const DISPLAY = { fontFamily: 'Bricolage Grotesque' };

/**
 * The banner as a data URL. The renderer won't fetch private addresses (like the api inside our
 * network) and can't decode WebP, so we fetch the api's 1200 × 630 JPEG rendition (`ogUrl`) ourselves
 * and only use PNG or JPEG.
 */
/** The only shape the api gives a share-image rendition: a UUID key ending `-og.jpg`. */
const OG_BANNER_PATH =
  /^\/api\/public\/banners\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-og\.jpg$/;

async function bannerDataUrl(url: string): Promise<string | null> {
  const api = process.env.API_URL ?? 'http://localhost:3001';
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  if (!OG_BANNER_PATH.test(path)) return null;
  try {
    const res = await fetch(`${api}${path.slice(4)}`, { signal: AbortSignal.timeout(3000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/^image\/(png|jpeg)$/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const event = await getPublicEvent((await params).slug);
  const tint = TINTS[event?.template ?? 'blank'] ?? TINTS.blank!;
  if (!event) {
    return new ImageResponse(
      <div style={{ display: 'flex', width: '100%', height: '100%', background: tint.ground }} />,
      size,
    );
  }
  const banner =
    isEventBannerShown() && event.banner ? await bannerDataUrl(event.banner.ogUrl) : null;
  const where = event.venue.kind === 'online' ? 'Online' : event.venue.suburb;
  const caption = `${eventEyebrow(event.startsAt, event.timeZone)} · ${where}`.toUpperCase();
  const title = event.name.length > 70 ? `${event.name.slice(0, 68).trimEnd()}…` : event.name;
  const loaded = await loadFonts();

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        background: tint.ground,
        color: '#16161D',
      }}
    >
      {banner ? (
        // Rendered into the PNG, so it needs no alt text.
        <img
          src={banner}
          width={1200}
          height={630}
          style={{
            position: 'absolute',
            inset: 0,
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            left: 48,
            top: 40,
            ...DISPLAY,
            fontSize: 120,
            fontWeight: 800,
            letterSpacing: -4,
            color: tint.ink,
          }}
        >
          {TEMPLATE_WORDS[event.template]}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: 48,
          right: 48,
          bottom: 44,
          display: 'flex',
          background: '#FFFFFF',
          borderRadius: 28,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '30px 36px',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, color: '#4338CA', letterSpacing: 1 }}>
            {caption}
          </div>
          <div
            style={{
              ...DISPLAY,
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1,
              display: 'block',
              lineClamp: 2,
            }}
          >
            {title}
          </div>
        </div>
        <div style={{ width: 0, borderLeft: '4px dashed #D4D4DE', margin: '22px 0' }} />
        <div
          style={{
            width: 230,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '30px 28px',
          }}
        >
          <div style={{ ...DISPLAY, fontSize: 48, fontWeight: 800 }}>
            {priceLabel(event.priceFromAllInCents)}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              ...DISPLAY,
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            <svg width="34" height="34" viewBox="0 0 28 28">
              <rect x="1" y="5" width="26" height="18" rx="5" fill="#4338CA" />
              <circle cx="1" cy="14" r="3.5" fill="#FFFFFF" />
              <circle cx="27" cy="14" r="3.5" fill="#FFFFFF" />
              <path d="M14 9v10" stroke="#FFB547" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            OneTickets
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: loaded.length ? loaded : undefined,
    },
  );
}
