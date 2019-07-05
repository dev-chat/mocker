export interface IMuzzled {
  suppressionCount: number;
  muzzledBy: string;
  id: number;
  removalFn: NodeJS.Timeout;
}

export interface IRequestor {
  muzzleCount: number;
  muzzleCountRemover?: NodeJS.Timeout;
}
