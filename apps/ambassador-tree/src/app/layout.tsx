import type { Metadata, Viewport } from 'next';
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  IBM_Plex_Sans_Condensed,
} from 'next/font/google';

import './globals.css';

// The Plex superfamily was drawn for technical documentation, which is the
// register this instrument wants: condensed for dense labels, mono with
// tabular figures for money that has to align down a column.
const condensed = IBM_Plex_Sans_Condensed({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-condensed',
  display: 'swap',
});

const body = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ambassador Tree — XO Pure',
  description:
    'Genealogy and downline performance for the XO Pure ambassador network.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html
    lang="en"
    className={`${condensed.variable} ${body.variable} ${mono.variable}`}
  >
    <body>{children}</body>
  </html>
);

export default RootLayout;
