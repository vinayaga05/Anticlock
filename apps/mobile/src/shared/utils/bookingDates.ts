export type BookingDateOption = {
  id: string;
  day: string;
  label: string;
};

/** Next N calendar days for appointment pickers. */
export function getUpcomingBookingDates(count = 6): BookingDateOption[] {
  const base = new Date();
  return Array.from({ length: count }).map((_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      id: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      label: String(d.getDate()),
    };
  });
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Build ISO datetime from date + time label like "6:30 PM". */
export function buildStartsAt(
  baseDate: Date,
  timeLabel: string,
  dayOffset = 0,
): string {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + dayOffset);
  const match = timeLabel.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    d.setHours(hours, minutes, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d.toISOString();
}

/** Today · 6:30 PM | Tomorrow · 10:30 AM | Fri, 22 Oct · 10:00 AM */
export function formatBookingWhen(startsAt: string | Date, now = new Date()): string {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const time = formatTime(date);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (isSameDay(date, now)) return `Today · ${time}`;
  if (isSameDay(date, tomorrow)) return `Tomorrow · ${time}`;

  const sameYear = date.getFullYear() === now.getFullYear();
  const dayPart = date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${dayPart} · ${time}`;
}

export function formatBookingRange(
  startsAt: string | Date,
  endsAt?: string | Date,
): string {
  const start = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  if (!endsAt) return formatBookingWhen(start);
  const end = typeof endsAt === 'string' ? new Date(endsAt) : endsAt;
  const now = new Date();
  let dayPart: string;
  if (isSameDay(start, now)) dayPart = 'Today';
  else if (isSameDay(start, new Date(now.getTime() + 86400000))) dayPart = 'Tomorrow';
  else {
    dayPart = start.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }
  return `${dayPart} · ${formatTime(start)}–${formatTime(end)}`;
}

export function minutesUntil(startsAt: string | Date, now = new Date()): number {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  return Math.round((date.getTime() - now.getTime()) / 60000);
}

export function formatRelativeStart(startsAt: string | Date, now = new Date()): string {
  const mins = minutesUntil(startsAt, now);
  if (mins < 0) return 'Started';
  if (mins < 60) return `Starts in ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Starts in ${hours} hr${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `Starts in ${days} day${days === 1 ? '' : 's'}`;
}

export type TimelineSectionLabel = 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'LATER';

export function getTimelineSectionLabel(
  startsAt: string | Date,
  now = new Date(),
): TimelineSectionLabel {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const today = startOfDay(now);
  const target = startOfDay(date);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'TOMORROW';
  if (diffDays >= 2 && diffDays <= 7) return 'THIS_WEEK';
  return 'LATER';
}

export function isPastBooking(startsAt: string | Date, now = new Date()): boolean {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.getTime() < now.getTime();
}

export function isToday(startsAt: string | Date, now = new Date()): boolean {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  return isSameDay(date, now);
}

export function isThisWeek(startsAt: string | Date, now = new Date()): boolean {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const label = getTimelineSectionLabel(date, now);
  return label === 'TODAY' || label === 'TOMORROW' || label === 'THIS_WEEK';
}

export function isThisMonth(startsAt: string | Date, now = new Date()): boolean {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  );
}
