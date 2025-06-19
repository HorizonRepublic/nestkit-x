/**
 * Represents various states of an application lifecycle.
 */
export enum AppState {
  /**
   * Indicates that the app was created from a factory, but not listened yet.
   */
  Created = 'created',
  /**
   * Indicates that the app in listening mode.
   */
  Listening = 'listening',
  /**
   * Indicates that app did nothing yet.
   */
  NotReady = 'not-ready',
}

/**
 * Represents the different possible environments for the application.
 *
 * This enum is used to specify and distinguish between various environments
 * where the application can be deployed or executed. It can be useful for
 * configuring environment-specific settings such as logging, API endpoints,
 * feature toggles, or other environment-dependent behaviors.
 *
 * Enum members:
 * - Dev: Represents the development environment.
 * - Local: Represents a local testing or development environment.
 * - Prod: Represents the production environment.
 * - Stage: Represents the staging environment, often used for pre-production testing.
 * - Test: Represents the testing environment, typically used for automated tests.
 */
export enum Environment {
  Dev = 'development',
  Local = 'local',
  Prod = 'production',
  Stage = 'stage',
  Test = 'test',
}
