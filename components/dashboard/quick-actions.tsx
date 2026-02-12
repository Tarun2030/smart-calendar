'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, Plus, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function QuickActions() {
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleRefresh}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Quick Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push('/events')}>
            📋 View All Events
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Download className="mr-2 h-4 w-4" />
            Export Events
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
