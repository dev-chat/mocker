import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity()
@Unique(['channelId', 'teamId'])
export class SlackChannel {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public channelId!: string;

  @Column()
  public name!: string;

  @Column()
  public teamId!: string;

  @Column({ default: false })
  public isDeleted!: boolean;
}
