import { Environment } from '@nestkit-x/core';
import { ConfigModuleOptions } from '@nestjs/config/dist/interfaces/config-module-options.interface';

export interface IConfigModuleOptions {
  /**
   * Determines on what env .env.example should be generated.
   *
   * @default {Environment.Local}
   */
  exampleGenerationEnv?: Environment | false;

  /**
   * Additional options for @nestjs/config.
   */
  load?: ConfigModuleOptions['load'];
}
