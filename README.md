# WhatsApp AI Assistant - Event Manager

A production-ready Next.js 14 application that manages events via WhatsApp messages with AI-powered extraction. Features a modern dashboard with shadcn/ui components, Google Calendar integration, PDF report generation, and automated daily digests.

## Features

- **WhatsApp Webhook**: Receive messages via Twilio, extract events using OpenAI GPT-4
- **AI Event Extraction**: Automatically parse event type, date, time, person, location, and priority from natural language
- **Dashboard**: Real-time stats, recent events, upcoming deadlines with shadcn/ui components
- **Event Table**: Filterable, searchable event list with type tabs, person filter, date range picker
- **Google Calendar Sync**: Automatically create Google Calendar events
- **PDF Reports**: Generate daily digest PDFs with jsPDF
- **Daily Digest**: Automated cron job sends summaries via WhatsApp and email
- **Excel Export**: Export filtered events to Excel
- **Dark Mode**: Full dark/light theme support
- **Mobile Responsive**: Collapsible sidebar, responsive tables

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4
- **Messaging**: Twilio WhatsApp API
- **Email**: Resend
- **Calendar**: Google Calendar API
- **PDF**: jsPDF + jspdf-autotable
- **Export**: SheetJS (xlsx)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- OpenAI API key
- Twilio account with WhatsApp sandbox
- Google Cloud project with Calendar API enabled
- Resend account

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd whatsapp-ai-assistant

# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local

# Edit .env.local with your actual keys
# Then run the development server
npm run dev
```

### Supabase Schema

Create these tables in your Supabase project:

```sql
-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone_number TEXT UNIQUE NOT NULL,
  whatsapp_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Events table
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('flight', 'hotel', 'meeting', 'task', 'deadline')),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT,
  person TEXT,
  location TEXT,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  raw_message TEXT,
  whatsapp_phone TEXT,
  calendar_event_id TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activity logs table
CREATE TABLE activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
```

### Twilio WhatsApp Setup

1. Set up a Twilio WhatsApp sandbox at https://www.twilio.com/console/sms/whatsapp/sandbox
2. Configure the webhook URL: `https://your-app.vercel.app/api/whatsapp-webhook`
3. Set the method to POST

### Google Calendar Setup

1. Create a Google Cloud project
2. Enable the Google Calendar API
3. Create OAuth2 credentials
4. Generate a refresh token using the OAuth2 playground

## Project Structure

```
├── app/
│   ├── (dashboard)/           # Dashboard layout group
│   │   ├── page.tsx           # Main dashboard
│   │   ├── events/page.tsx    # Events list
│   │   ├── calendar/page.tsx  # Calendar view
│   │   ├── messages/page.tsx  # Message history
│   │   ├── settings/page.tsx  # Settings
│   │   ├── layout.tsx         # Dashboard layout with sidebar
│   │   ├── loading.tsx        # Loading skeleton
│   │   └── error.tsx          # Error boundary
│   ├── api/
│   │   ├── whatsapp-webhook/  # Twilio webhook handler
│   │   └── send-daily-digest/ # Cron job endpoint
│   ├── globals.css            # Global styles + CSS variables
│   └── layout.tsx             # Root layout
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── dashboard/             # Dashboard-specific components
│   ├── events/                # Event table and related
│   └── layout/                # Sidebar and header
├── lib/
│   ├── integrations/          # External service integrations
│   │   ├── openai.ts          # AI event extraction
│   │   ├── twilio.ts          # WhatsApp messaging
│   │   ├── google-calendar.ts # Calendar sync
│   │   ├── resend.ts          # Email sending
│   │   └── pdf-generator.ts   # PDF report generation
│   ├── supabase/              # Database client and queries
│   ├── stores/                # Zustand state management
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
├── vercel.json                # Vercel cron configuration
└── .env.local.example         # Environment variables template
```

## Deployment

Deploy to Vercel:

```bash
vercel deploy
```

The daily digest cron job runs automatically at 7 AM UTC daily (configured in `vercel.json`).

## License

MIT
