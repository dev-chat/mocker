export interface ICounter {
  requestorId: string;
  counteredId: string;
  removalFn: NodeJS.Timeout;
}

export interface ICounterMuzzle {
  counterId: number;
  suppressionCount: number;
  removalFn: NodeJS.Timeout;
}
