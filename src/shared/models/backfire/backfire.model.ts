export interface BackfireItem {
  suppressionCount: number;
  id: number;
  removalFn: NodeJS.Timeout;
}
