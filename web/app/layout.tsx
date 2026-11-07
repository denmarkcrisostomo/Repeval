import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import { DEMO } from '@/auth';
import { Sprite } from '@/components/Sprite';
import { THEME_SCRIPT } from '@/components/ThemeSwitch';
import './globals.css';

// The fonts live in app/fonts (SIL Open Font License, see OFL.txt there), so dev and build never fetch from Google.
// Both are variable fonts, Latin only: Archivo with its weight and width axes, JetBrains Mono with its weights.
const archivo = localFont({
  src: './fonts/archivo-latin.woff2',
  weight: '100 900',
  style: 'normal',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
  variable: '--font-archivo',
  display: 'swap',
});
const mono = localFont({ src: './fonts/jetbrains-mono-latin.woff2', weight: '100 800', style: 'normal', variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Repeval: tests for code you never tested', template: '%s · Repeval' },
  description:
    'Repeval tests your app inside your own GitHub Actions and hands back a screenshot of every page. Your code never comes to us, and there is no database.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#edf1f0' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1416' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        <Sprite />
        {DEMO && (
          <div className="demo-band">
            <b>Demo mode.</b>
            <span>No GitHub App is set up, so this site uses example repos and the real demo-shop report.</span>
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
