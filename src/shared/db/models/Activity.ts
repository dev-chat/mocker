import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SlackUser } from './SlackUser';

@Entity()
export class Activity {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(
    _type => SlackUser,
    user => user.activity,
  )
  public userId!: string;

  @Column()
  public teamId!: string;

  @Column({ default: 'NOT_AVAILABLE' })
  public channel!: string;

  @Column()
  public channelType!: string;

  @Column()
  public eventType!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
