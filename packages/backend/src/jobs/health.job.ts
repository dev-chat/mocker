import Axios from 'axios';
import { WebService } from '../shared/services/web/web.service';
import { logger } from '../shared/logger/logger';

export const HEALTH_MAX_ATTEMPTS = parseInt(process.env.HEALTH_MAX_ATTEMPTS ?? '5', 10);
export const HEALTH_SLEEP_MS = parseInt(process.env.HEALTH_SLEEP_MS ?? '1000', 10);
export const HEALTH_TIMEOUT_MS = parseInt(process.env.HEALTH_TIMEOUT_MS ?? '15000', 10);
export const HEALTH_SLACK_CHANNEL = process.env.HEALTH_SLACK_CHANNEL ?? '#muzzlefeedback';

const HEALTH_ALERT_MESSAGE =
  ':this-is-fine: `Moonbeam is experiencing some technical difficulties at the moment.` :this-is-fine:';

export class HealthJob {
  private webService = new WebService();
  private jobLogger = logger.child({ module: 'HealthJob' });

  private get healthUrl(): string {
    return process.env.HEALTH_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}/health`;
  }

  async run(): Promise<void> {
    this.jobLogger.info(`Starting health check for ${this.healthUrl}`);

    const healthy = await this.checkHealth();
    if (healthy) {
      this.jobLogger.info('Health check passed');
      return;
    }

    this.jobLogger.error('Health check failed after all retry attempts; sending Slack alert');
    try {
      await this.webService.sendMessage(HEALTH_SLACK_CHANNEL, HEALTH_ALERT_MESSAGE);
      this.jobLogger.info(`Sent health alert to ${HEALTH_SLACK_CHANNEL}`);
    } catch (e) {
      this.jobLogger.error('Failed to send health alert to Slack', e);
    }
  }

  private async checkHealth(): Promise<boolean> {
    for (let attempt = 1; attempt <= HEALTH_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await Axios.get<unknown>(this.healthUrl, { timeout: HEALTH_TIMEOUT_MS });
        if (response.status >= 200 && response.status < 300) {
          this.jobLogger.info(`Health check attempt ${attempt}/${HEALTH_MAX_ATTEMPTS}: HTTP ${response.status}`);
          return true;
        }
        this.jobLogger.warn(
          `Health check attempt ${attempt}/${HEALTH_MAX_ATTEMPTS}: HTTP ${response.status}`,
        );
      } catch (e) {
        this.jobLogger.warn(`Health check attempt ${attempt}/${HEALTH_MAX_ATTEMPTS}: request failed`, e);
      }

      if (attempt < HEALTH_MAX_ATTEMPTS) {
        await this.sleep(HEALTH_SLEEP_MS);
      }
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
