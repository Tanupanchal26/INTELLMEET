/**
 * Format an ISO date string to a readable format.
 * @param iso ISO Date string
 * @returns Formatted string
 */
export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

/**
 * Generate a random 6-character meeting code.
 * @returns 6-char string e.g. "AZ8FJD"
 */
export const generateMeetingCode = (): string =>
  Math.random().toString(36).substring(2, 8).toUpperCase();
