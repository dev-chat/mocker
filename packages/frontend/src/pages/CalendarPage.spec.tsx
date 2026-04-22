import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CalendarPage } from '@/pages/CalendarPage';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const sampleResponse = {
  series: [
    {
      id: '8f1c2a9f-3e8c-4d2b-b2f8-0a2fdc6ef4a1',
      teamId: 'T1',
      createdByUserId: 'U1',
      title: 'Planning 🚀',
      location: 'HQ',
      isAllDay: false,
      startsAt: '2026-04-21T16:00:00.000Z',
      endsAt: '2026-04-21T17:00:00.000Z',
      recurrence: null,
      createdAt: '2026-04-20T12:00:00.000Z',
      updatedAt: '2026-04-20T12:00:00.000Z',
    },
  ],
  occurrences: [
    {
      occurrenceId: '8f1c2a9f-3e8c-4d2b-b2f8-0a2fdc6ef4a1:2026-04-21T16:00:00.000Z',
      seriesId: '8f1c2a9f-3e8c-4d2b-b2f8-0a2fdc6ef4a1',
      title: 'Planning 🚀',
      location: 'HQ',
      startsAt: '2026-04-21T16:00:00.000Z',
      endsAt: '2026-04-21T17:00:00.000Z',
      isAllDay: false,
      isRecurring: false,
    },
  ],
};

describe('CalendarPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => sampleResponse });
  });

  it('logs out on initial 401 response', async () => {
    const onLogout = vi.fn();
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) });

    render(<CalendarPage onLogout={onLogout} />);

    await waitFor(() => expect(onLogout).toHaveBeenCalledOnce());
  });

  it('shows a load error message when initial fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error', json: async () => ({}) });

    render(<CalendarPage onLogout={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Failed to load calendar events: Server Error')).toBeInTheDocument());
  });

  it('loads and renders event series', async () => {
    render(<CalendarPage onLogout={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Planning 🚀').length).toBeGreaterThan(0));
  });

  it('saves a new event', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => sampleResponse })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: 2 }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => sampleResponse });

    render(<CalendarPage onLogout={vi.fn()} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Demo Day 🎉' } });
    fireEvent.click(screen.getByRole('button', { name: /create event/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    const [, createRequest] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(createRequest.method).toBe('POST');
    expect(String(createRequest.body)).toContain('Demo Day 🎉');
  });

  it('saves an interval recurrence such as every 2 weeks', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => sampleResponse })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 'c14558d4-1f78-4f38-84f0-f7d5a5a50b67' }),
      })
      .mockResolvedValue({ ok: true, status: 200, json: async () => sampleResponse });

    render(<CalendarPage onLogout={vi.fn()} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Biweekly Sync' } });
    fireEvent.change(screen.getByLabelText('Recurrence'), { target: { value: 'weekly' } });
    fireEvent.change(screen.getByLabelText('Repeat Every'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /create event/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    const [, createRequest] = mockFetch.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(String(createRequest.body)) as {
      recurrence: { frequency: string; interval: number } | null;
    };

    expect(body.recurrence).toEqual({ frequency: 'weekly', interval: 2 });
  });

  it('saves a multi-day all-day event with explicit all-day date range', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => sampleResponse })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: 3 }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => sampleResponse });

    render(<CalendarPage onLogout={vi.fn()} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Company Holiday' } });
    fireEvent.click(screen.getByLabelText('All day event'));
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-04-21' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-04-23' } });
    fireEvent.click(screen.getByRole('button', { name: /create event/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    const [, createRequest] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(createRequest.method).toBe('POST');
    const body = JSON.parse(String(createRequest.body)) as {
      isAllDay: boolean;
      allDayStartDate: string;
      allDayEndDate: string;
      startsAt: string | null;
      endsAt: string | null;
    };
    expect(body.isAllDay).toBe(true);
    expect(body.allDayStartDate).toBe('2026-04-21');
    expect(body.allDayEndDate).toBe('2026-04-23');
    expect(body.startsAt).toBeNull();
    expect(body.endsAt).toBeNull();
  });

  it('shows a validation error for empty title', async () => {
    render(<CalendarPage onLogout={vi.fn()} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /create event/i }));

    expect(screen.getByText('Event title is required.')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('shows a validation error when end is before start for timed events', async () => {
    render(<CalendarPage onLogout={vi.fn()} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Bad Timing' } });
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-04-21T12:00' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-04-21T11:00' } });
    fireEvent.click(screen.getByRole('button', { name: /create event/i }));

    expect(screen.getByText('Start and end date must be valid, and end must be after start.')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('shows a validation error for invalid all-day date range', async () => {
    render(<CalendarPage onLogout={vi.fn()} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'All Day Validation' } });
    fireEvent.click(screen.getByLabelText('All day event'));
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-04-23' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-04-21' } });
    fireEvent.click(screen.getByRole('button', { name: /create event/i }));

    expect(
      screen.getByText('All-day date range must be valid, and end date must be on or after start date.'),
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('shows a validation error for invalid recurrence interval', async () => {
    render(<CalendarPage onLogout={vi.fn()} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Interval Validation' } });
    fireEvent.change(screen.getByLabelText('Recurrence'), { target: { value: 'weekly' } });
    fireEvent.change(screen.getByLabelText('Repeat Every'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /create event/i }));

    expect(screen.getByText('Recurrence interval must be between 1 and 365.')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('allows editing, cancelling, and handling update failures', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => sampleResponse })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    render(<CalendarPage onLogout={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('button', { name: /update event/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /update event/i }));
    await waitFor(() => expect(screen.getByText('Failed to update event')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /cancel edit/i }));
    expect(screen.getByRole('button', { name: /create event/i })).toBeInTheDocument();
  });

  it('logs out on 401 when creating an event', async () => {
    const onLogout = vi.fn();
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => sampleResponse })
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) });

    render(<CalendarPage onLogout={onLogout} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Needs Auth' } });
    fireEvent.click(screen.getByRole('button', { name: /create event/i }));

    await waitFor(() => expect(onLogout).toHaveBeenCalledOnce());
  });

  it('shows delete failure and handles month navigation controls', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => sampleResponse })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => sampleResponse });

    render(<CalendarPage onLogout={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByText('Failed to delete event')).toBeInTheDocument());

    const previousMonthButton = screen.getByRole('button', { name: 'Previous month' });
    const nextMonthButton = screen.getByRole('button', { name: 'Next month' });
    const todayButton = screen.getByRole('button', { name: 'Today' });

    fireEvent.click(previousMonthButton);
    fireEvent.click(nextMonthButton);
    fireEvent.click(todayButton);

    await waitFor(() => expect(mockFetch.mock.calls.length).toBeGreaterThan(1));
  });
});
