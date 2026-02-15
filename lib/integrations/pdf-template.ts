type DayEvent = {
  title: string
  time?: string
  meta?: string
}

type DayGroup = {
  label: string
  events: DayEvent[]
}

type WeeklyTemplateData = {
  user: string
  generated: string
  summary: {
    flights: number
    hotels: number
    meetings: number
    tasks: number
    deadlines: number
  }
  days: DayGroup[]
}

export function buildWeeklyHTML(data: WeeklyTemplateData): string {

  const daysHTML = data.days.map(day => `
    <div class="day">
      <div class="dayheader">${day.label}</div>
      ${day.events.map(e => `
        <div class="card">
          ${e.time ? `<span class="time">${e.time}</span>` : ''}
          ${e.title}
          ${e.meta ? `<div class="meta2">${e.meta}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `).join('');

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial;margin:0;color:#111}
  .wrap{padding:28px;max-width:960px;margin:0 auto}
  header{display:flex;justify-content:space-between;align-items:center}
  h1{font-size:18px;margin:0;font-weight:600}
  .meta{font-size:12px;color:#6b7280}
  .summary{display:flex;gap:10px;margin:18px 0;flex-wrap:wrap}
  .pill{background:#f3f4f6;padding:8px 12px;border-radius:14px;font-size:13px}
  .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:12px}
  .day{border-left:1px solid rgba(0,0,0,0.04);padding:8px}
  .dayheader{font-size:12px;color:#374151;margin-bottom:8px}
  .card{display:block;padding:8px;border-radius:8px;margin-bottom:8px;border:1px solid rgba(0,0,0,0.04);font-size:13px}
  .time{font-weight:600;margin-right:8px;color:#111}
  .meta2{font-size:11px;color:#6b7280;margin-top:6px}
  footer{display:flex;justify-content:space-between;margin-top:18px;font-size:11px;color:#9ca3af}
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div><strong>Smart Calendar</strong></div>
      <div class="meta">
        ${data.user} • ${data.generated}
      </div>
    </header>

    <div class="summary">
      <div class="pill">✈ Flights: ${data.summary.flights}</div>
      <div class="pill">🏨 Hotels: ${data.summary.hotels}</div>
      <div class="pill">📅 Meetings: ${data.summary.meetings}</div>
      <div class="pill">📝 Tasks: ${data.summary.tasks}</div>
      <div class="pill">⏰ Deadlines: ${data.summary.deadlines}</div>
    </div>

    <div class="grid">
      ${daysHTML}
    </div>

    <footer>
      <div>Prepared by Smart Calendar</div>
      <div>${data.generated}</div>
    </footer>
  </div>
</body>
</html>`;
}
