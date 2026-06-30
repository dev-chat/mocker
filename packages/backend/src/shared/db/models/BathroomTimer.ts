import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { JoinColumn } from 'typeorm/decorator/relations/JoinColumn';
import { BathroomUser } from './BathroomUser';

@Entity({ name: 'bathroom_timers' })
@Index(['user', 'startAt'])
export class BathroomTimer {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(() => BathroomUser, (user) => user.timers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  public user!: BathroomUser;

  @Column({ name: 'start_at', type: 'timestamp' })
  public startAt!: Date;

  @Column({ name: 'end_at', type: 'timestamp', nullable: true, default: null })
  public endAt!: Date | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true, default: null })
  public durationSeconds!: number | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  public updatedAt!: Date;
}
