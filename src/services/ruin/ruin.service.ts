import { SuppressorService } from '../../shared/services/suppressor.service';

export class RuinService extends SuppressorService {
  ruin(channel: string, userId: string, text: string, timestamp: string): void {
    this.sendSuppressedMessage(channel, userId, text, timestamp);
  }
}
