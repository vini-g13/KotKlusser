import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";
import * as Sentry from "@sentry/react";

// Crash logging (Sentry) — optioneel, zie kotklusser-cleanup-plan.md sectie 4.
// Geen Sentry-DSN? Dan blijft de app gewoon werken zonder crash-reporting.
const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
  });
} else {
  // eslint-disable-next-line no-console
  console.warn("REACT_APP_SENTRY_DSN niet ingesteld — crash logging naar Sentry is uitgeschakeld.");
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
