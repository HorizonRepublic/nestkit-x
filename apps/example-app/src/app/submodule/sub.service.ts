import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubService {
  // get config example
  public constructor(private readonly config: ConfigService) {}
}
