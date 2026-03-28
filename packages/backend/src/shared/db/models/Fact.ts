import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Fact {
  @PrimaryGeneratedColumn({ name: 'factId' })
  public id!: number;

  @Column('longtext')
  public fact!: string;

  @Column({ length: 255 })
  public source!: string;
}
