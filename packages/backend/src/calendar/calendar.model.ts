export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  until?: string;
}

export interface CalendarEventInput {
  title: string;
  location: string | null;
  isAllDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  recurrence: RecurrenceRule | null;
}

export interface CalendarEventSeries {
  id: string;
  teamId: string;
  createdByUserId: string;
  title: string;
  location: string | null;
  isAllDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  recurrence: RecurrenceRule | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventOccurrence {
  occurrenceId: string;
  seriesId: string;
  title: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  isRecurring: boolean;
}

export interface CalendarEventsResponse {
  series: CalendarEventSeries[];
  occurrences: CalendarEventOccurrence[];
}
