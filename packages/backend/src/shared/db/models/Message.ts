import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SlackUser } from './SlackUser';

@Entity()
// Supports per-user dashboard stats/activity/top-channels queries filtered by user + team + date range.
@Index(['userId', 'teamId', 'createdAt'])
// Supports team-wide leaderboard aggregation filtered by team + date range.
@Index(['teamId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(() => SlackUser, (user) => user.messages)
  public userId!: SlackUser;

  @Column({ default: 'NOT_AVAILABLE' })
  public teamId!: string;

  @Column({ default: 'NOT_AVAILABLE' })
  public channel!: string;

  @Column('text')
  public message!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
