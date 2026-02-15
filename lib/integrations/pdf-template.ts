import { chromium } from 'playwright'
import { buildWeeklyHTML } from './pdf-template'
import type { Event } from '@/lib/types/event.types'

function to12h(time?: string | null) {
  if (!time) return ''
  const [h, m] = time.split(':')
  const hour = Number(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 || 12
  return `${display}:${m} ${ampm}`
}

function groupEvents(events: Event[]) {
  const days: Record<string, any[]> = {}

  for (const e of events) {
    if (!days[e.date]) days[e.date] = []
    days[e.date].push(e)
  }

  return Object.entries(days).map(([date, evs]) => ({
    label: new Date(date).toDateString().slice(0, 10),
    events: evs.map(e => ({
      title: e.title,
      time: to12h(e.time),
      meta: [e.person, e.location].filter(Boolean).join(' • ')
    }))
  }))
}

export async function generateDailyDigestPDF(
  events: Event[],
  userName: string,
  range: { from: Date; to: Date }
): Promise<Buffer> {

  const summary = {
    flights: events.filter(e => e.type === 'flight').length,
    hotels: events.filter(e => e.type === 'hotel').length,
    meetings: events.filter(e => e.type === 'meeting').length,
    tasks: events.filter(e => e.type === 'task' && e.status !== 'completed').length,
    deadlines: events.filter(e => e.type === 'deadline').length,
  }

  const html = buildWeeklyHTML({
    user: userName,
    generated: new Date().toLocaleString('en-IN'),
    summary,
    days: groupEvents(events)
  })

  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.setContent(html, { waitUntil: 'networkidle' })

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true
  })

  await browser.close()

  return Buffer.from(pdf)
}
