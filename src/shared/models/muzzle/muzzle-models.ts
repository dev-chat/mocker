export interface IMuzzled {
  suppressionCount: number;
  muzzledBy: string;
  transactionId: number;
  removalFn: NodeJS.Timeout;
}

export interface IMuzzler {
  muzzleCount: number;
  muzzleCountRemover?: NodeJS.Timeout;
}
