import { Fragment, useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, Save, Trash2 } from 'lucide-react';
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

type CalendarViewMode = 'month' | 'week' | 'day';

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

const keyFromUTCDate = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
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

const subtractOneDay = (isoDate: string): string =>
  new Date(new Date(isoDate).getTime() - 24 * 60 * 60 * 1000).toISOString();

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

const startOfWeek = (value: Date): Date => {
  const dayOffset = value.getDay();
  const start = new Date(value);
  start.setDate(value.getDate() - dayOffset);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate());
};

const buildWeekDays = (anchor: Date): Date[] => {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
};

const formatMonthLabel = (month: Date): string =>
  month.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

const formatWeekLabel = (weekDays: Date[]): string => {
  if (!weekDays.length) {
    return '';
  }

  const firstDay = weekDays[0];
  const lastDay = weekDays[weekDays.length - 1];

  const startLabel = firstDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = lastDay.toLocaleDateString('en-US', {
    month: firstDay.getMonth() === lastDay.getMonth() ? undefined : 'short',
    day: 'numeric',
    year: firstDay.getFullYear() === lastDay.getFullYear() ? undefined : 'numeric',
  });

  return `${startLabel} - ${endLabel}`;
};

const formatDayHeaderLabel = (day: Date): string =>
  day.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const formatHourLabel = (hour24: number): string => {
  const normalizedHour = hour24 % 12 || 12;
  const suffix = hour24 < 12 ? 'AM' : 'PM';
  return `${normalizedHour}:00 ${suffix}`;
};

const formatOccurrenceTime = (isoDate: string): string =>
  new Date(isoDate).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

const formatSeriesDateRange = (eventSeries: CalendarEventSeries): string => {
  if (eventSeries.isAllDay && eventSeries.startsAt && eventSeries.endsAt) {
    const startLabel = new Date(eventSeries.startsAt).toLocaleDateString('en-US', { timeZone: 'UTC' });
    const endLabel = new Date(subtractOneDay(eventSeries.endsAt)).toLocaleDateString('en-US', { timeZone: 'UTC' });
    return startLabel === endLabel ? `All day (${startLabel})` : `All day (${startLabel} - ${endLabel})`;
  }

  if (!eventSeries.startsAt || !eventSeries.endsAt) {
    return 'All day';
  }

  return `${new Date(eventSeries.startsAt).toLocaleString()} - ${new Date(eventSeries.endsAt).toLocaleString()}`;
};

const isSameDay = (left: Date, right: Date): boolean => keyFromDate(left) === keyFromDate(right);

const addDays = (value: Date, amount: number): Date => {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
};

const colorByIndex = [
  'border-l-sky-500 bg-sky-50',
  'border-l-emerald-500 bg-emerald-50',
  'border-l-amber-500 bg-amber-50',
  'border-l-rose-500 bg-rose-50',
  'border-l-indigo-500 bg-indigo-50',
  'border-l-cyan-500 bg-cyan-50',
];

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const seriesColorClassName = (seriesId: string): string => colorByIndex[hashString(seriesId) % colorByIndex.length];

const formatSelectedDayLabel = (value: Date): string =>
  value.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

