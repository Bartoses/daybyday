import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Root HTML document for the static web export (Expo Router). Injects the PWA
 * manifest, theme color, Apple touch icon + meta so the app is installable on
 * iOS ("Add to Home Screen") and Android/Chrome, and registers the service
 * worker that Chrome requires for the install prompt.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        <title>DaybyDay</title>
        <meta
          name="description"
          content="The parenting companion that grows with your family, one day at a time."
        />

        {/* Brand fonts: Fraunces (display serif) + Inter (body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,500&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap"
        />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#E07E5F" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DaybyDay" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Provides the html/body/#root flex + height chain the app's
            flex:1 screens rely on to fill the viewport. It also sets
            body { overflow: hidden }, which blocks real content overflow
            *and* Safari's pull-to-refresh — BASE_CSS below overrides just
            that property back to scrollable. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />

        {/* Register the service worker (required for Chrome installability). */}
        <script dangerouslySetInnerHTML={{ __html: SW_REGISTER }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const BASE_CSS = `
html, body { background-color: #E7E2D9; font-family: "Hanken Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
body { overflow-y: auto; }
`;

const SW_REGISTER = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;
