import { vi } from 'vitest';

type DecoratorFactory = (...args: unknown[]) => unknown;

const noopDecoratorFactory: DecoratorFactory = () => () => undefined;

export const Entity = noopDecoratorFactory;
export const Column = noopDecoratorFactory;
export const PrimaryGeneratedColumn = noopDecoratorFactory;
export const PrimaryColumn = noopDecoratorFactory;
export const OneToMany = noopDecoratorFactory;
export const OneToOne = noopDecoratorFactory;
export const ManyToOne = noopDecoratorFactory;
export const Unique = noopDecoratorFactory;

export const getRepository = vi.fn();
export const getManager = vi.fn();
export const createConnection = vi.fn(async () => ({ close: vi.fn() }));
export const getConnectionOptions = vi.fn(async () => ({}));

export const Like = vi.fn((value: unknown) => ({ _type: 'like', _value: value }));
