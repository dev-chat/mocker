import { render, screen, waitFor } from '@testing-library/react';
import { PersonalContextPage } from '@/pages/PersonalContextPage';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const fullData = {
  memories: [{ id: 1, content: 'Prefers concise summaries', updatedAt: '2026-04-20T00:00:00.000Z' }],
  traits: [{ id: 2, content: 'Strong systems thinker', updatedAt: '2026-04-19T00:00:00.000Z' }],
};

const emptyData = {
  memories: [],
  traits: [],
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe('PersonalContextPage', () => {
  it('shows heading and renders fetched memories/traits', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => fullData });
    render(<PersonalContextPage onLogout={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /your memory \+ traits/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Prefers concise summaries')).toBeInTheDocument());
    expect(screen.getByText('Strong systems thinker')).toBeInTheDocument();
  });

  it('shows empty state messages when there is no data', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => emptyData });
    render(<PersonalContextPage onLogout={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/does not have any memories about you yet/i)).toBeInTheDocument());
    expect(screen.getByText(/does not have any core traits about you yet/i)).toBeInTheDocument();
  });

  it('shows an error banner when fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
    render(<PersonalContextPage onLogout={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/failed to load personal context/i)).toBeInTheDocument());
  });

  it('calls onLogout when response is 401', async () => {
    const onLogout = vi.fn();
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    render(<PersonalContextPage onLogout={onLogout} />);

    await waitFor(() => expect(onLogout).toHaveBeenCalledOnce());
  });
});
