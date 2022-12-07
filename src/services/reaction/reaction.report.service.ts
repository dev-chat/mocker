import Table from 'easy-table';
import { ReportService } from '../../shared/services/report.service';
import { ReactionByUser } from '../../shared/models/reaction/ReactionByUser.model';
import { ReactionPersistenceService } from './reaction.persistence.service';

export class ReactionReportService extends ReportService {
  reactionPersistenceService = ReactionPersistenceService.getInstance();

  public async getRep(userId: string, teamId: string): Promise<string> {
    const { totalRepAvailable, totalRepEarned } = await this.reactionPersistenceService
      .getTotalRep(userId, teamId)
      .catch(() => {
        throw new Error(`Unable to retrieve your rep due to an error!`);
      });

    const message = totalRepAvailable
      ? `\n*You currently have _${totalRepAvailable}_ rep available to spend.*`
      : `You do not currently have any rep.`;

    const repByUser = await this.reactionPersistenceService
      .getRepByUser(userId, teamId)
      .then(async (perUserRep: ReactionByUser[] | undefined) => {
        return await this.formatRepByUser(perUserRep, teamId, totalRepEarned);
      })
      .catch(e => {
        console.error(e);
        throw new Error(e);
      });

    return `${repByUser}\n\n${message}`;
  }

  private async formatRepByUser(
    perUserRep: ReactionByUser[] | undefined,
    teamId: string,
    totalRep: number,
  ): Promise<string> {
    if (!perUserRep) {
      return 'You do not have any existing relationships.';
    } else {
      const formattedData = await Promise.all(
        perUserRep.map(async userRep => {
          return {
            user:
              userRep.reactingUser !== 'ADMIN'
                ? await this.slackService.getUserNameById(userRep.reactingUser, teamId)
                : 'Stimulus - December 2022',
            rep: `${this.getSentiment(userRep.rep, totalRep)} (${((userRep.rep / totalRep) * 100).toPrecision(3)}%)`,
          };
        }),
      );
      return `${Table.print(formattedData)}\n\n*You have earned a total of _${totalRep}_ in your lifetime.*`;
    }
  }

  private getSentiment(rep: number, totalRep: number): string {
    const percent = rep / totalRep;
    if (percent >= 0.5) {
      return 'Worshipped';
    } else if (percent >= 0.4 && percent < 0.5) {
      return 'Enamored';
    } else if (percent >= 0.35 && percent < 0.4) {
      return 'Adored';
    } else if (percent >= 0.3 && percent < 0.35) {
      return 'Loved';
    } else if (percent >= 0.25 && percent < 0.3) {
      return 'Endeared';
    } else if (percent >= 0.2 && percent < 0.25) {
      return 'Admired';
    } else if (percent >= 0.15 && percent < 0.2) {
      return 'Esteemed';
    } else if (percent >= 0.1 && percent < 0.15) {
      return 'Well Liked';
    } else if (percent >= 0.05 && percent < 0.1) {
      return 'Liked';
    } else if (percent >= 0.01 && percent < 0.05) {
      return 'Respected';
    }
    return 'Neutral';
  }
}
