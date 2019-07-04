import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Muzzle {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public requestorSlackId!: string;

  @Column()
  public muzzledSlackId!: string;

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
