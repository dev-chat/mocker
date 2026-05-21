import { Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SlackUser } from './SlackUser';

export interface ArgumentParticipant {
  slackId: string;
  name: string;
  viewpoint: string;
}

export type ArgumentParticipantViewpoints = Record<string, string>;

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

  @ManyToMany(() => SlackUser)
  @JoinTable()
  public participants!: SlackUser[];

  @Column('simple-json', { default: '{}' })
  public participantViewpoints!: ArgumentParticipantViewpoints;

  @ManyToOne(() => SlackUser, (user) => user.argumentWins)
  public winner!: SlackUser;

  @Column({ type: 'int' })
  public pointValue!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
