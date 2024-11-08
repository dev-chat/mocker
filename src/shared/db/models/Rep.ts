import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Rep {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public user!: string;

  @Column()
  public teamId!: string;

  @Column({ default: () => 0 })
  public timesChecked!: number;
}
