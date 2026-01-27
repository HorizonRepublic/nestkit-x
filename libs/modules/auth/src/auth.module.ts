import { DynamicModule, Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { IAuthModuleOptions } from './types';
import { AUTH_SERVICE } from './tokens';
import { AccountController } from './controllers/account.controller';
import { PasswordController } from './controllers/password.controller';
import { AuthService } from './auth.service';

@Module({})
export class AuthModule {
  public static forRoot(options: IAuthModuleOptions = {}): DynamicModule {
    const authController = options.controllers?.auth ?? AuthController;
    const accountController = options.controllers?.account ?? AccountController;
    const passwordController = options.controllers?.password ?? PasswordController;

    const authService = options.service ?? AuthService;

    return {
      module: AuthModule,
      global: false,
      controllers: [authController, accountController, passwordController],

      providers: [
        {
          provide: AUTH_SERVICE,
          useClass: authService,
        },
      ],

      exports: [AUTH_SERVICE],
    };
  }
}
