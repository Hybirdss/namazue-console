const encoder = new TextEncoder();

export interface InternalAuthResult {
  ok: boolean;
  status?: 401 | 503;
  error?: string;
}

export function verifyInternalAuth(
  expectedToken: string | undefined,
  requestToken: string | undefined,
): InternalAuthResult {
  const configuredToken = expectedToken?.trim();
  if (!configuredToken) {
    return {
      ok: false,
      status: 503,
      error: 'Internal route is disabled',
    };
  }

  if (!requestToken || !timingSafeEqual(configuredToken, requestToken)) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
    };
  }

  return { ok: true };
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);

  // Pad to same length to prevent length leak via timing side-channel.
  const maxLen = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length; // non-zero if lengths differ
  for (let i = 0; i < maxLen; i++) {
    diff |= (leftBytes[i] ?? 0) ^ (rightBytes[i] ?? 0);
  }

  return diff === 0;
}
