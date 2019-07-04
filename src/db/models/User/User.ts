import { Column, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { Muzzle } from "../Muzzle/Muzzle";

@Entity()
export class User {
  @PrimaryColumn()
  public slackId!: string;

  @Column()
  public slackUserName!: string;

  @OneToMany(() => Muzzle, muzzle => muzzle.requestorId)
  public requestedMuzzles!: Muzzle[];

  @OneToMany(() => Muzzle, muzzle => muzzle.muzzledId)
  public muzzles!: Muzzle[];
}
