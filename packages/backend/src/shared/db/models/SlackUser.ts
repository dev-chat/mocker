import { Column, Entity, PrimaryGeneratedColumn, Unique, OneToMany, OneToOne } from 'typeorm';
import { Activity } from './Activity';
import { Message } from './Message';
import { Portfolio } from './Portfolio';
import { CalendarEvent } from './CalendarEvent';

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

  @OneToMany(() => CalendarEvent, (calendarEvent) => calendarEvent.createdByUser)
  public createdCalendarEvents?: CalendarEvent[];

  @OneToOne(() => Portfolio, (portfolio) => portfolio.user, { cascade: true })
  public portfolio?: Portfolio;

  @Column({ type: 'text', nullable: true, default: null })
  public customPrompt!: string | null;
}
