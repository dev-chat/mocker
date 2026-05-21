import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SlackUser } from './SlackUser';

export interface ArgumentParticipant {
  slackId: string;
  name: string;
  viewpoint: string;
}

@Entity()
export class ArgumentLeaderboard {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({ default: 'NOT_AVAILABLE' })
  public teamId!: string;

  @Column({ default: 'NOT_AVAILABLE' })
  public channelId!: string;

  @Column('text')
  public argumentSummary!: string;

  @Column('simple-json')
  public participants!: ArgumentParticipant[];

  @ManyToOne(() => SlackUser, (user) => user.argumentWins)
  public winner!: SlackUser;

  @Column({ type: 'int' })
  public pointValue!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
