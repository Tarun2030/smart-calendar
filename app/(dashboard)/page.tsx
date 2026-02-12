import { Suspense } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/dashboard/stat-card';
import { RecentEvents, RecentEventsSkeleton } from '@/components/dashboard/recent-events';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { UpcomingDeadlines, DeadlinesSkeleton } from '@/components/dashboard/upcoming-deadlines';
import { getEventStats } from '@/lib/supabase/queries';
import {
  Calendar,
  Plane,
  Hotel,
  CheckSquare,
  AlertCircle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <QuickActions />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Stats Grid */}
          <Suspense fallback={<StatsGridSkeleton />}>
            <StatsGrid />
          </Suspense>

          {/* Content Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Your latest events and updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<RecentEventsSkeleton />}>
                  <RecentEvents />
                </Suspense>
              </CardContent>
            </Card>

            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Upcoming Deadlines</CardTitle>
                <CardDescription>
                  Don&apos;t miss these important dates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<DeadlinesSkeleton />}>
                  <UpcomingDeadlines />
                </Suspense>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {/* Analytics charts - implement later */}
          <Card>
            <CardHeader>
              <CardTitle>Event Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function StatsGrid() {
  const stats = await getEventStats();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Events"
        value={stats.total}
        description="+12% from last month"
        icon={Calendar}
        trend="up"
      />
      <StatCard
        title="Upcoming Flights"
        value={stats.flights}
        description="Next 30 days"
        icon={Plane}
        iconColor="text-blue-500"
      />
      <StatCard
        title="Hotel Bookings"
        value={stats.hotels}
        description="Active reservations"
        icon={Hotel}
        iconColor="text-amber-500"
      />
      <StatCard
        title="Pending Tasks"
        value={stats.pendingTasks}
        description={`${stats.overdueTasks} overdue`}
        icon={stats.overdueTasks > 0 ? AlertCircle : CheckSquare}
        iconColor={stats.overdueTasks > 0 ? 'text-red-500' : 'text-purple-500'}
        trend={stats.overdueTasks > 0 ? 'down' : 'neutral'}
      />
    </div>
  );
}

function StatsGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-[60px] mb-2" />
            <Skeleton className="h-3 w-[120px]" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
