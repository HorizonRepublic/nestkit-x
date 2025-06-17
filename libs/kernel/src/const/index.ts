import { Brand, ServiceToken } from '@nestkit-x/core';

export const APP_REF_SERVICE = Symbol(`app-reference-service`) as ServiceToken<Brand.App>;

export const APP_STATE_SERVICE = Symbol(`app-state-service`) as ServiceToken<Brand.App>;

export const APP_CONFIG = Symbol('app-config') as ServiceToken<Brand.Config>;

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
