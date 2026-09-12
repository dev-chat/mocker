export class Redis {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>();

  private getEntry(key: string): { value: string; expiresAt: number | null } | undefined {
    const entry = this.store.get(key);
    if (entry?.expiresAt !== null && entry?.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  on(_event: string, _listener: (...args: unknown[]) => void): this {
    void _event;
    void _listener;
    return this;
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.getEntry(key)?.value ?? null);
  }

  set(key: string, value: string | number, mode?: string): Promise<string> {
    const expiresAt = mode === 'KEEPTTL' ? (this.getEntry(key)?.expiresAt ?? null) : null;
    this.store.set(key, { value: String(value), expiresAt });
    return Promise.resolve('OK');
  }

  setex(key: string, seconds: number, value: string | number): Promise<string> {
    this.store.set(key, { value: String(value), expiresAt: Date.now() + seconds * 1000 });
    return Promise.resolve('OK');
  }

  psetex(key: string, milliseconds: number, value: string | number): Promise<string> {
    this.store.set(key, { value: String(value), expiresAt: Date.now() + milliseconds });
    return Promise.resolve('OK');
  }

  ttl(key: string): Promise<number> {
    const entry = this.getEntry(key);
    if (!entry) return Promise.resolve(-2);
    if (entry.expiresAt === null) return Promise.resolve(-1);
    return Promise.resolve(Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000)));
  }

  expire(key: string, seconds: number): Promise<number> {
    const entry = this.getEntry(key);
    if (!entry) return Promise.resolve(0);
    entry.expiresAt = Date.now() + seconds * 1000;
    return Promise.resolve(1);
  }

  subscribe(_channel: string): Promise<number> {
    void _channel;
    return Promise.resolve(1);
  }

  keys(pattern: string): Promise<string[]> {
    const sanitizedPattern = pattern.replace(/\*/g, '');
    const keys = [...this.store.keys()].filter((key) => this.getEntry(key) && key.includes(sanitizedPattern));
    return Promise.resolve(keys);
  }

  del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    return Promise.resolve(existed ? 1 : 0);
  }
}

export default Redis;
