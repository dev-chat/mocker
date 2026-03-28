import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Joke {
  @PrimaryColumn({ name: 'id', length: 255 })
  public jokeApiId!: string;
}
