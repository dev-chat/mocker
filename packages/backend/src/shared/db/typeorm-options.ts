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

  const defaultEntities = [
    path.join(process.cwd(), 'src/shared/db/models/*.{ts,js}'),
    path.join(process.cwd(), 'dist/shared/db/models/*.js'),
  ];

  return Array.from(new Set([...configuredEntities, ...defaultEntities]));
};
