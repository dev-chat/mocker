import cron from 'node-cron';
import { MemoryJob } from './ai/memory/memory.job';
import { TraitJob } from './ai/trait/trait.job';
import { FunFactJob } from './jobs/fun-fact.job';
import { PricingJob } from './jobs/pricing.job';
import { logger } from './shared/logger/logger';
import { AIService } from './ai/ai.service';

export class JobService {
  private memoryJob: MemoryJob;
  private traitJob: TraitJob;
  private funFactJob: FunFactJob;
  private pricingJob: PricingJob;
  private jobServiceLogger = logger.child({ module: 'JobService' });

  constructor(aiService?: AIService) {
    this.memoryJob = new MemoryJob(aiService);
    this.traitJob = new TraitJob(undefined, aiService);
    this.funFactJob = new FunFactJob();
    this.pricingJob = new PricingJob();
  }

  /**
   * Run the memory and trait jobs in sequence.
   * Memory job runs first, then trait job runs only if memory job succeeds.
   */
  async runMemoryAndTraitJobs(): Promise<void> {
    this.jobServiceLogger.info('Starting memory and trait job sequence');

    try {
      // Run memory job first
      this.jobServiceLogger.info('Running memory job...');
      await this.memoryJob.run();
      this.jobServiceLogger.info('Memory job succeeded, proceeding with trait job');

      // Run trait job only if memory job succeeds
      this.jobServiceLogger.info('Running trait job...');
      await this.traitJob.run();
      this.jobServiceLogger.info('Trait job succeeded');

      this.jobServiceLogger.info('Memory and trait job sequence completed successfully');
    } catch (error) {
      this.jobServiceLogger.error('Memory and trait job sequence failed:', error);
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
   * Memory and trait jobs run daily at 3AM.
   * Fun fact job runs daily at 9AM.
   * Pricing job runs every hour at minute 10.
   */
  scheduleCronJobs(): void {
    this.jobServiceLogger.info('Scheduling cron jobs');

    // Memory and trait jobs: daily at 3AM America/New_York
    cron.schedule(
      '0 3 * * *',
      () => {
        this.runMemoryAndTraitJobs().catch((error) => {
          this.jobServiceLogger.error('Memory and trait job sequence failed:', error);
        });
      },
      { timezone: 'America/New_York' },
    );
    this.jobServiceLogger.info('Memory and trait job sequence scheduled daily at 3AM America/New_York time.');

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
  }
}
