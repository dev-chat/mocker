describe('config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('falls back to default API URL when env is unset', async () => {
    vi.stubEnv('VITE_API_BASE_URL', undefined as unknown as string);
    vi.resetModules();

    const mod = await import('@/config');
    expect(mod.API_BASE_URL).toBe('https://api.muzzle.lol');
  });

  it('exports API_BASE_URL from env when set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://example.local');
    vi.resetModules();

    const mod = await import('@/config');
    expect(mod.API_BASE_URL).toBe('https://example.local');
  });

  it('throws when API base URL is an empty string', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.resetModules();

    await expect(import('@/config')).rejects.toThrow('VITE_API_BASE_URL must be set');
  });
});
