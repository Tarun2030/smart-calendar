'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Download, Search, Calendar as CalendarIcon, MoreHorizontal } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';
import { exportToExcel } from '@/lib/utils/export';
import type { Event } from '@/lib/types/event.types';
import type { DateRange } from 'react-day-picker';

interface EventTableProps {
  events: Event[];
}

export function EventTable({ events }: EventTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPerson, setSelectedPerson] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Extract unique persons for filter
  const uniquePersons = useMemo(() => {
    const persons = events
      .map((e) => e.person)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    return persons as string[];
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Search filter
      if (
        searchQuery &&
        !event.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Type filter
      if (selectedType !== 'all' && event.type !== selectedType) {
        return false;
      }

      // Person filter
      if (selectedPerson !== 'all' && event.person !== selectedPerson) {
        return false;
      }

      // Date range filter
      if (dateRange?.from) {
        const eventDate = new Date(event.date);
        if (eventDate < dateRange.from) return false;
        if (dateRange.to && eventDate > dateRange.to) return false;
      }

      return true;
    });
  }, [events, searchQuery, selectedType, selectedPerson, dateRange]);

  // Get counts for tabs
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: events.length };
    ['flight', 'hotel', 'meeting', 'task', 'deadline'].forEach((type) => {
      counts[type] = events.filter((e) => e.type === type).length;
    });
    return counts;
  }, [events]);

  const handleExport = () => {
    exportToExcel(filteredEvents, 'events-export');
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          {/* Search */}
          <div className="relative flex-1 md:max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              aria-label="Search events"
            />
          </div>

          {/* Person Filter */}
          {uniquePersons.length > 0 && (
            <Select value={selectedPerson} onValueChange={setSelectedPerson}>
              <SelectTrigger className="w-[180px]" aria-label="Filter by person">
                <SelectValue placeholder="All People" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All People</SelectItem>
                {uniquePersons.map((person) => (
                  <SelectItem key={person} value={person}>
                    {person}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date Range Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="justify-start text-left font-normal"
                aria-label="Select date range"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
                    </>
                  ) : (
                    formatDate(dateRange.from)
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Export Button */}
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      {/* Type Tabs */}
      <Tabs value={selectedType} onValueChange={setSelectedType}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">
            All{' '}
            <Badge variant="secondary" className="ml-2">
              {typeCounts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="flight">
            Flights{' '}
            <Badge variant="secondary" className="ml-2">
              {typeCounts.flight}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="hotel">
            Hotels{' '}
            <Badge variant="secondary" className="ml-2">
              {typeCounts.hotel}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="meeting">
            Meetings{' '}
            <Badge variant="secondary" className="ml-2">
              {typeCounts.meeting}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="task">
            Tasks{' '}
            <Badge variant="secondary" className="ml-2">
              {typeCounts.task}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="deadline">
            Deadlines{' '}
            <Badge variant="secondary" className="ml-2">
              {typeCounts.deadline}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Results Count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredEvents.length} of {events.length} events
      </p>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No events found.
                </TableCell>
              </TableRow>
            ) : (
              filteredEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={getEventTypeColor(event.type)}
                    >
                      {getEventTypeIcon(event.type)} {event.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{event.title}</TableCell>
                  <TableCell>{formatDate(event.date)}</TableCell>
                  <TableCell>
                    {event.time ? formatTime(event.time) : '-'}
                  </TableCell>
                  <TableCell>{event.person || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {event.location || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(event.status)}>
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label="More actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    flight: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    hotel: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    meeting: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
    task: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
    deadline: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  };
  return colors[type] || '';
}

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

function getStatusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') return 'default';
  if (status === 'cancelled') return 'destructive';
  return 'secondary';
}
