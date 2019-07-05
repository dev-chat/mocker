export interface IMuzzled {
  suppressionCount: number;
  muzzledBy: string;
  id: number;
  removalFn: NodeJS.Timeout;
}

export interface IMuzzler {
  muzzleCount: number;
  muzzleCountRemover?: NodeJS.Timeout;
}
