import { getBackendUrl } from './config';

/**
 * Safe fetch wrapper that handles JSON & HTML responses gracefully.
 * Prevents "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" errors.
 */
export async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const fullUrl = url.startsWith('http://') || url.startsWith('https://')
    ? url
    : `${getBackendUrl()}${url.startsWith('/') ? '' : '/'}${url}`;

  let res: Response;
  try {
    res = await fetch(fullUrl, options);
  } catch (err: any) {
    throw new Error(`Network error connecting to backend at ${getBackendUrl()}: ${err.message || 'Failed to fetch'}`);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    if (isJson) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Request failed with status ${res.status}`);
    } else {
      const text = await res.text().catch(() => '');
      const cleanSnippet = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
      throw new Error(`Server returned HTML/non-JSON error (${res.status}): ${cleanSnippet || res.statusText || 'Endpoint not found'}`);
    }
  }

  if (isJson) {
    return await res.json();
  } else {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Expected JSON response from backend but received text/HTML: ${text.slice(0, 100)}`);
    }
  }
}
