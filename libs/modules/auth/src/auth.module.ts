import { DynamicModule, Module } from '@nestjs/common';
import { AuthHttpController } from './controllers/auth.http-controller';
import { IAuthModuleOptions } from './types';
import { AUTH_SERVICE } from './tokens';
import { AuthService } from './auth.service';
import { IAppModuleInterface } from '@zerly/core';

@Module({})
export class AuthModule {
  public static forHttp(options: IAuthModuleOptions = {}): DynamicModule {
    const authHttpController = options.controller ?? AuthHttpController;

    const authService = options.service ?? AuthService;

    return {
      module: AuthModule,
      global: false,
      controllers: [authHttpController],

      providers: [
        {
          provide: AUTH_SERVICE,
          useClass: authService,
        },
      ],

      exports: [AUTH_SERVICE],
    };
  }

  public static forGateway(): DynamicModule {
    return {
      module: AuthModule,
      global: false,
    };
  }

  public static forMicroservice(): DynamicModule {
    return {
      module: AuthModule,
      global: false,
    };
  }
}

// eslint-disable-next-line unused-imports/no-unused-vars
const typeCheck: IAppModuleInterface = AuthModule;
