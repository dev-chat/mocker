import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Item {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public name!: string;

  @Column()
  public description!: string;

  @Column('float')
  public pricePct!: number;

  @Column()
  public isStackable!: boolean;

  @Column()
  public isRange!: boolean;

  @Column()
  public max_active_ms!: number;

  @Column()
  public min_active_ms!: number;

  @Column()
  public isTimeModifier!: boolean;

  @Column()
  public max_modified_ms!: number;

  @Column()
  public min_modified_ms!: number;

  @Column()
  public isDefensive!: boolean;

  @Column()
  public isEffect!: boolean;

  @Column()
  public isDirect!: boolean;

  @Column()
  public requiresUser!: boolean;
}
