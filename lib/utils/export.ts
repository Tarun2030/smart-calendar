import * as XLSX from 'xlsx';
import { formatDate, formatTime } from '@/lib/utils/date';
import type { Event } from '@/lib/types/event.types';

/**
 * Export events to an Excel file and trigger download.
 */
export function exportToExcel(events: Event[], filename: string = 'events-export'): void {
  const data = events.map((event) => ({
    Type: event.type,
    Title: event.title,
    Date: formatDate(event.date),
    Time: event.time ? formatTime(event.time) : '-',
    Person: event.person || '-',
    Location: event.location || '-',
    Status: event.status,
    Priority: event.priority,
    Description: event.description || '-',
    'Created At': formatDate(event.created_at),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Events');

  // Auto-size columns
  const maxWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...data.map((row) => String(row[key as keyof typeof row] || '').length)
    ),
  }));
  worksheet['!cols'] = maxWidths;

  // Generate and download
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
