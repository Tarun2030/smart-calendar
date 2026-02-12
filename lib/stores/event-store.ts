import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Event } from '@/lib/types/event.types';

interface EventFilters {
  type: string;
  person: string;
  dateRange: { from?: Date; to?: Date };
  search: string;
}

interface EventStore {
  events: Event[];
  selectedEvent: Event | null;
  filters: EventFilters;
  setEvents: (events: Event[]) => void;
  addEvent: (event: Event) => void;
  updateEvent: (id: string, event: Partial<Event>) => void;
  deleteEvent: (id: string) => void;
  setSelectedEvent: (event: Event | null) => void;
  setFilters: (filters: Partial<EventFilters>) => void;
  clearFilters: () => void;
}

const defaultFilters: EventFilters = {
  type: 'all',
  person: 'all',
  dateRange: {},
  search: '',
};

export const useEventStore = create<EventStore>()(
  devtools(
    persist(
      (set) => ({
        events: [],
        selectedEvent: null,
        filters: { ...defaultFilters },

        setEvents: (events) => set({ events }),

        addEvent: (event) =>
          set((state) => ({ events: [...state.events, event] })),

        updateEvent: (id, updatedEvent) =>
          set((state) => ({
            events: state.events.map((e) =>
              e.id === id ? { ...e, ...updatedEvent } : e
            ),
          })),

        deleteEvent: (id) =>
          set((state) => ({
            events: state.events.filter((e) => e.id !== id),
          })),

        setSelectedEvent: (event) => set({ selectedEvent: event }),

        setFilters: (filters) =>
          set((state) => ({
            filters: { ...state.filters, ...filters },
          })),

        clearFilters: () => set({ filters: { ...defaultFilters } }),
      }),
      {
        name: 'event-store',
      }
    )
  )
);
