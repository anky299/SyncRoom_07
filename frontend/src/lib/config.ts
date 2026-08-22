/**
 * Resolves the backend base URL cleanly without trailing slashes.
 */
export function getBackendUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:4000';
}

export const BACKEND_URL = getBackendUrl();
