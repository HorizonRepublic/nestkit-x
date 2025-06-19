import { AppState } from '@nestkit-x/core';
import { Observable } from 'rxjs';

/**
 * Service for managing application lifecycle states and executing callbacks
 * at specific initialization phases.
 *
 * This service allows modules to register callbacks that execute during
 * key application lifecycle events:
 * - `Created`: App instance created but not listening yet
 * - `Listening`: App is ready and listening for requests.
 *
 * Callbacks are executed in priority order, allowing fine-grained control
 * over an initialization sequence.
 */
export interface IAppStateService {
  /**
   * Register a callback to execute when the application has been created,
   * but before it starts listening for requests.
   *
   * This is the ideal place for:
   * - Module initialization
   * - Database connections
   * - Cache warming
   * - Service configuration.
   *
   * @param cb Function returning sync/async operation or Observable.
   * @param priority Execution priority (lower numbers = higher priority)
   * Default: 0
   * Range: -Infinity to +Infinity.
   *
   * @example
   * ```TypeScript
   * // High priority (executes first)
   * appState.onCreated(() => initDatabase(), -10);
   *
   * // Normal priority
   * appState.onCreated(() => warmCache());
   *
   * // Low priority (executes last)
   * appState.onCreated(() => logInitComplete(), 100);
   * ```
   */
  onCreated(cb: () => IStateCallback, priority?: number): void;

  /**
   * Register a callback to execute when the application is ready
   * and listening for incoming requests.
   *
   * This is the ideal place for:
   * - Final health checks
   * - Logging ready status
   * - Notifying external services
   * - Starting background jobs.
   *
   * @param cb Function returning sync/async operation or Observable.
   * @param priority Execution priority (lower numbers = higher priority)
   * Default: 0
   * Range: -Infinity to +Infinity.
   *
   * @example
   * ```TypeScript
   * // Critical check (executes first)
   * appState.onListening(() => healthCheck(), -100);
   *
   * // Normal logging
   * appState.onListening(() => logger.log('Server ready'));
   *
   * // Background tasks (executes last)
   * appState.onListening(() => startCronJobs(), 50);
   * ```
   */
  onListening(cb: () => IStateCallback, priority?: number): void;

  /**
   * Transition the application to a new state and execute all
   * registered callbacks for that state in priority order.
   *
   * Callbacks are executed sequentially, waiting for each to complete
   * before proceeding to the next. If any callback fails, the error
   * is logged but execution continues.
   *
   * @internal
   * @param state New application state.
   * @returns Observable that completes when all callbacks finish.
   */
  setState$(state: AppState): Observable<void>;

  /**
   * Current application state.
   *
   * States:
   * - `NotReady`: Initial state, nothing initialized yet
   * - `Created`: App created, modules can initialize
   * - `Listening`: App ready and accepting requests.
   */
  readonly state: AppState;
}

export interface IPrioritizedCallback {
  callback(): IStateCallback;

  readonly priority: number;
}

export type IStateCallback = Observable<void> | Promise<void> | void;
