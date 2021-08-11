import { Column, Entity, PrimaryGeneratedColumn, Unique, OneToMany } from 'typeorm';
import { Activity } from './Activity';
import { InventoryItem } from './InventoryItem';

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

  @Column()
  public isBot!: boolean;

  @Column()
  public botId!: string;

  @OneToMany(
    _type => InventoryItem,
    inventoryItem => inventoryItem.owner,
  )
  public inventory!: InventoryItem[];
  @OneToMany(
    _type => Activity,
    activity => activity.userId,
  )
  public activity!: Activity[];
}
