import { Environment } from '@nestkit-x/core';

export interface IConfigModuleOptions {
  /**
   * Determines on what env .env.example should be generated.
   *
   * @default {Environment.Local}
   */
  exampleGenerationEnv?: Environment | false;
}
