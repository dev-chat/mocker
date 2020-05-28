import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { InventoryItem } from './InventoryItem';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public slackId!: string;

  @Column()
  public slackTeamId!: string;

  @OneToMany(_type => InventoryItem, inventoryItem => inventoryItem.owner)
  public inventory!: InventoryItem[];
}
