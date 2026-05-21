import cron from 'node-cron';
import { MemoryJob } from './ai/memory/memory.job';
import { FunFactJob } from './jobs/fun-fact.job';
import { PricingJob } from './jobs/pricing.job';
import { EventAlertJob } from './jobs/event-alert.job';
import { logger } from './shared/logger/logger';
import { TraitJob } from './trait/trait.job';
import { ArgumentJob } from './argument/argument.job';

export class JobService {
  private memoryJob: MemoryJob;
  private argumentJob: ArgumentJob;
  private traitJob: TraitJob;
  private funFactJob: FunFactJob;
  private pricingJob: PricingJob;
  private eventAlertJob: EventAlertJob;
  private jobServiceLogger = logger.child({ module: 'JobService' });

  constructor() {
    this.memoryJob = new MemoryJob();
    this.argumentJob = new ArgumentJob();
    this.traitJob = new TraitJob();
    this.funFactJob = new FunFactJob();
    this.pricingJob = new PricingJob();
    this.eventAlertJob = new EventAlertJob();
  }

  /**
   * Run the nightly analysis jobs in sequence.
   * Memory job runs first, then argument job, then trait job if the earlier jobs succeed.
   */
  async runNightlyAnalysisJobs(): Promise<void> {
    this.jobServiceLogger.info('Starting nightly analysis job sequence');

    try {
      this.jobServiceLogger.info('Running memory job...');
      await this.memoryJob.run();
      this.jobServiceLogger.info('Memory job succeeded, proceeding with argument job');

      this.jobServiceLogger.info('Running argument job...');
      await this.argumentJob.run();
      this.jobServiceLogger.info('Argument job succeeded, proceeding with trait job');

      this.jobServiceLogger.info('Running trait job...');
      await this.traitJob.run();
      this.jobServiceLogger.info('Trait job succeeded');

      this.jobServiceLogger.info('Nightly analysis job sequence completed successfully');
    } catch (error) {
      this.jobServiceLogger.error('Nightly analysis job sequence failed:', error);
      throw error;
    }
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
   * Run the memory job in isolation
   */
  async runMemoryJob(): Promise<void> {
    this.jobServiceLogger.info('Running memory job in isolation');
    try {
      await this.memoryJob.run();
      this.jobServiceLogger.info('Memory job completed successfully');
    } catch (error) {
      this.jobServiceLogger.error('Memory job failed:', error);
      throw error;
    }
  }

  /**
   * Run the argument job in isolation
   */
  async runArgumentJob(): Promise<void> {
    this.jobServiceLogger.info('Running argument job in isolation');
    try {
      await this.argumentJob.run();
      this.jobServiceLogger.info('Argument job completed successfully');
    } catch (error) {
      this.jobServiceLogger.error('Argument job failed:', error);
      throw error;
    }
  }

  /**
   * Run the trait job in isolation
   */
  async runTraitJob(): Promise<void> {
    this.jobServiceLogger.info('Running trait job in isolation');
    try {
      await this.traitJob.run();
      this.jobServiceLogger.info('Trait job completed successfully');
    } catch (error) {
      this.jobServiceLogger.error('Trait job failed:', error);
      throw error;
    }
  }

  /**
   * Schedule all cron jobs on startup.
   * Nightly analysis jobs run daily at 3AM.
   * Fun fact job runs daily at 9AM.
   * Pricing job runs every hour at minute 10.
   */
  scheduleCronJobs(): void {
    this.jobServiceLogger.info('Scheduling cron jobs');

    // Nightly analysis jobs: daily at 3AM America/New_York
    cron.schedule(
      '0 3 * * *',
      () => {
        this.runNightlyAnalysisJobs().catch((error) => {
          this.jobServiceLogger.error('Nightly analysis job sequence failed:', error);
        });
      },
      { timezone: 'America/New_York' },
    );
    this.jobServiceLogger.info('Nightly analysis job sequence scheduled daily at 3AM America/New_York time.');

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
