const TRANSIENT_CODES = new Set(["PGRST000", "PGRST001", "PGRST003", "57014", "53300"]);

function isTransientPostgresError(code: string | undefined, message: string) {
  if (!code) {
    return /timeout|network|fetch failed|econnreset|503|502|504/i.test(message);
  }
  return TRANSIENT_CODES.has(code);
}

export async function withTransientRetry<T>(
  operation: () => Promise<{ data?: T; error: { code?: string; message: string } | null }>,
): Promise<{ data?: T; error: { code?: string; message: string } | null }> {
  const first = await operation();
  if (!first.error) return first;

  const { code, message } = first.error;
  if (!isTransientPostgresError(code, message)) return first;

  await new Promise((resolve) => setTimeout(resolve, 250));
  return operation();
}
