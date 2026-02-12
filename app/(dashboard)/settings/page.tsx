import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Integration</CardTitle>
            <CardDescription>Configure your WhatsApp connection</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              WhatsApp integration settings coming soon.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Google Calendar</CardTitle>
            <CardDescription>Manage your calendar sync settings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Google Calendar settings coming soon.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Configure daily digest and notification preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Notification settings coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
