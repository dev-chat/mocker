import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Muzzle } from './Muzzle';
import { Item } from './Item';

@Entity()
export class ItemKill {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  @OneToMany(() => Muzzle, (muzzle) => muzzle.id)
  muzzleId!: number;

  @Column()
  @OneToMany(() => Item, (item) => item.id)
  itemId!: number;
}
