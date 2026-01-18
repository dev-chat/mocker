import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Reaction {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public reactingUser!: string;

  @Column()
  public affectedUser!: string;

  @Column()
  public teamId!: string;

  @Column()
  public reaction!: string;

  @Column()
  public value!: number;

  @Column()
  public type!: string;

  @Column({ default: 'NOT_AVAILABLE' })
  public channel!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
