import { getRecentEvents } from '@/lib/supabase/queries';
import { Badge } from '@/components/ui/badge';
import { formatDate, getRelativeTimeString } from '@/lib/utils/date';

function getEventTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    flight: '✈️',
    hotel: '🏨',
    meeting: '📅',
    task: '✅',
    deadline: '🚨',
  };
  return icons[type] || '📌';
}

function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    flight: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    hotel: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    meeting: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    task: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    deadline: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  };
  return colors[type] || '';
}

export async function RecentEvents() {
  const events = await getRecentEvents(8);

  if (events.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground">
        <p>No events yet. Send a WhatsApp message to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
            {getEventTypeIcon(event.type)}
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium leading-none">{event.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(event.date)}
              {event.person && ` · ${event.person}`}
              {event.location && ` · ${event.location}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={getEventTypeColor(event.type)}>
              {event.type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {getRelativeTimeString(event.date)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecentEventsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border p-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-[200px] animate-pulse rounded bg-muted" />
            <div className="h-3 w-[150px] animate-pulse rounded bg-muted" />
          </div>
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}
