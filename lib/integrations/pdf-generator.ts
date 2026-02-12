import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatTime } from '@/lib/utils/date';
import type { Event } from '@/lib/types/event.types';

/**
 * Generate a PDF daily digest report.
 */
export async function generateDailyDigestPDF(
  events: Event[],
  userName: string,
  dateRange: { from: Date; to: Date }
): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header with blue background
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('WhatsApp AI Assistant', 20, 25);

  doc.setFontSize(12);
  doc.text(`Daily Digest for ${userName}`, 20, 33);

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Date range
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`,
    pageWidth - 20,
    25,
    { align: 'right' }
  );

  let yPosition = 50;

  // Summary Section
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Summary', 20, yPosition);
  yPosition += 10;

  const summary = getEventSummary(events);
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);

  const summaryData = [
    ['Upcoming Flights', summary.flights.toString()],
    ['Hotel Bookings', summary.hotels.toString()],
    ['Meetings', summary.meetings.toString()],
    ['Pending Tasks', summary.tasks.toString()],
    ['Upcoming Deadlines', summary.deadlines.toString()],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [['Category', 'Count']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 },
  });

  yPosition = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

  // Flights Section
  if (summary.flights > 0) {
    const flights = events.filter((e) => e.type === 'flight');
    yPosition = addEventSection(doc, 'Upcoming Flights', flights, yPosition);
  }

  // Hotels Section
  if (summary.hotels > 0) {
    const hotels = events.filter((e) => e.type === 'hotel');
    yPosition = addEventSection(doc, 'Hotel Bookings', hotels, yPosition);
  }

  // Meetings Section
  if (summary.meetings > 0) {
    const meetings = events.filter((e) => e.type === 'meeting');
    yPosition = addEventSection(doc, 'Meetings', meetings, yPosition);
  }

  // Tasks Section
  if (summary.tasks > 0) {
    const tasks = events.filter((e) => e.type === 'task' && e.status !== 'completed');
    yPosition = addEventSection(doc, 'Pending Tasks', tasks, yPosition);
  }

  // Deadlines Section
  if (summary.deadlines > 0) {
    const deadlines = events.filter((e) => e.type === 'deadline');
    yPosition = addEventSection(doc, 'Upcoming Deadlines', deadlines, yPosition, true);
  }

  // Footer
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated on ${formatDate(new Date())}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );
  doc.text(
    'WhatsApp AI Assistant - Your Personal Event Manager',
    pageWidth / 2,
    footerY + 5,
    { align: 'center' }
  );

  return Buffer.from(doc.output('arraybuffer'));
}

function getEventSummary(events: Event[]) {
  return {
    flights: events.filter((e) => e.type === 'flight').length,
    hotels: events.filter((e) => e.type === 'hotel').length,
    meetings: events.filter((e) => e.type === 'meeting').length,
    tasks: events.filter((e) => e.type === 'task' && e.status !== 'completed').length,
    deadlines: events.filter((e) => e.type === 'deadline').length,
  };
}

function addEventSection(
  doc: jsPDF,
  title: string,
  events: Event[],
  startY: number,
  isUrgent: boolean = false
): number {
  // Check if we need a new page
  if (startY > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    startY = 20;
  }

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(title, 20, startY);
  startY += 10;

  const tableData = events.map((event) => [
    formatDate(event.date),
    event.time ? formatTime(event.time) : '-',
    event.title,
    event.person || '-',
    event.location || '-',
  ]);

  autoTable(doc, {
    startY,
    head: [['Date', 'Time', 'Title', 'Person', 'Location']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: isUrgent ? [239, 68, 68] : [59, 130, 246],
      textColor: [255, 255, 255],
    },
    margin: { left: 20, right: 20 },
    styles: { fontSize: 9 },
  });

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
}
