import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor = 'text-muted-foreground',
  trend = 'neutral',
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p
          className={cn(
            'text-xs text-muted-foreground',
            trend === 'up' && 'text-green-600',
            trend === 'down' && 'text-red-600'
          )}
        >
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
