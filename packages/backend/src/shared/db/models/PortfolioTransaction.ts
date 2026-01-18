import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { JoinColumn } from 'typeorm/decorator/relations/JoinColumn';
import { Portfolio } from './Portfolio';
import { UUID } from 'typeorm/driver/mongodb/bson.typings';

@Entity()
export class PortfolioTransactions {
  @PrimaryGeneratedColumn()
  public id!: UUID;

  @ManyToOne(() => Portfolio, (portfolio) => portfolio.transactions)
  @JoinColumn({ name: 'portfolio_id' })
  public portfolio!: Portfolio;

  @Column()
  public type!: 'BUY' | 'SELL';

  @Column()
  public assetSymbol!: string;

  @Column('decimal', { precision: 18, scale: 8 })
  public quantity!: number;

  @Column('decimal', { precision: 18, scale: 8 })
  public price!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
