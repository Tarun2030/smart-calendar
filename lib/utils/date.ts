import {
  format,
  parseISO,
  addDays,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
  isValid,
  isBefore,
  startOfDay,
} from 'date-fns';

/**
 * Format a date string or Date object to a readable format.
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid date';
  return format(d, 'MMM dd, yyyy');
}

/**
 * Format a time string (HH:MM) to a readable 12-hour format.
 */
export function formatTime(time: string | Date): string {
  if (time instanceof Date) {
    return format(time, 'h:mm a');
  }
  // Handle HH:MM string
  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return time;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return format(date, 'h:mm a');
}

/**
 * Parse relative date strings like "tomorrow", "next Monday", etc.
 * into YYYY-MM-DD format.
 */
export function parseRelativeDate(dateStr: string, referenceDate: string): string {
  const ref = parseISO(referenceDate);
  const lower = dateStr.toLowerCase().trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) {
    return lower;
  }

  // today
  if (lower === 'today') {
    return format(ref, 'yyyy-MM-dd');
  }

  // tomorrow
  if (lower === 'tomorrow') {
    return format(addDays(ref, 1), 'yyyy-MM-dd');
  }

  // day after tomorrow
  if (lower === 'day after tomorrow') {
    return format(addDays(ref, 2), 'yyyy-MM-dd');
  }

  // next <day>
  const nextDayMatch = lower.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (nextDayMatch) {
    const dayFunctions: Record<string, (d: Date) => Date> = {
      monday: nextMonday,
      tuesday: nextTuesday,
      wednesday: nextWednesday,
      thursday: nextThursday,
      friday: nextFriday,
      saturday: nextSaturday,
      sunday: nextSunday,
    };
    const fn = dayFunctions[nextDayMatch[1]];
    if (fn) {
      return format(fn(ref), 'yyyy-MM-dd');
    }
  }

  // this <day> — treat as the coming occurrence
  const thisDayMatch = lower.match(/^this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (thisDayMatch) {
    const dayFunctions: Record<string, (d: Date) => Date> = {
      monday: nextMonday,
      tuesday: nextTuesday,
      wednesday: nextWednesday,
      thursday: nextThursday,
      friday: nextFriday,
      saturday: nextSaturday,
      sunday: nextSunday,
    };
    const fn = dayFunctions[thisDayMatch[1]];
    if (fn) {
      return format(fn(ref), 'yyyy-MM-dd');
    }
  }

  // in X days
  const inDaysMatch = lower.match(/^in\s+(\d+)\s+days?$/);
  if (inDaysMatch) {
    return format(addDays(ref, parseInt(inDaysMatch[1])), 'yyyy-MM-dd');
  }

  // Fallback: return original string (the LLM likely returned a valid date)
  return dateStr;
}

/**
 * Check if a date is overdue (before today).
 */
export function isOverdue(date: string): boolean {
  const eventDate = parseISO(date);
  return isBefore(startOfDay(eventDate), startOfDay(new Date()));
}

/**
 * Get human-readable relative time string.
 */
export function getRelativeTimeString(date: string): string {
  const eventDate = parseISO(date);
  const today = startOfDay(new Date());
  const target = startOfDay(eventDate);

  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  return formatDate(date);
}
