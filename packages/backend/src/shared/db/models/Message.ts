import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SlackUser } from './SlackUser';

@Entity()
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
