import { Column, Entity, PrimaryGeneratedColumn, Unique, OneToMany, JoinColumn, OneToOne } from 'typeorm';
import { Activity } from './Activity';
import { Message } from './Message';
import { Portfolio } from './Portfolio';

@Entity()
@Unique(['slackId', 'teamId'])
export class SlackUser {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public slackId!: string;

  @Column({ charset: 'utf8mb4' })
  public name!: string;

  @Column()
  public teamId!: string;

  @Column()
  public isBot!: boolean;

  @Column()
  public botId!: string;

  @OneToMany(() => Activity, (activity) => activity.userId)
  public activity?: Activity[];

  @OneToMany(() => Message, (message) => message.userId)
  public messages?: Message[];

  @OneToOne(() => Portfolio, (portfolio) => portfolio.userId)
  @JoinColumn()
  public portfolio?: Portfolio;
}
