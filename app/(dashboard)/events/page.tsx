import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EventTable } from '@/components/events/event-table';
import { getEvents } from '@/lib/supabase/queries';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Events</h2>
          <p className="text-muted-foreground">
            Manage and filter all your events in one place.
          </p>
        </div>
      </div>

      <Suspense fallback={<EventsTableSkeleton />}>
        <EventsContent />
      </Suspense>
    </div>
  );
}

async function EventsContent() {
  const events = await getEvents();

  return <EventTable events={events} />;
}

function EventsTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-6 w-[200px]" />
        </CardTitle>
        <CardDescription>
          <Skeleton className="h-4 w-[300px]" />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-[250px]" />
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-[200px]" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
