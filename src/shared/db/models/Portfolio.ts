import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { SlackUser } from './SlackUser';

@Entity()
export class Portfolio {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  @OneToMany(
    _type => SlackUser,
    slackUser => slackUser.id,
  )
  userId!: string;

  @Column()
  public purchasePrice!: number;

  @Column()
  public ticker!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
