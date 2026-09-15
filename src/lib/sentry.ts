import * as Sentry from "@sentry/react";

let started = false;

export function initSentry() {
  if (started) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
  });
  started = true;
}

export { Sentry };
