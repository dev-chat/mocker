export interface ICounter {
  requestorId: string;
  counteredId: string;
  removalFn: NodeJS.Timeout;
}
