import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
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
