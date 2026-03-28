import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Joke {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({ length: 255 })
  public jokeApiId!: string;
}
