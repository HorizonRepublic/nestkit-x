import { Injectable } from '@nestjs/common';

import { IAuthService } from './types';

@Injectable()
export class AuthService implements IAuthService {}
