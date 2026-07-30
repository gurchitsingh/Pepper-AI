function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Consecutive calendar days (ending today or yesterday) with at least one saved item. */
export function computeStreak(items: { created_at: string }[]): number {
  const days = new Set(items.map((i) => dayKey(new Date(i.created_at))));
  const oneDayMs = 24 * 60 * 60 * 1000;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  // Streak isn't broken until a full day passes with no save, so an empty
  // "today" still counts from yesterday.
  if (!days.has(dayKey(cursor))) {
    cursor.setTime(cursor.getTime() - oneDayMs);
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setTime(cursor.getTime() - oneDayMs);
  }
  return streak;
}
