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

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#6B8F71" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DaybyDay" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Disable body scrolling on web so the app behaves like a native shell. */}
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
html, body { background-color: #FBF9F6; }
@media (prefers-color-scheme: dark) { html, body { background-color: #1A1B19; } }
`;

const SW_REGISTER = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;
