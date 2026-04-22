import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
import { AUTH_TOKEN_KEY } from '@/app.const';
import type {
  CalendarEventOccurrence,
  CalendarEventsResponse,
  CalendarEventSeries,
  FrontendRecurrenceFrequency,
  FrontendRecurrenceRule,
} from '@/app.model';
import { API_BASE_URL } from '@/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CalendarPageProps } from '@/pages/CalendarPage.model';

const recurrenceOptions: { label: string; value: FrontendRecurrenceFrequency | 'none' }[] = [
  { label: 'Does not repeat', value: 'none' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

const recurrenceUnitLabel = (frequency: FrontendRecurrenceFrequency, interval: number): string => {
  const suffix = interval === 1 ? '' : 's';

  switch (frequency) {
    case 'daily':
      return `day${suffix}`;
    case 'weekly':
      return `week${suffix}`;
    case 'monthly':
      return `month${suffix}`;
    case 'yearly':
      return `year${suffix}`;
  }
};

const formatRecurrenceSummary = (frequency: FrontendRecurrenceFrequency, interval: number): string =>
  `Every ${interval} ${recurrenceUnitLabel(frequency, interval)}`;

interface FormState {
  title: string;
  location: string;
  isAllDay: boolean;
  allDayStartDate: string;
  allDayEndDate: string;
  startsAt: string;
  endsAt: string;
  recurrenceFrequency: FrontendRecurrenceFrequency | 'none';
  recurrenceInterval: string;
  recurrenceUntil: string;
}

const emptyForm = (): FormState => {
  const now = new Date();
  const inHour = new Date(now.getTime() + 60 * 60 * 1000);
  const today = toDateInputValue(now.toISOString());
  return {
    title: '',
    location: '',
    isAllDay: false,
    allDayStartDate: today,
    allDayEndDate: today,
    startsAt: toDateTimeInputValue(now.toISOString()),
    endsAt: toDateTimeInputValue(inHour.toISOString()),
    recurrenceFrequency: 'none',
    recurrenceInterval: '1',
    recurrenceUntil: '',
  };
};

const keyFromDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateTimeInputValue = (isoDate: string): string => {
  const date = new Date(isoDate);
  const pad = (num: number) => String(num).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toDateInputValue = (isoDate: string): string => {
  const date = new Date(isoDate);
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const subtractOneDay = (isoDate: string): string => {
  const date = new Date(isoDate);
  date.setDate(date.getDate() - 1);
  return date.toISOString();
};

const startOfCalendarGrid = (value: Date): Date => {
  const monthStart = new Date(value.getFullYear(), value.getMonth(), 1);
  const dayOffset = monthStart.getDay();
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - dayOffset);
  return gridStart;
};

const buildCalendarDays = (month: Date): Date[] => {
  const start = startOfCalendarGrid(month);
  return Array.from({ length: 42 }, (_, i) => {
    const next = new Date(start);
    next.setDate(start.getDate() + i);
    return next;
  });
};

const formatMonthLabel = (month: Date): string =>
  month.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

const formatOccurrenceTime = (isoDate: string): string =>
  new Date(isoDate).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

const formatSeriesDateRange = (eventSeries: CalendarEventSeries): string => {
  if (eventSeries.isAllDay && eventSeries.startsAt && eventSeries.endsAt) {
    const startLabel = new Date(eventSeries.startsAt).toLocaleDateString();
    const endLabel = new Date(subtractOneDay(eventSeries.endsAt)).toLocaleDateString();
    return startLabel === endLabel ? `All day (${startLabel})` : `All day (${startLabel} - ${endLabel})`;
  }

  if (!eventSeries.startsAt || !eventSeries.endsAt) {
    return 'All day';
  }

  return `${new Date(eventSeries.startsAt).toLocaleString()} - ${new Date(eventSeries.endsAt).toLocaleString()}`;
};

export function CalendarPage({ onLogout }: CalendarPageProps) {
  const [displayMonth, setDisplayMonth] = useState(() => new Date());
  const [series, setSeries] = useState<CalendarEventSeries[]>([]);
  const [occurrences, setOccurrences] = useState<CalendarEventOccurrence[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calendarDays = useMemo(() => buildCalendarDays(displayMonth), [displayMonth]);
  const rangeStart = useMemo(() => calendarDays[0], [calendarDays]);
  const rangeEnd = useMemo(() => {
    const end = new Date(calendarDays[calendarDays.length - 1]);
    end.setDate(end.getDate() + 1);
    return end;
  }, [calendarDays]);

  const seriesById = useMemo(() => {
    const map = new Map<string, CalendarEventSeries>();
    for (const item of series) {
      map.set(item.id, item);
    }
    return map;
  }, [series]);

  const occurrencesByDay = useMemo(() => {
    const grouped: Record<string, CalendarEventOccurrence[]> = {};
    for (const occurrence of occurrences) {
      const seriesItem = seriesById.get(occurrence.seriesId);
      if (seriesItem?.isAllDay) {
        const cursor = new Date(occurrence.startsAt);
        const endsAt = new Date(occurrence.endsAt);
        while (cursor < endsAt) {
          const key = keyFromDate(cursor);
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(occurrence);
          cursor.setDate(cursor.getDate() + 1);
        }
        continue;
      }

      const key = keyFromDate(new Date(occurrence.startsAt));
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(occurrence);
    }

    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }

    return grouped;
  }, [occurrences, seriesById]);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
      const params = new URLSearchParams({
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
      });
      const response = await fetch(`${API_BASE_URL}/calendar/events?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load calendar events: ${response.statusText}`);
      }

      const data = (await response.json()) as CalendarEventsResponse;
      setSeries(data.series ?? []);
      setOccurrences(data.occurrences ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar events');
    } finally {
      setIsLoading(false);
    }
  }, [onLogout, rangeEnd, rangeStart]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingSeriesId(null);
  };

  const startEditing = (eventSeries: CalendarEventSeries) => {
    const now = new Date();
    const inHour = new Date(now.getTime() + 60 * 60 * 1000);
    const defaultDate = toDateInputValue(now.toISOString());
    const hasDateRange = Boolean(eventSeries.startsAt && eventSeries.endsAt);
    setEditingSeriesId(eventSeries.id);
    setForm({
      title: eventSeries.title,
      location: eventSeries.location ?? '',
      isAllDay: eventSeries.isAllDay,
      allDayStartDate: hasDateRange && eventSeries.startsAt ? toDateInputValue(eventSeries.startsAt) : defaultDate,
      allDayEndDate:
        hasDateRange && eventSeries.endsAt ? toDateInputValue(subtractOneDay(eventSeries.endsAt)) : defaultDate,
      startsAt: eventSeries.startsAt
        ? toDateTimeInputValue(eventSeries.startsAt)
        : toDateTimeInputValue(now.toISOString()),
      endsAt: eventSeries.endsAt
        ? toDateTimeInputValue(eventSeries.endsAt)
        : toDateTimeInputValue(inHour.toISOString()),
      recurrenceFrequency: eventSeries.recurrence?.frequency ?? 'none',
      recurrenceInterval: String(eventSeries.recurrence?.interval ?? 1),
      recurrenceUntil: eventSeries.recurrence?.until ? toDateTimeInputValue(eventSeries.recurrence.until) : '',
    });
  };

  const handleSave = async () => {
    const startsAtDate = form.isAllDay ? null : new Date(form.startsAt);
    const endsAtDate = form.isAllDay ? null : new Date(form.endsAt);

    if (!form.title.trim()) {
      setError('Event title is required.');
      return;
    }

    if (
      !form.isAllDay &&
      (!startsAtDate ||
        !endsAtDate ||
        Number.isNaN(startsAtDate.getTime()) ||
        Number.isNaN(endsAtDate.getTime()) ||
        startsAtDate >= endsAtDate)
    ) {
      setError('Start and end date must be valid, and end must be after start.');
      return;
    }

    if (form.isAllDay) {
      const allDayStart = new Date(`${form.allDayStartDate}T00:00:00.000Z`);
      const allDayEnd = new Date(`${form.allDayEndDate}T00:00:00.000Z`);
      if (
        !form.allDayStartDate ||
        !form.allDayEndDate ||
        Number.isNaN(allDayStart.getTime()) ||
        Number.isNaN(allDayEnd.getTime()) ||
        allDayEnd < allDayStart
      ) {
        setError('All-day date range must be valid, and end date must be on or after start date.');
        return;
      }
    }

    const interval = Number(form.recurrenceInterval);
    if (form.recurrenceFrequency !== 'none' && (!Number.isInteger(interval) || interval < 1 || interval > 365)) {
      setError('Recurrence interval must be between 1 and 365.');
      return;
    }

    let recurrence: FrontendRecurrenceRule | null = null;
    if (form.recurrenceFrequency !== 'none') {
      recurrence = {
        frequency: form.recurrenceFrequency,
        interval,
      };

      if (form.recurrenceUntil) {
        recurrence.until = new Date(form.recurrenceUntil).toISOString();
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
      const response = await fetch(
        editingSeriesId ? `${API_BASE_URL}/calendar/events/${editingSeriesId}` : `${API_BASE_URL}/calendar/events`,
        {
          method: editingSeriesId ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: form.title,
            location: form.location,
            isAllDay: form.isAllDay,
            allDayStartDate: form.isAllDay ? form.allDayStartDate : undefined,
            allDayEndDate: form.isAllDay ? form.allDayEndDate : undefined,
            startsAt: startsAtDate ? startsAtDate.toISOString() : null,
            endsAt: endsAtDate ? endsAtDate.toISOString() : null,
            recurrence,
          }),
        },
      );

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (!response.ok) {
        const message = editingSeriesId ? 'Failed to update event' : 'Failed to create event';
        throw new Error(message);
      }

      resetForm();
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);

    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
      const response = await fetch(`${API_BASE_URL}/calendar/events/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to delete event');
      }

      if (editingSeriesId === id) {
        resetForm();
      }

      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  return (
    <div className="p-8 max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground mt-2">
          Plan team events with emoji-friendly titles, locations, and recurring schedules.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                  {formatMonthLabel(displayMonth)}
                </CardTitle>
                <CardDescription>
                  {isLoading ? 'Loading events...' : 'Click an event in the list to edit it.'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Previous month"
                  onClick={() => setDisplayMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="outline" onClick={() => setDisplayMonth(new Date())}>
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Next month"
                  onClick={() => setDisplayMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase text-muted-foreground mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="px-2 py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const dayKey = keyFromDate(day);
                const dayOccurrences = occurrencesByDay[dayKey] ?? [];
                const isCurrentMonth = day.getMonth() === displayMonth.getMonth();
                const isToday = dayKey === keyFromDate(new Date());

                return (
                  <div
                    key={dayKey}
                    className={`min-h-28 rounded-md border p-2 ${isCurrentMonth ? 'bg-card' : 'bg-muted/30'} ${
                      isToday ? 'border-primary' : ''
                    }`}
                  >
                    <div className="mb-2 text-xs font-semibold">{day.getDate()}</div>
                    <div className="space-y-1">
                      {dayOccurrences.slice(0, 3).map((occurrence) => (
                        <div
                          key={occurrence.occurrenceId}
                          className="rounded bg-primary/10 px-2 py-1 text-[11px] leading-tight"
                        >
                          <p className="font-medium truncate">{occurrence.title}</p>
                          <p className="text-muted-foreground">
                            {seriesById.get(occurrence.seriesId)?.isAllDay
                              ? 'All day'
                              : formatOccurrenceTime(occurrence.startsAt)}
                          </p>
                        </div>
                      ))}
                      {dayOccurrences.length > 3 && (
                        <p className="text-[11px] text-muted-foreground">+{dayOccurrences.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{editingSeriesId ? 'Edit Event' : 'Create Event'}</CardTitle>
            <CardDescription>
              Titles support emojis, and recurring schedules can repeat daily, weekly, monthly, or yearly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Quarterly planning 🚀"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-location">Location</Label>
              <Input
                id="event-location"
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Conference Room A"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="event-all-day"
                type="checkbox"
                checked={form.isAllDay}
                onChange={(e) => setForm((prev) => ({ ...prev, isAllDay: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="event-all-day">All day event</Label>
            </div>

            {form.isAllDay && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="event-all-day-start-date">Start Date</Label>
                  <Input
                    id="event-all-day-start-date"
                    type="date"
                    value={form.allDayStartDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, allDayStartDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-all-day-end-date">End Date</Label>
                  <Input
                    id="event-all-day-end-date"
                    type="date"
                    value={form.allDayEndDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, allDayEndDate: e.target.value }))}
                  />
                </div>
              </>
            )}

            {!form.isAllDay && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="event-start">Start</Label>
                  <Input
                    id="event-start"
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-end">End</Label>
                  <Input
                    id="event-end"
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="event-recurrence-frequency">Recurrence</Label>
              <select
                id="event-recurrence-frequency"
                value={form.recurrenceFrequency}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    recurrenceFrequency: e.target.value as FrontendRecurrenceFrequency | 'none',
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {recurrenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {form.recurrenceFrequency !== 'none' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="event-recurrence-interval">Repeat Every</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="event-recurrence-interval"
                      type="number"
                      min={1}
                      max={365}
                      value={form.recurrenceInterval}
                      onChange={(e) => setForm((prev) => ({ ...prev, recurrenceInterval: e.target.value }))}
                    />
                    <span className="min-w-20 text-sm text-muted-foreground">
                      {recurrenceUnitLabel(form.recurrenceFrequency, Number(form.recurrenceInterval) || 1)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatRecurrenceSummary(form.recurrenceFrequency, Number(form.recurrenceInterval) || 1)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-recurrence-until">Repeat Until (Optional)</Label>
                  <Input
                    id="event-recurrence-until"
                    type="datetime-local"
                    value={form.recurrenceUntil}
                    onChange={(e) => setForm((prev) => ({ ...prev, recurrenceUntil: e.target.value }))}
                  />
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSave()} disabled={isSaving}>
                {editingSeriesId ? (
                  <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {editingSeriesId ? 'Update Event' : 'Create Event'}
              </Button>
              {editingSeriesId && (
                <Button variant="outline" onClick={resetForm}>
                  Cancel Edit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Series</CardTitle>
          <CardDescription>Edit or remove a recurring series and all of its future occurrences.</CardDescription>
        </CardHeader>
        <CardContent>
          {!series.length ? (
            <p className="text-sm text-muted-foreground">No events yet. Create one to populate the calendar.</p>
          ) : (
            <div className="space-y-3">
              {series.map((eventSeries) => (
                <div
                  key={eventSeries.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{eventSeries.title}</p>
                    <p className="text-sm text-muted-foreground">{formatSeriesDateRange(eventSeries)}</p>
                    {eventSeries.location && <p className="text-sm text-muted-foreground">{eventSeries.location}</p>}
                    {eventSeries.recurrence && (
                      <p className="text-xs text-muted-foreground">
                        {formatRecurrenceSummary(eventSeries.recurrence.frequency, eventSeries.recurrence.interval)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => startEditing(eventSeries)}>
                      Edit
                    </Button>
                    <Button variant="outline" onClick={() => void handleDelete(eventSeries.id)}>
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
