import { Column, Entity, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from './User';
import { Item } from './Item';

@Entity()
export class InventoryItem {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public item!: Item;

  @ManyToOne(type => User, user => user.inventory)
  public owner!: User;
}
