export interface Muzzled {
  suppressionCount: number;
  muzzledBy: string;
  id: number;
  isCounter: boolean;
  removalFn: NodeJS.Timeout;
}

export interface Requestor {
  muzzleCount: number;
  muzzleCountRemover?: NodeJS.Timeout;
}
