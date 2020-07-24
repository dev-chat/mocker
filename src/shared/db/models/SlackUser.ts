import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity()
@Unique(['slackId', 'teamId'])
export class SlackUser {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public slackId!: string;

  @Column()
  public name!: string;

  @Column()
  public teamId!: string;
}
