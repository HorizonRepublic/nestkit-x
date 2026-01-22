import { Environment } from '@zerly/core';

export interface IConfigModuleOptions {
  /**
   * Determines on what env .env.example should be generated.
   *
   * @default {Environment.Local}
   */
  exampleGenerationEnv?: Environment | false;
}
