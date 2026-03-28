import { getManager, getRepository } from 'typeorm';
import { Item } from '../shared/db/models/Item';
import { SlackUser } from '../shared/db/models/SlackUser';
import { logger } from '../shared/logger/logger';
import type { RepRow } from './pricing.model';

export class PricingJob {
  private jobLogger = logger.child({ module: 'PricingJob' });

  async run(): Promise<void> {
    this.jobLogger.info('Beginning pricing job');

    try {
      const teams = await this.getDistinctTeams();
      if (teams.length === 0) {
        this.jobLogger.warn('No teams found; pricing job will exit without inserting prices');
        return;
      }
      this.jobLogger.info(`Retrieved ${teams.length} teams`);

      const items = await getRepository(Item).find();
      if (items.length === 0) {
        this.jobLogger.warn('No items found; pricing job will exit without inserting prices');
        return;
      }
      this.jobLogger.info(`Retrieved ${items.length} items`);

      const medianRep = await this.calculateMedianRep();
      if (medianRep === null) {
        this.jobLogger.error('No reputation data found; refusing to calculate prices');
        return;
      }
      this.jobLogger.info(`Calculated median reputation as ${medianRep}`);

      await getManager().transaction(async (entityManager) => {
        for (const teamId of teams) {
          const values = items.map((item) => [item.id, teamId, medianRep * item.pricePct, item.id]);
          const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
          await entityManager.query(
            `INSERT INTO price(itemId, teamId, price, itemIdId) VALUES ${placeholders}`,
            values.flat(),
          );
          this.jobLogger.info(`Inserted price refresh for team ${teamId}`);
        }
      });

      this.jobLogger.info('Pricing job complete');
    } catch (e) {
      this.jobLogger.error('Pricing job failed', e);
    }
  }

  private async getDistinctTeams(): Promise<string[]> {
    const rows: Array<{ teamId: string }> = await getRepository(SlackUser)
      .createQueryBuilder('slackUser')
      .select('DISTINCT slackUser.teamId', 'teamId')
      .getRawMany();
    return rows.map((r) => r.teamId).filter(Boolean);
  }

  private async calculateMedianRep(): Promise<number | null> {
    const rows: RepRow[] = await getManager().query(`
      SELECT earned.affectedUser, (earned.total - COALESCE(spent.total, 0)) AS rep
      FROM (
        SELECT affectedUser, SUM(value) AS total
        FROM reaction
        GROUP BY affectedUser
      ) AS earned
      LEFT JOIN (
        SELECT \`user\`, SUM(price) AS total
        FROM purchase
        GROUP BY \`user\`
      ) AS spent ON spent.\`user\` = earned.affectedUser
      ORDER BY rep DESC
    `);

    if (rows.length === 0) {
      return null;
    }

    const medianIndex = Math.floor((rows.length + 1) / 2) - 1;
    return rows[medianIndex]?.rep ?? rows[rows.length - 1].rep;
  }
}
