import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class List {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public requestorId!: string;

  @Column()
  public teamId!: string;

  @Column()
  public channelId!: string;

  @Column({ charset: 'utf8mb4' })
  public text!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
