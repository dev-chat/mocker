import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Counter {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public requestorId!: string;

  @Column({ default: () => "' '" })
  public counteredId?: string;

  @Column()
  public messagesSuppressed!: number;

  @Column()
  public wordsSuppressed!: number;

  @Column()
  public charactersSuppressed!: number;

  @Column()
  public teamId!: string;

  @Column()
  public countered!: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
