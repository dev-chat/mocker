import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SlackUser } from './SlackUser';

@Entity()
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @ManyToOne(() => SlackUser, { onDelete: 'CASCADE' })
  public createdByUser!: SlackUser;

  @Column('text')
  public title!: string;

  @Column({ type: 'text', nullable: true })
  public location!: string | null;

  @Column({ default: false })
  public isAllDay!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  public startsAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  public endsAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  public recurrenceRule!: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  public updatedAt!: Date;
}
