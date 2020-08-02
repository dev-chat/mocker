import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Item {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public name!: string;

  @Column()
  public description!: string;

  @Column()
  public price!: number;

  @Column()
  public isStackable!: boolean;

  @Column()
  public isRange!: boolean;

  @Column()
  public max_ms!: number;

  @Column()
  public min_ms!: number;
}
