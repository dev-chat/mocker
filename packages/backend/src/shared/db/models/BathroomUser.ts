import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BathroomTimer } from './BathroomTimer';

@Entity({ name: 'bathroom_users' })
@Unique(['slackId'])
export class BathroomUser {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({ name: 'slack_id' })
  public slackId!: string;

  @Column({ name: 'display_name', charset: 'utf8mb4' })
  public displayName!: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true, default: null })
  public avatarUrl!: string | null;

  @OneToMany(() => BathroomTimer, (timer) => timer.user)
  public timers?: BathroomTimer[];

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  public updatedAt!: Date;
}