export function CalendarPage({ onLogout }: CalendarPageProps) {
  const [displayMonth, setDisplayMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [series, setSeries] = useState<CalendarEventSeries[]>([]);
  const [occurrences, setOccurrences] = useState<CalendarEventOccurrence[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickCreateHint, setQuickCreateHint] = useState<string | null>(null);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null);
  const [dragCurrentDate, setDragCurrentDate] = useState<Date | null>(null);

  const visibleDays = useMemo(() => {
    if (viewMode === 'day') {
      return [new Date(selectedDate)];
    }

    if (viewMode === 'week') {
      return buildWeekDays(selectedDate);
    }

    return buildCalendarDays(displayMonth);
  }, [displayMonth, selectedDate, viewMode]);

  const rangeStart = useMemo(() => visibleDays[0], [visibleDays]);
  const rangeEnd = useMemo(() => {
    const end = new Date(visibleDays[visibleDays.length - 1]);
    end.setDate(end.getDate() + 1);
    return end;
  }, [visibleDays]);

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
          const key = keyFromUTCDate(cursor);
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(occurrence);
          cursor.setUTCDate(cursor.getUTCDate() + 1);
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

  const selectedDayKey = useMemo(() => keyFromDate(selectedDate), [selectedDate]);
  const selectedDayOccurrences = useMemo(
    () => occurrencesByDay[selectedDayKey] ?? [],
    [occurrencesByDay, selectedDayKey],
  );

  const calendarTitle = useMemo(() => {
    if (viewMode === 'day') {
      return formatDayHeaderLabel(selectedDate);
    }

    if (viewMode === 'week') {
      return formatWeekLabel(visibleDays);
    }

    return formatMonthLabel(displayMonth);
  }, [displayMonth, selectedDate, viewMode, visibleDays]);

  const weekDayHeaders = useMemo(() => {
    if (viewMode === 'day') {
      return [selectedDate.toLocaleDateString('en-US', { weekday: 'long' })];
    }

    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }, [selectedDate, viewMode]);

  const timeSlots = useMemo(() => Array.from({ length: 24 }, (_, hour) => hour), []);

  const timedOccurrencesByDayHour = useMemo(() => {
    const grouped: Record<string, Record<number, CalendarEventOccurrence[]>> = {};

    for (const occurrence of occurrences) {
      const eventSeries = seriesById.get(occurrence.seriesId);
      if (eventSeries?.isAllDay) {
        continue;
      }

      const startAt = new Date(occurrence.startsAt);
      const dayKey = keyFromDate(startAt);
      const hour = startAt.getHours();
      if (!grouped[dayKey]) {
        grouped[dayKey] = {};
      }

      if (!grouped[dayKey][hour]) {
        grouped[dayKey][hour] = [];
      }

      grouped[dayKey][hour].push(occurrence);
    }

    for (const dayKey of Object.keys(grouped)) {
      for (const hour of Object.keys(grouped[dayKey])) {
        grouped[dayKey][Number(hour)].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      }
    }

    return grouped;
  }, [occurrences, seriesById]);

  const allDayOccurrencesByDay = useMemo(() => {
    const grouped: Record<string, CalendarEventOccurrence[]> = {};

    for (const occurrence of occurrences) {
      const eventSeries = seriesById.get(occurrence.seriesId);
      if (!eventSeries?.isAllDay) {
        continue;
      }

      const key = keyFromDate(new Date(occurrence.startsAt));
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(occurrence);
    }

    return grouped;
  }, [occurrences, seriesById]);

  const updateDisplayMonthFromDate = useCallback((value: Date) => {
    setDisplayMonth((prev) => {
      if (prev.getFullYear() === value.getFullYear() && prev.getMonth() === value.getMonth()) {
        return prev;
      }
      return new Date(value.getFullYear(), value.getMonth(), 1);
    });
  }, []);

  const prefillFormForDay = useCallback((day: Date) => {
    const baseStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0, 0, 0);
    const baseEnd = new Date(baseStart.getTime() + 60 * 60 * 1000);
    setEditingSeriesId(null);
    setForm((prev) => ({
      ...prev,
      allDayStartDate: toDateInputValue(baseStart.toISOString()),
      allDayEndDate: toDateInputValue(baseStart.toISOString()),
      startsAt: toDateTimeInputValue(baseStart.toISOString()),
      endsAt: toDateTimeInputValue(baseEnd.toISOString()),
    }));
    setQuickCreateHint(`Quick create prepared for ${formatSelectedDayLabel(day)}.`);
  }, []);

  const prefillFormForDateTime = useCallback((day: Date, hour: number) => {
    const startAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
    setEditingSeriesId(null);
    setForm((prev) => ({
      ...prev,
      isAllDay: false,
      allDayStartDate: toDateInputValue(startAt.toISOString()),
      allDayEndDate: toDateInputValue(startAt.toISOString()),
      startsAt: toDateTimeInputValue(startAt.toISOString()),
      endsAt: toDateTimeInputValue(endAt.toISOString()),
    }));
    setQuickCreateHint(`Timed draft prepared for ${formatSelectedDayLabel(day)} at ${formatHourLabel(hour)}.`);
  }, []);

  const prefillFormForRange = useCallback((rawStart: Date, rawEnd: Date) => {
    const start = rawStart <= rawEnd ? rawStart : rawEnd;
    const end = rawStart <= rawEnd ? rawEnd : rawStart;
    const startDate = toDateInputValue(start.toISOString());
    const endDate = toDateInputValue(end.toISOString());
    setEditingSeriesId(null);
    setForm((prev) => ({
      ...prev,
      isAllDay: true,
      allDayStartDate: startDate,
      allDayEndDate: endDate,
    }));
    setQuickCreateHint(
      `All-day draft prepared for ${formatSelectedDayLabel(start)} to ${formatSelectedDayLabel(end)}.`,
    );
  }, []);

  const setSelectedDateWithMonthSync = useCallback(
    (nextDate: Date, options?: { quickCreate?: boolean }) => {
      setSelectedDate(nextDate);
      updateDisplayMonthFromDate(nextDate);
      if (options?.quickCreate) {
        prefillFormForDay(nextDate);
      }
    },
    [prefillFormForDay, updateDisplayMonthFromDate],
  );

  const navigatePeriod = useCallback(
    (direction: -1 | 1) => {
      if (viewMode === 'day') {
        setSelectedDateWithMonthSync(addDays(selectedDate, direction));
        return;
      }

      if (viewMode === 'week') {
        setSelectedDateWithMonthSync(addDays(selectedDate, 7 * direction));
        return;
      }

      setDisplayMonth((prev) => {
        const next = new Date(prev.getFullYear(), prev.getMonth() + direction, 1);
        if (selectedDate.getFullYear() === prev.getFullYear() && selectedDate.getMonth() === prev.getMonth()) {
          const nextSelected = new Date(selectedDate);
          nextSelected.setMonth(next.getMonth(), Math.min(selectedDate.getDate(), 28));
          setSelectedDate(nextSelected);
        }
        return next;
      });
    },
    [selectedDate, setSelectedDateWithMonthSync, viewMode],
  );

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
    setQuickCreateHint(null);
  };

  const startEditing = (eventSeries: CalendarEventSeries) => {
    const now = new Date();
    const inHour = new Date(now.getTime() + 60 * 60 * 1000);
    const defaultDate = toDateInputValue(now.toISOString());
    const hasDateRange = Boolean(eventSeries.startsAt && eventSeries.endsAt);
    setEditingSeriesId(eventSeries.id);
    setQuickCreateHint(null);
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

  const handleCalendarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = selectedDate;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSelectedDateWithMonthSync(addDays(current, -1));
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSelectedDateWithMonthSync(addDays(current, 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedDateWithMonthSync(addDays(current, -7));
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedDateWithMonthSync(addDays(current, 7));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      prefillFormForDay(current);
    }
  };

  const dragRangeBounds = useMemo(() => {
    if (!dragStartDate || !dragCurrentDate) {
      return null;
    }

    const start = dragStartDate <= dragCurrentDate ? dragStartDate : dragCurrentDate;
    const end = dragStartDate <= dragCurrentDate ? dragCurrentDate : dragStartDate;
    return {
      startKey: keyFromDate(start),
      endKey: keyFromDate(end),
    };
  }, [dragCurrentDate, dragStartDate]);

  const completeDragSelection = useCallback(() => {
    if (!dragStartDate || !dragCurrentDate) {
      setIsDragSelecting(false);
      return;
    }

    if (isSameDay(dragStartDate, dragCurrentDate)) {
      setSelectedDateWithMonthSync(dragCurrentDate, { quickCreate: true });
    } else {
      setSelectedDateWithMonthSync(dragStartDate);
      prefillFormForRange(dragStartDate, dragCurrentDate);
    }

    setIsDragSelecting(false);
    setDragStartDate(null);
    setDragCurrentDate(null);
  }, [dragCurrentDate, dragStartDate, prefillFormForRange, setSelectedDateWithMonthSync]);

  useEffect(() => {
    if (!isDragSelecting) {
      return;
    }

    const handleMouseUp = () => {
      completeDragSelection();
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [completeDragSelection, isDragSelecting]);

  useEffect(() => {
    if (viewMode === 'month') {
      return;
    }

    setIsDragSelecting(false);
    setDragStartDate(null);
    setDragCurrentDate(null);
  }, [viewMode]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <div className="rounded-2xl border bg-card/80 p-5 shadow-sm backdrop-blur md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Plan team events with recurring schedules, quick editing, and a focused day agenda.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border bg-background px-3 py-2 text-center">
              <p className="text-lg font-semibold leading-none">{series.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Series</p>
            </div>
            <div className="rounded-xl border bg-background px-3 py-2 text-center">
              <p className="text-lg font-semibold leading-none">{occurrences.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Occurrences</p>
            </div>
            <div className="rounded-xl border bg-background px-3 py-2 text-center">
              <p className="text-lg font-semibold leading-none">{selectedDayOccurrences.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Selected Day</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <Card className="overflow-hidden rounded-2xl border shadow-sm">
          <CardHeader className="space-y-4 border-b bg-muted/20 pb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                  {calendarTitle}
                </CardTitle>
                <CardDescription>
                  {isLoading
                    ? 'Loading events...'
                    : viewMode === 'month'
                      ? 'Click to quick-create, or drag across days to draft an all-day range.'
                      : 'Click an hour lane to draft a timed event.'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden rounded-lg border bg-background p-1 sm:flex">
                  {(['month', 'week', 'day'] as CalendarViewMode[]).map((mode) => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={viewMode === mode ? 'secondary' : 'ghost'}
                      onClick={() => setViewMode(mode)}
                    >
                      {mode[0].toUpperCase() + mode.slice(1)}
                    </Button>
                  ))}
                </div>
                <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => navigatePeriod(-1)}>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const today = new Date();
                    setDisplayMonth(today);
                    setSelectedDate(today);
                    setViewMode('month');
                  }}
                >
                  Today
                </Button>
                <Button variant="outline" size="icon" aria-label="Next month" onClick={() => navigatePeriod(1)}>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4">
            {viewMode === 'month' ? (
              <>
                <div className="mb-2 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:text-xs">
                  {weekDayHeaders.map((day) => (
                    <div key={day} className="px-1 py-1">
                      {day}
                    </div>
                  ))}
                </div>
                <div
                  className="grid gap-2 md:grid-cols-7"
                  role="grid"
                  tabIndex={0}
                  aria-label="Month calendar grid"
                  onKeyDown={handleCalendarKeyDown}
                >
                  {visibleDays.map((day) => {
                    const dayKey = keyFromDate(day);
                    const dayOccurrences = occurrencesByDay[dayKey] ?? [];
                    const isCurrentMonth = day.getMonth() === displayMonth.getMonth();
                    const isToday = isSameDay(day, new Date());
                    const isSelected = isSameDay(day, selectedDate);
                    const isDraggingDay =
                      Boolean(dragRangeBounds) &&
                      dayKey >= String(dragRangeBounds?.startKey) &&
                      dayKey <= String(dragRangeBounds?.endKey);

                    return (
                      <button
                        type="button"
                        key={dayKey}
                        onMouseDown={() => {
                          setDragStartDate(day);
                          setDragCurrentDate(day);
                          setIsDragSelecting(true);
                        }}
                        onMouseEnter={() => {
                          if (isDragSelecting) {
                            setDragCurrentDate(day);
                          }
                        }}
                        onMouseUp={() => {
                          if (isDragSelecting) {
                            setDragCurrentDate(day);
                            completeDragSelection();
                          }
                        }}
                        className={`min-h-28 rounded-xl border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-32 ${
                          isCurrentMonth ? 'bg-card hover:bg-accent/40' : 'bg-muted/30 text-muted-foreground'
                        } ${isToday ? 'border-primary/60' : ''} ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''} ${
                          isDraggingDay ? 'bg-accent/40' : ''
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${isToday ? 'bg-primary text-primary-foreground' : ''}`}
                          >
                            {day.getDate()}
                          </span>
                          {dayOccurrences.length > 0 && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              {dayOccurrences.length}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {dayOccurrences.slice(0, 2).map((occurrence) => (
                            <div
                              key={occurrence.occurrenceId}
                              className={`rounded-md border-l-4 px-2 py-1 text-[11px] leading-tight ${seriesColorClassName(occurrence.seriesId)}`}
                            >
                              <p className="truncate font-medium">{occurrence.title}</p>
                              <p className="text-muted-foreground">
                                {seriesById.get(occurrence.seriesId)?.isAllDay
                                  ? 'All day'
                                  : formatOccurrenceTime(occurrence.startsAt)}
                              </p>
                            </div>
                          ))}
                          {dayOccurrences.length > 2 && (
                            <p className="text-[11px] text-muted-foreground">+{dayOccurrences.length - 2} more</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="overflow-x-auto">
                <div
                  className={`grid min-w-[680px] rounded-xl border bg-background ${
                    viewMode === 'day'
                      ? 'grid-cols-[5.25rem_minmax(16rem,1fr)]'
                      : 'grid-cols-[5.25rem_repeat(7,minmax(9rem,1fr))]'
                  }`}
                  role="grid"
                  tabIndex={0}
                  aria-label="Timed calendar grid"
                  onKeyDown={handleCalendarKeyDown}
                >
                  <div className="border-b border-r px-2 py-2 text-xs font-semibold text-muted-foreground">Time</div>
                  {visibleDays.map((day) => {
                    const isToday = isSameDay(day, new Date());
                    const isSelected = isSameDay(day, selectedDate);

                    return (
                      <button
                        key={keyFromDate(day)}
                        type="button"
                        className={`border-b px-2 py-2 text-left text-xs font-semibold ${
                          isToday ? 'text-primary' : 'text-muted-foreground'
                        } ${isSelected ? 'bg-accent/40' : ''}`}
                        onClick={() => setSelectedDateWithMonthSync(day)}
                      >
                        {day.toLocaleDateString('en-US', {
                          weekday: viewMode === 'day' ? 'long' : 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </button>
                    );
                  })}

                  <div className="border-r px-2 py-2 text-xs font-medium text-muted-foreground">All day</div>
                  {visibleDays.map((day) => {
                    const dayKey = keyFromDate(day);
                    const allDayItems = allDayOccurrencesByDay[dayKey] ?? [];

                    return (
                      <div key={`all-day-${dayKey}`} className="space-y-1 px-2 py-2">
                        {allDayItems.length === 0 ? (
                          <button
                            type="button"
                            className="w-full rounded-md border border-dashed px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-accent/30"
                            onClick={() => {
                              setSelectedDateWithMonthSync(day);
                              prefillFormForDay(day);
                            }}
                          >
                            Add all-day
                          </button>
                        ) : (
                          allDayItems.slice(0, 2).map((occurrence) => (
                            <div
                              key={occurrence.occurrenceId}
                              className={`rounded-md border-l-4 px-2 py-1 text-[11px] ${seriesColorClassName(occurrence.seriesId)}`}
                            >
                              <p className="truncate font-medium">{occurrence.title}</p>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}

                  {timeSlots.map((hour) => (
                    <Fragment key={`slot-row-${hour}`}>
                      <div
                        key={`slot-label-${hour}`}
                        className="border-r border-t px-2 py-2 text-xs text-muted-foreground"
                      >
                        {formatHourLabel(hour)}
                      </div>
                      {visibleDays.map((day) => {
                        const dayKey = keyFromDate(day);
                        const slotItems = timedOccurrencesByDayHour[dayKey]?.[hour] ?? [];
                        return (
                          <button
                            key={`slot-${dayKey}-${hour}`}
                            type="button"
                            className="min-h-14 border-t px-2 py-2 text-left transition hover:bg-accent/30"
                            onClick={() => {
                              setSelectedDateWithMonthSync(day);
                              prefillFormForDateTime(day, hour);
                            }}
                          >
                            <div className="space-y-1">
                              {slotItems.slice(0, 2).map((occurrence) => (
                                <div
                                  key={occurrence.occurrenceId}
                                  className={`rounded-md border-l-4 px-2 py-1 text-[11px] ${seriesColorClassName(occurrence.seriesId)}`}
                                >
                                  <p className="truncate font-medium">{occurrence.title}</p>
                                  <p className="text-muted-foreground">{formatOccurrenceTime(occurrence.startsAt)}</p>
                                </div>
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-lg">Agenda</CardTitle>
              <CardDescription>{formatSelectedDayLabel(selectedDate)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {quickCreateHint && <p className="text-xs text-primary">{quickCreateHint}</p>}
              {!selectedDayOccurrences.length ? (
                <p className="rounded-lg border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">
                  No events on this day.
                </p>
              ) : (
                selectedDayOccurrences.map((occurrence) => {
                  const eventSeries = seriesById.get(occurrence.seriesId);
                  return (
                    <div
                      key={occurrence.occurrenceId}
                      className={`rounded-xl border-l-4 px-3 py-2 ${seriesColorClassName(occurrence.seriesId)}`}
                    >
                      <p className="text-sm font-medium">{occurrence.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                          {eventSeries?.isAllDay ? 'All day' : formatOccurrenceTime(occurrence.startsAt)}
                        </span>
                        {occurrence.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            {occurrence.location}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border shadow-sm">
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
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Event Series</CardTitle>
          <CardDescription>Edit or remove a recurring series and all of its future occurrences.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2">
            {colorByIndex.map((className, index) => (
              <span
                key={className}
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground ${className}`}
              >
                Calendar {index + 1}
              </span>
            ))}
          </div>
          {!series.length ? (
            <p className="text-sm text-muted-foreground">No events yet. Create one to populate the calendar.</p>
          ) : (
            <div className="space-y-3 pt-2">
              {series.map((eventSeries) => (
                <div
                  key={eventSeries.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-l-4 px-3 py-3 ${seriesColorClassName(eventSeries.id)}`}
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
