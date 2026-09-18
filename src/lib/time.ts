/**
 * Formats a duration in milliseconds as MM:SS, or H:MM:SS when it is
 * an hour or longer. Hours/minutes/seconds are always shown with
 * leading zeros so digits do not shift while counting down.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const sign = totalSeconds < 0 ? "-" : "";
  const absoluteSeconds = Math.abs(totalSeconds);
  const hours = Math.floor(absoluteSeconds / 3600);
  const minutes = Math.floor((absoluteSeconds % 3600) / 60);
  const seconds = absoluteSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${sign}${hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`}`;
}

/** Formats saved history durations without rounding short sessions to minutes. */
export function formatHistoryDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${mm}:${ss}`
    : `${mm}:${ss}`;
}