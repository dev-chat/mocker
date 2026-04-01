import path from 'path';

const parseConfiguredEntities = (): string[] => {
  const configured = process.env.TYPEORM_ENTITIES ?? '';
  return configured
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const resolveTypeOrmEntities = (): string[] => {
  const configuredEntities = parseConfiguredEntities();

  // If TYPEORM_ENTITIES is configured, use it exclusively.
  if (configuredEntities.length > 0) {
    return Array.from(new Set(configuredEntities));
  }

  // Otherwise, select either the src or dist pattern, but not both.
  const isTsRuntime = __filename.endsWith('.ts');

  if (isTsRuntime) {
    return [path.join(process.cwd(), 'src/shared/db/models/*.{ts,js}')];
  }

  return [path.join(process.cwd(), 'dist/shared/db/models/*.js')];
};
