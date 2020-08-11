import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Muzzle } from './Muzzle';
import { Item } from './Item';

@Entity()
export class ItemKill {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  @OneToMany(
    _type => Muzzle,
    muzzle => muzzle.id,
  )
  muzzleId!: number;

  @Column()
  @OneToMany(
    _type => Item,
    item => item.id,
  )
  itemId!: number;
}
