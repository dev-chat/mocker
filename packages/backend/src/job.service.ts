import cron from 'node-cron';
import { FunFactJob } from './jobs/fun-fact.job';
import { PricingJob } from './jobs/pricing.job';
import { EventAlertJob } from './jobs/event-alert.job';
import { logger } from './shared/logger/logger';

export class JobService {
  private funFactJob: FunFactJob;
  private pricingJob: PricingJob;
  private eventAlertJob: EventAlertJob;
  private jobServiceLogger = logger.child({ module: 'JobService' });

  constructor() {
    this.funFactJob = new FunFactJob();
    this.pricingJob = new PricingJob();
    this.eventAlertJob = new EventAlertJob();
  }

  /**
   * Run the fun fact job
   */
  async runFunFactJob(): Promise<void> {
    this.jobServiceLogger.info('Running fun fact job');
    try {
      await this.funFactJob.run();
      this.jobServiceLogger.info('Fun fact job completed successfully');
    } catch (error) {
      this.jobServiceLogger.error('Fun fact job failed:', error);
      throw error;
    }
  }

  /**
   * Run the pricing job
   */
  async runPricingJob(): Promise<void> {
    this.jobServiceLogger.info('Running pricing job');
    try {
      await this.pricingJob.run();
      this.jobServiceLogger.info('Pricing job completed successfully');
    } catch (error) {
      this.jobServiceLogger.error('Pricing job failed:', error);
      throw error;
    }
  }

  /**
   * Run event alert job that notifies #events about events occurring today / within 24h.
   */
  async runEventAlertJob(): Promise<void> {
    this.jobServiceLogger.info('Running event alert job');
    try {
      await this.eventAlertJob.run();
      this.jobServiceLogger.info('Event alert job completed successfully');
    } catch (error) {
      this.jobServiceLogger.error('Event alert job failed:', error);
      throw error;
    }
  }

  /**
   * Schedule all cron jobs on startup.
   * Fun fact job runs daily at 9AM.
   * Pricing job runs every hour at minute 10.
   */
  scheduleCronJobs(): void {
    this.jobServiceLogger.info('Scheduling cron jobs');

    // Fun fact job: daily at 9AM America/New_York
    cron.schedule(
      '0 9 * * *',
      () => {
        this.runFunFactJob().catch((error) => {
          this.jobServiceLogger.error('Fun-fact job failed:', error);
        });
      },
      { timezone: 'America/New_York' },
    );
    this.jobServiceLogger.info('Fun-fact job scheduled daily at 9AM America/New_York time.');

    // Pricing job: every hour at minute 10 America/New_York
    cron.schedule(
      '10 * * * *',
      () => {
        this.runPricingJob().catch((error) => {
          this.jobServiceLogger.error('Pricing job failed:', error);
        });
      },
      { timezone: 'America/New_York' },
    );
    this.jobServiceLogger.info('Pricing job scheduled every hour at minute 10 America/New_York time.');

    // Event alert job: every hour at minute 5 America/New_York
    cron.schedule(
      '5 * * * *',
      () => {
        this.runEventAlertJob().catch((error) => {
          this.jobServiceLogger.error('Event alert job failed:', error);
        });
      },
      { timezone: 'America/New_York' },
    );
    this.jobServiceLogger.info('Event alert job scheduled every hour at minute 5 America/New_York time.');
  }
}
