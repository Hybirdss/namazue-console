interface ImportMetaEnvLike {
  VITE_API_URL?: string;
  PROD?: boolean;
}

const META_ENV = (import.meta as ImportMeta & { env?: ImportMetaEnvLike }).env;

const API_BASE = (() => {
  if (META_ENV?.VITE_API_URL) return META_ENV.VITE_API_URL;
  if (META_ENV?.PROD) return 'https://api.namazue.dev';
  return '';
})();

export function resolveWorkerApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return API_BASE ? `${API_BASE}${path}` : path;
}

export async function fetchReferenceJson<T>(
  path: string,
  timeoutMs = 8_000,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(resolveWorkerApiUrl(path), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
