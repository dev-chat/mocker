import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SlackUser } from './SlackUser';

@Entity()
export class Memory {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(() => SlackUser, (user) => user.memories)
  public userId!: SlackUser;

  @Column({ default: 'NOT_AVAILABLE' })
  public teamId!: string;

  @Column('text')
  public content!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  public updatedAt!: Date;
}

/** Raw SQL result shape when JOINing memory with slack_user (includes slackId from the JOIN). */
export interface MemoryWithSlackId extends Memory {
  slackId: string;
}
