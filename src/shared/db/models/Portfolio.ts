import { Column, Entity, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { JoinColumn } from 'typeorm/decorator/relations/JoinColumn';
import { PortfolioTransactions } from './PortfolioTransaction';
import { UUID } from 'typeorm/driver/mongodb/bson.typings';
import { SlackUser } from './SlackUser';

@Entity()
export class Portfolio {
  @PrimaryGeneratedColumn()
  public id!: UUID;

  @OneToMany(() => PortfolioTransactions, (transaction) => transaction.portfolio)
  public transactions?: PortfolioTransactions[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;

  @OneToOne(() => SlackUser, (user) => user.portfolio)
  @JoinColumn({ name: 'user_id' })
  public user!: SlackUser;
}
