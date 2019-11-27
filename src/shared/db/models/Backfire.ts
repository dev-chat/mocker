import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Backfire {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public muzzledId!: string;

  @Column()
  public milliseconds!: number;

  @Column()
  public messagesSuppressed!: number;

  @Column()
  public wordsSuppressed!: number;

  @Column()
  public charactersSuppressed!: number;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  public createdAt!: Date;
}
