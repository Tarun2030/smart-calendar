export type EventType = 'flight' | 'hotel' | 'meeting' | 'task' | 'deadline';

export type EventStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export type EventPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Event {
  id: string;
  type: EventType;
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null;
  person: string | null;
  location: string | null;
  description: string | null;
  priority: EventPriority;
  status: EventStatus;
  raw_message: string | null;
  whatsapp_phone: string | null;
  calendar_event_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface EventStats {
  total: number;
  flights: number;
  hotels: number;
  meetings: number;
  tasks: number;
  deadlines: number;
  pendingTasks: number;
  overdueTasks: number;
}

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  phone_number: string;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
