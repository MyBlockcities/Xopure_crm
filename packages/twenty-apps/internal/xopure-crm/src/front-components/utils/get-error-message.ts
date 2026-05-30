export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unable to read live data.';
