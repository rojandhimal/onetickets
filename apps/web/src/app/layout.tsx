import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import './globals.css';

// Self-hosted (latin subset, variable weight) so builds never depend on Google Fonts being
// reachable, and so the CSP can keep font-src 'self'. Licences: src/fonts/OFL-*.txt.
const bricolage = localFont({
  src: '../fonts/BricolageGrotesque-latin.woff2',
  weight: '500 800',
  variable: '--font-bricolage',
  display: 'swap',
});

const figtree = localFont({
  src: '../fonts/Figtree-latin.woff2',
  weight: '400 700',
  variable: '--font-figtree',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'OneTickets', template: '%s · OneTickets' },
  description: 'Sell tickets to your event. Free events cost nothing.',
};

export const viewport: Viewport = {
  themeColor: '#16161D',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU" className={`${bricolage.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
