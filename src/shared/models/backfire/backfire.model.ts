export interface IBackfire {
  suppressionCount: number;
  id: number;
  removalFn: NodeJS.Timeout;
}
