import { Message } from '../../db/models/Message';

export interface MessageWithName extends Message {
  name: string;
}
