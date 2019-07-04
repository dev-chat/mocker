import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../../User/models/User";

@Entity()
export class Muzzle {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(() => User, user => user.requestedMuzzles)
  @Column()
  public requestorId!: string;

  @ManyToOne(() => User, user => user.muzzles)
  @Column()
  public muzzledId!: string;

  @Column()
  public time!: number;

  @Column()
  public messagesSuppressed!: number;

  @Column()
  public wordsSuppressed!: number;

  @Column()
  public charactersSuppressed!: number;

  @Column("datetime")
  public date!: Date;
}
