import { Entity, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Item } from './Item';
import { SlackUser } from './SlackUser';

@Entity()
export class InventoryItem {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(
    _type => Item,
    item => item.id,
  )
  public item!: Item;

  @ManyToOne(
    _type => SlackUser,
    user => user.inventory,
  )
  public owner!: SlackUser;
}
