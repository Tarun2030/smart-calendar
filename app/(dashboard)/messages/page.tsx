import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MessagesPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Messages</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Message history and conversation view coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
