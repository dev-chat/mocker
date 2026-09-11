import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
// Supports per-user sentiment trend queries filtered by user + team + date range.
@Index(['userId', 'teamId', 'createdAt'])
export class Sentiment {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({ default: null })
  public userId!: string;

  @Column()
  public teamId!: string;

  @Column({ default: null })
  public channelId!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  public sentiment!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
