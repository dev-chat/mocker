import Table from 'easy-table';
import { getRepository } from 'typeorm';
import { ReportService } from '../../shared/services/report.service';
import { Rep } from '../../shared/db/models/Rep';
import { ReactionByUser } from '../../shared/models/reaction/ReactionByUser.model';
import { Reaction } from '../../shared/db/models/Reaction';

export class ReactionReportService extends ReportService {
  public async getRep(userId: string, teamId: string): Promise<string> {
    const totalRep = await this.getTotalRep(userId, teamId)
      .then(value => {
        if (value) {
          return `\n*You currently have _${value!.rep}_ rep.*`;
        } else {
          return `You do not currently have any rep.`;
        }
      })
      .catch(() => `Unable to retrieve your rep due to an error!`);

    const repByUser = await this.getRepByUser(userId, teamId)
      .then(async (perUserRep: ReactionByUser[] | undefined) => await this.formatRepByUser(perUserRep, teamId))
      .catch(e => console.error(e));

    return `${repByUser}\n\n${totalRep}`;
  }

  public getTotalRep(userId: string, teamId: string): Promise<Rep | undefined> {
    return new Promise(async (resolve, reject) => {
      await getRepository(Rep)
        .findOne({ user: userId, teamId })
        .then(async value => {
          await getRepository(Rep)
            .increment({ user: userId, teamId }, 'timesChecked', 1)
            .catch(e => console.error(`Error logging check for user ${userId}. \n ${e}`));
          resolve(value);
        })
        .catch(e => reject(e));
    });
  }

  public getRepByUser(userId: string, teamId: string): Promise<ReactionByUser[] | undefined> {
    return new Promise(async (resolve, reject) => {
      await getRepository(Reaction)
        .query(
          `SELECT reactingUser, SUM(value) as rep FROM reaction WHERE affectedUser=? AND teamId=? GROUP BY reactingUser ORDER BY rep DESC;`,
          [userId, teamId],
        )
        .then(value => resolve(value))
        .catch(e => reject(e));
    });
  }

  public getRepByChannel(teamId: string): Promise<any[] | undefined> {
    return getRepository(Reaction)
      .query(
        `SELECT AVG(value) as avg, channel WHERE teamId=${teamId} FROM reaction GROUP BY channel ORDER BY avg DESC;`,
      )
      .then(result => {
        const formatted = result.map((avgReaction: any) => {
          return {
            value: avgReaction.avg,
            channel: this.slackService.getChannelName(avgReaction.channel, teamId),
          };
        });
        return formatted;
      });
  }

  private async formatRepByUser(perUserRep: ReactionByUser[] | undefined, teamId: string): Promise<string> {
    if (!perUserRep) {
      return 'You do not have any existing relationships.';
    } else {
      const formattedData = await Promise.all(
        perUserRep.map(async userRep => {
          return {
            user: await this.slackService.getUserNameById(userRep.reactingUser, teamId),
            rep: `${this.getSentiment(userRep.rep)} (${userRep.rep})`,
          };
        }),
      );
      return `${Table.print(formattedData)}`;
    }
  }

  private getSentiment(rep: number): string {
    if (rep >= 1000) {
      return 'Worshipped';
    } else if (rep >= 900 && rep < 1000) {
      return 'Enamored';
    } else if (rep >= 800 && rep < 900) {
      return 'Adored';
    } else if (rep >= 700 && rep < 800) {
      return 'Loved';
    } else if (rep >= 600 && rep < 700) {
      return 'Endeared';
    } else if (rep >= 500 && rep < 600) {
      return 'Admired';
    } else if (rep >= 400 && rep < 500) {
      return 'Esteemed';
    } else if (rep >= 300 && rep < 400) {
      return 'Well Liked';
    } else if (rep >= 200 && rep < 300) {
      return 'Liked';
    } else if (rep >= 100 && rep < 200) {
      return 'Respected';
    } else if (rep >= -300 && rep < 100) {
      return 'Neutral';
    } else if (rep >= -500 && rep < -300) {
      return 'Unfriendly';
    } else if (rep >= -700 && rep < -500) {
      return 'Disliked';
    } else if (rep >= -1000 && rep < -700) {
      return 'Scorned';
    } else if (rep >= -1000) {
      return 'Hated';
    } else {
      return 'Neutral';
    }
  }
}
