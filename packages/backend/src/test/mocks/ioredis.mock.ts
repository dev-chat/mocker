export class Redis {
  private readonly store = new Map<string, string>();

  on(_event: string, _listener: (...args: unknown[]) => void): this {
    void _event;
    void _listener;
    return this;
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.store.get(key) ?? null);
  }

  set(key: string, value: string | number, _mode?: string): Promise<string> {
    void _mode;
    this.store.set(key, String(value));
    return Promise.resolve('OK');
  }

  setex(key: string, _seconds: number, value: string | number): Promise<string> {
    this.store.set(key, String(value));
    return Promise.resolve('OK');
  }

  psetex(key: string, _milliseconds: number, value: string | number): Promise<string> {
    this.store.set(key, String(value));
    return Promise.resolve('OK');
  }

  ttl(_key: string): Promise<number> {
    void _key;
    return Promise.resolve(60);
  }

  expire(_key: string, _seconds: number): Promise<number> {
    void _key;
    void _seconds;
    return Promise.resolve(1);
  }

  subscribe(_channel: string): Promise<number> {
    void _channel;
    return Promise.resolve(1);
  }

  keys(pattern: string): Promise<string[]> {
    const sanitizedPattern = pattern.replace(/\*/g, '');
    const keys = [...this.store.keys()].filter((k) => k.includes(sanitizedPattern));
    return Promise.resolve(keys);
  }

  del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    return Promise.resolve(existed ? 1 : 0);
  }
}

export default Redis;
