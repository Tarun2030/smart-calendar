import { getUpcomingDeadlines } from '@/lib/supabase/queries';
import { Badge } from '@/components/ui/badge';
import { formatDate, getRelativeTimeString, isOverdue } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';

export async function UpcomingDeadlines() {
  const deadlines = await getUpcomingDeadlines(14);

  if (deadlines.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground">
        <p>No upcoming deadlines. You&apos;re all caught up!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deadlines.map((event) => {
        const overdue = isOverdue(event.date);
        return (
          <div
            key={event.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 transition-colors',
              overdue && 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
            )}
          >
            <div className="mt-0.5 text-lg">
              {event.type === 'deadline' ? '🚨' : '✅'}
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-none">{event.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(event.date)}
                {event.time && ` at ${event.time}`}
              </p>
              {event.person && (
                <p className="text-xs text-muted-foreground">
                  Assigned to: {event.person}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge
                variant={overdue ? 'destructive' : event.priority === 'urgent' ? 'destructive' : 'secondary'}
              >
                {overdue ? 'Overdue' : getRelativeTimeString(event.date)}
              </Badge>
              {event.priority === 'urgent' && !overdue && (
                <Badge variant="outline" className="text-red-600 border-red-200">
                  Urgent
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DeadlinesSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
          <div className="h-6 w-6 animate-pulse rounded bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-[180px] animate-pulse rounded bg-muted" />
            <div className="h-3 w-[120px] animate-pulse rounded bg-muted" />
          </div>
          <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}
