import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';import
{ Clerk } from "@clerk/clerk-js";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("Add your VITE_CLERK_PUBLISHABLE_KEY to the .env file");
}

const clerkDomain = atob(publishableKey.split("_")[2]).slice(0, -1);

await new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = `https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.onload = resolve;
  script.onerror = () => reject(new Error("Failed to load @clerk/ui bundle"));
  document.head.appendChild(script);
});

const clerk = new Clerk(publishableKey);
await clerk.load({
  ui: { ClerkUI: window.__internal_ClerkUICtor },
});

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
