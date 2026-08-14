const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getKstDayKey(date = new Date()) {
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS);
  return kstDate.toISOString().slice(0, 10);
}

export function getKstDayRange(date = new Date()) {
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kstDate.getUTCFullYear();
  const month = kstDate.getUTCMonth();
  const day = kstDate.getUTCDate();
  const startUtc = Date.UTC(year, month, day) - KST_OFFSET_MS;
  const endUtc = startUtc + 24 * 60 * 60 * 1000;

  return {
    since: new Date(startUtc).toISOString(),
    until: new Date(endUtc).toISOString(),
    dayKey: getKstDayKey(date)
  };
}

export function formatElapsed(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(3)}초`;
}
