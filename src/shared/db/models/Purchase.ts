import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { SlackUser } from './SlackUser';
import { Item } from './Item';

@Entity()
export class Purchase {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  @OneToMany(
    _type => SlackUser,
    slackUser => slackUser.slackId,
  )
  public user!: string;

  @Column()
  @OneToMany(
    _type => Item,
    item => item.id,
  )
  public item!: number;

  @Column()
  public price!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
