import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PortfolioTransactions } from './PortfolioTransaction';
import { UUID } from 'typeorm/driver/mongodb/bson.typings';
import { SlackUser } from './SlackUser';

@Entity()
export class Portfolio {
  @PrimaryGeneratedColumn()
  public id!: UUID;

  @OneToMany(() => PortfolioTransactions, (transaction) => transaction.id, { eager: true })
  public transactions?: PortfolioTransactions[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;

  @OneToOne(() => SlackUser, (user) => user.portfolio)
  @JoinColumn()
  public user!: SlackUser;
}
