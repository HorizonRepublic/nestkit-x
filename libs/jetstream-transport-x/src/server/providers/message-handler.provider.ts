import { Injectable } from '@nestjs/common';
import { MessageProvider } from './message.provider';

@Injectable()
export class MessageHandlerProvider {
  public constructor(private readonly messageProvider: MessageProvider) {}
}
