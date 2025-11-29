import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

type AppComponent = typeof import('../App')['default'];
let App: AppComponent;

const loadApp = async () => {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000');
  ({ default: App } = await import('../App'));
};

type SessionPayload = {
  user: {
    email: string;
    name?: string | null;
    role?: string | null;
  } | null;
};

const mockFetch = (payload: SessionPayload, ok = true) =>
  vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response);

describe('App', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await loadApp();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the split layout and triggers backend-controlled login', async () => {
    global.fetch = mockFetch({ user: null }) as unknown as typeof fetch;

    const user = userEvent.setup();
    const beginLogin = vi.fn();
    render(<App onBeginLogin={beginLogin} />);

    expect(await screen.findByAltText(/roshni logo/i)).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();

    const loginButton = await screen.findByRole('button', { name: /continue with google/i });
    await user.click(loginButton);

    expect(beginLogin).toHaveBeenCalledWith('http://localhost:8000/auth/login');
  });

  it('shows the signed-in state when the backend session exists', async () => {
    global.fetch = mockFetch({
      user: { email: 'civ@example.com', name: 'Civic Test', role: 'civilian' },
    }) as unknown as typeof fetch;

    render(<App />);

    expect(await screen.findByRole('button', { name: /logout/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Civic Test/i).length).toBeGreaterThan(0);
    const dashboardHeading = await screen.findByRole('heading', { name: /civilian dashboard/i });
    expect(dashboardHeading).toBeInTheDocument();
  });

  it('surfaces backend connectivity issues', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;

    render(<App />);

    await waitFor(() =>
      expect(
        screen.getByText(/Unable to reach the authentication service/i),
      ).toBeInTheDocument(),
    );
  });
});
