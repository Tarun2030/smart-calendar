import jsPDF from 'jspdf'
import { format } from 'date-fns'
import type { Event } from '@/lib/types/event.types'

function groupEvents(events: Event[]) {
  const map: Record<string, Event[]> = {}

  for (const e of events) {
    if (!map[e.date]) map[e.date] = []
    map[e.date].push(e)
  }

  return Object.entries(map).slice(0, 7)
}

function summary(events: Event[]) {
  return {
    flights: events.filter(e => e.type === 'flight').length,
    hotels: events.filter(e => e.type === 'hotel').length,
    meetings: events.filter(e => e.type === 'meeting').length,
    tasks: events.filter(e => e.type === 'task' && e.status !== 'completed').length,
    deadlines: events.filter(e => e.type === 'deadline').length,
  }
}

function time12h(t?: string | null) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = Number(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 || 12
  return `${display}:${m} ${ampm}`
}

export async function generateDailyDigestPDF(
  events: Event[],
  userName: string,
  range: { from: Date; to: Date }
): Promise<Buffer> {

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()

  /* HEADER */
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Smart Calendar', 40, 40)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(userName, 40, 58)
  doc.text(format(new Date(), 'PPP p'), width - 40, 40, { align: 'right' })

  /* SUMMARY PILLS */
  const s = summary(events)
  let y = 90

  const pills = [
    `Flights ${s.flights}`,
    `Hotels ${s.hotels}`,
    `Meetings ${s.meetings}`,
    `Tasks ${s.tasks}`,
    `Deadlines ${s.deadlines}`
  ]

  let x = 40
  pills.forEach(p => {
    doc.setFillColor(245, 245, 245)
    doc.roundedRect(x, y - 12, 90, 22, 8, 8, 'F')
    doc.setTextColor(20)
    doc.setFontSize(9)
    doc.text(p, x + 8, y)
    x += 100
  })

  y += 40

  /* WEEK GRID */
  const days = groupEvents(events)

  const colWidth = (width - 80) / 7
  let col = 0

  days.forEach(([date, dayEvents]) => {
    let colX = 40 + col * colWidth
    let rowY = y

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(format(new Date(date), 'EEE dd'), colX, rowY)

    rowY += 14

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    dayEvents.slice(0, 8).forEach(e => {
      const line = `${time12h(e.time)} ${e.title}`
      const split = doc.splitTextToSize(line, colWidth - 6)
      doc.text(split, colX, rowY)
      rowY += split.length * 10 + 4
    })

    col++
  })

  return Buffer.from(doc.output('arraybuffer'))
}
