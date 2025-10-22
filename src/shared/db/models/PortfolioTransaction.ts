import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Portfolio } from './Portfolio';
import { UUID } from 'typeorm/driver/mongodb/bson.typings';

@Entity()
export class PortfolioTransactions {
  @PrimaryGeneratedColumn()
  public id!: UUID;

  @ManyToOne(() => Portfolio, (portfolio) => portfolio.id)
  public portfolioId!: Portfolio;

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
