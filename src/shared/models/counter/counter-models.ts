import { Timeout } from '../../../services/muzzle/muzzle-utilities';

export interface CounterItem {
  requestorId: string;
  removalFn: Timeout;
}

export interface CounterMuzzle {
  counterId: number;
  suppressionCount: number;
  removalFn: Timeout;
}
