import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
// Supports per-user rep queries filtered by affected user + team + date range.
@Index(['affectedUser', 'teamId', 'createdAt'])
// Supports team-wide rep leaderboard aggregation filtered by team + date range.
@Index(['teamId', 'createdAt'])
export class Reaction {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public reactingUser!: string;

  @Column()
  public affectedUser!: string;

  @Column()
  public teamId!: string;

  @Column()
  public reaction!: string;

  @Column()
  public value!: number;

  @Column()
  public type!: string;

  @Column({ default: 'NOT_AVAILABLE' })
  public channel!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
