import { Entity, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from './User';
import { Item } from './Item';

@Entity()
export class InventoryItem {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(_type => Item, item => item.id)
  public item!: Item;

  @ManyToOne(_type => User, user => user.inventory)
  public owner!: User;
}
