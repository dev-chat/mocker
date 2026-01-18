import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Counter {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public requestorId!: string;

  @Column({ default: () => "' '" })
  public counteredId?: string;

  @Column({ default: () => 0 })
  public messagesSuppressed!: number;

  @Column({ default: () => 0 })
  public wordsSuppressed!: number;

  @Column({ default: () => 0 })
  public charactersSuppressed!: number;

  @Column()
  public teamId!: string;

  @Column()
  public countered!: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
