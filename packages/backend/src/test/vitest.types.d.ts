declare type Mock = import('vitest').Mock;

declare var classMock: <T>(factory: () => T) => import('vitest').Mock;
