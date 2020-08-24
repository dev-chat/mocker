import { Column, Entity, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Item } from './Item';

@Entity()
export class Price {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  @ManyToOne(
    _type => Item,
    item => item.id,
  )
  public itemId!: number;

  @Column()
  teamId!: string;

  @Column()
  public price!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
