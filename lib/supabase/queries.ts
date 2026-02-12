import { getSupabaseAdmin } from './client';
import { logger } from '@/lib/utils/logger';
import type { Event, EventStats, User, ActivityLog } from '@/lib/types/event.types';

function getAdmin() {
  return getSupabaseAdmin();
}

/**
 * Create a new event.
 */
export async function createEvent(eventData: Partial<Event> & { raw_message?: string; whatsapp_phone?: string }): Promise<Event> {
  const supabase = getAdmin();

  // Look up user by phone number, or create one
  let userId = eventData.user_id;
  if (!userId && eventData.whatsapp_phone) {
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', eventData.whatsapp_phone)
      .single();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({ phone_number: eventData.whatsapp_phone, whatsapp_enabled: true })
        .select()
        .single();

      if (userError) {
        logger.error('Failed to create user', { error: userError });
        throw new Error('Failed to create user');
      }
      userId = newUser.id;
    }
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      type: eventData.type,
      title: eventData.title,
      date: eventData.date,
      time: eventData.time,
      person: eventData.person,
      location: eventData.location,
      description: eventData.description,
      priority: eventData.priority || 'medium',
      status: 'pending',
      raw_message: eventData.raw_message,
      whatsapp_phone: eventData.whatsapp_phone,
      user_id: userId,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create event', { error });
    throw new Error(`Failed to create event: ${error.message}`);
  }

  return data as Event;
}

/**
 * Update an existing event.
 */
export async function updateEvent(id: string, updates: Partial<Event>): Promise<Event> {
  const supabase = getAdmin();

  const { data, error } = await supabase
    .from('events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update event', { error, id });
    throw new Error(`Failed to update event: ${error.message}`);
  }

  return data as Event;
}

/**
 * Get all events, optionally filtered.
 */
export async function getEvents(filters?: {
  type?: string;
  userId?: string;
  status?: string;
  limit?: number;
}): Promise<Event[]> {
  const supabase = getAdmin();

  let query = supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true });

  if (filters?.type && filters.type !== 'all') {
    query = query.eq('type', filters.type);
  }
  if (filters?.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to fetch events', { error });
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  return (data || []) as Event[];
}

/**
 * Get recent events (last 10).
 */
export async function getRecentEvents(limit: number = 10): Promise<Event[]> {
  const supabase = getAdmin();

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch recent events', { error });
    return [];
  }

  return (data || []) as Event[];
}

/**
 * Get upcoming events for a user within the next N days.
 */
export async function getUpcomingEvents(userId: string, days: number = 7): Promise<Event[]> {
  const supabase = getAdmin();

  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .gte('date', today)
    .lte('date', futureDate)
    .neq('status', 'cancelled')
    .order('date', { ascending: true });

  if (error) {
    logger.error('Failed to fetch upcoming events', { error, userId });
    return [];
  }

  return (data || []) as Event[];
}

/**
 * Get upcoming deadlines within the next N days.
 */
export async function getUpcomingDeadlines(days: number = 7): Promise<Event[]> {
  const supabase = getAdmin();

  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .in('type', ['deadline', 'task'])
    .neq('status', 'completed')
    .neq('status', 'cancelled')
    .gte('date', today)
    .lte('date', futureDate)
    .order('date', { ascending: true })
    .limit(10);

  if (error) {
    logger.error('Failed to fetch upcoming deadlines', { error });
    return [];
  }

  return (data || []) as Event[];
}

/**
 * Get event statistics for the dashboard.
 */
export async function getEventStats(): Promise<EventStats> {
  const supabase = getAdmin();

  const today = new Date().toISOString().split('T')[0];

  const { data: allEvents, error } = await supabase
    .from('events')
    .select('type, status, date')
    .neq('status', 'cancelled');

  if (error) {
    logger.error('Failed to fetch event stats', { error });
    return {
      total: 0,
      flights: 0,
      hotels: 0,
      meetings: 0,
      tasks: 0,
      deadlines: 0,
      pendingTasks: 0,
      overdueTasks: 0,
    };
  }

  const events = allEvents || [];

  return {
    total: events.length,
    flights: events.filter((e) => e.type === 'flight').length,
    hotels: events.filter((e) => e.type === 'hotel').length,
    meetings: events.filter((e) => e.type === 'meeting').length,
    tasks: events.filter((e) => e.type === 'task').length,
    deadlines: events.filter((e) => e.type === 'deadline').length,
    pendingTasks: events.filter(
      (e) => (e.type === 'task' || e.type === 'deadline') && e.status === 'pending'
    ).length,
    overdueTasks: events.filter(
      (e) =>
        (e.type === 'task' || e.type === 'deadline') &&
        e.status !== 'completed' &&
        e.date < today
    ).length,
  };
}

/**
 * Get all active users.
 */
export async function getActiveUsers(): Promise<User[]> {
  const supabase = getAdmin();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or('whatsapp_enabled.eq.true,email_enabled.eq.true');

  if (error) {
    logger.error('Failed to fetch active users', { error });
    return [];
  }

  return (data || []) as User[];
}

/**
 * Log an activity.
 */
export async function logActivity(
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = getAdmin();

  const { error } = await supabase.from('activity_logs').insert({
    user_id: userId,
    action,
    metadata,
  });

  if (error) {
    logger.error('Failed to log activity', { error, userId, action });
  }
}

/**
 * Delete an event.
 */
export async function deleteEvent(id: string): Promise<void> {
  const supabase = getAdmin();

  const { error } = await supabase.from('events').delete().eq('id', id);

  if (error) {
    logger.error('Failed to delete event', { error, id });
    throw new Error(`Failed to delete event: ${error.message}`);
  }
}
