/**
 * Resolves the backend base URL cleanly without trailing slashes.
 * Supports:
 * 1. NEXT_PUBLIC_BACKEND_URL (manual override if specified in env)
 * 2. BACKEND_INTERNAL_URL (injected at runtime by Vercel Service Bindings into frontend server runtime)
 * 3. Browser runtime on deployed origin: returns "" (same-origin relative path routed via vercel.json rewrites)
 * 4. Localhost browser / dev fallback: returns "http://localhost:4000"
 */
export function getBackendUrl(): string {
  // Explicit env override takes highest precedence if provided
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // Server-side (Node / Next.js Server Components / Route Handlers):
  if (typeof window === 'undefined') {
    const internalUrl = process.env.BACKEND_INTERNAL_URL;
    if (internalUrl && internalUrl.trim() !== '') {
      return internalUrl.trim().replace(/\/+$/, '');
    }
    // Local dev server fallback
    return 'http://localhost:4000';
  }

  // Client-side (Browser):
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1');

  // In local dev without full proxy, backend is typically on :4000
  if (isLocalhost && window.location.port !== '4000') {
    return 'http://localhost:4000';
  }

  // In production deployed on Vercel, requests to /api/* and /socket.io are routed to backend service
  return '';
}

export const BACKEND_URL = getBackendUrl();
