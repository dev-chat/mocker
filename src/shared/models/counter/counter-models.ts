export interface CounterItem {
  requestorId: string;
  removalFn: NodeJS.Timeout;
}

export interface CounterMuzzle {
  counterId: number;
  suppressionCount: number;
  removalFn: NodeJS.Timeout;
}
