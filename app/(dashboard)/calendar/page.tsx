import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CalendarPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Calendar</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendar View</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Calendar view is coming soon. Your events are synced with Google Calendar automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
