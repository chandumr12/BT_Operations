/** Turns an axios error into a readable string instead of letting it fail silently. */
export function describeError(e: any): string {
  if (e?.response) {
    const detail = e.response.data?.detail ?? JSON.stringify(e.response.data);
    return `HTTP ${e.response.status}: ${detail}`;
  }
  if (e?.request) return 'No response from server (network/CORS/timeout)';
  return e?.message ?? 'Unknown error';
}
