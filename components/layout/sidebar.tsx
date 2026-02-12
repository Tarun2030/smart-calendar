'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  LayoutDashboard,
  List,
  MessageSquare,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const routes = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/',
  },
  {
    label: 'Events',
    icon: List,
    href: '/events',
  },
  {
    label: 'Calendar',
    icon: Calendar,
    href: '/calendar',
  },
  {
    label: 'Messages',
    icon: MessageSquare,
    href: '/messages',
  },
  {
    label: 'Settings',
    icon: Settings,
    href: '/settings',
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform duration-300 md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            WA
          </div>
          <div>
            <h1 className="text-sm font-bold">WhatsApp AI</h1>
            <p className="text-xs text-muted-foreground">Event Manager</p>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {routes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                onClick={() => setIsOpen(false)}
              >
                <Button
                  variant={pathname === route.href ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start gap-3',
                    pathname === route.href && 'bg-secondary'
                  )}
                >
                  <route.icon className="h-4 w-4" />
                  {route.label}
                </Button>
              </Link>
            ))}
          </nav>

          <Separator className="my-4" />

          {/* WhatsApp Info */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-xs font-medium">WhatsApp Connected</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Send messages to your WhatsApp number to create events automatically.
            </p>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground text-center">
            WhatsApp AI Assistant v0.1.0
          </p>
        </div>
      </aside>
    </>
  );
}
