export interface IMuzzled {
  suppressionCount: number;
  muzzledBy: string;
  removalFn: NodeJS.Timeout;
}

export interface IMuzzler {
  muzzleCount: number;
  muzzleCountRemover?: NodeJS.Timeout;
}
