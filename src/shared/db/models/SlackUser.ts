import { Column, Entity, PrimaryGeneratedColumn, Unique, OneToMany } from 'typeorm';
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

  @OneToMany(
    _type => InventoryItem,
    inventoryItem => inventoryItem.owner,
  )
  public inventory!: InventoryItem[];
}
