import { DynamicModule } from '@nestjs/common';

/**
 * Interface describing the STATIC part of an application module class.
 *
 * This interface defines the contract that every functional module (Auth, Users, Payment, etc.)
 * must implement to support different deployment architectures in a NestJS application.
 * It enables flexible module registration based on the application's runtime context.
 *
 * @interface IAppModuleInterface
 *
 * @example
 * ```typescript
 * @Module({})
 * export class AuthModule implements IAppModuleInterface {
 *   static forHttp(options?: IAuthModuleOptions): DynamicModule {
 *     return {
 *       module: AuthModule,
 *       controllers: [AuthController],
 *       providers: [AuthService],
 *     };
 *   }
 *
 *   static forGateway(options?: IAuthModuleOptions): DynamicModule {
 *     // Gateway-specific configuration
 *   }
 *
 *   static forMicroservice(options?: IAuthModuleOptions): DynamicModule {
 *     // Microservice-specific configuration
 *   }
 * }
 * ```
 */
export interface IAppModuleInterface {
  /**
   * Constructor signature for the module class.
   * This is required for TypeScript to recognize the interface as a class type.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): any;

  /**
   * Returns a module configuration for HTTP REST API context.
   *
   * Use this method when registering the module in a monolithic application
   * or a standalone HTTP service. It typically includes controllers for handling
   * HTTP requests and providers for business logic.
   *
   * @param {unknown} [options] - Optional configuration object for customizing module behavior
   * @returns {DynamicModule} A NestJS dynamic module configuration
   *
   * @example
   * ```typescript
   * // In AppModule
   * @Module({
   *   imports: [AuthModule.forHttp({ jwtSecret: 'secret' })],
   * })
   * export class AppModule {}
   * ```
   */
  forHttp(options?: unknown): DynamicModule;

  /**
   * Returns a module configuration for API Gateway context.
   *
   * Use this method when registering the module in an API Gateway that acts
   * as a proxy or aggregation layer. It typically excludes direct business logic
   * and focuses on request routing and composition.
   *
   * @param {unknown} [options] - Optional configuration object for customizing module behavior
   * @returns {DynamicModule} A NestJS dynamic module configuration
   *
   * @example
   * ```typescript
   * // In GatewayModule
   * @Module({
   *   imports: [AuthModule.forGateway({ serviceUrl: 'http://auth-service' })],
   * })
   * export class GatewayModule {}
   * ```
   */
  forGateway(options?: unknown): DynamicModule;

  /**
   * Returns a module configuration for microservices context.
   *
   * Use this method when registering the module in a microservice worker
   * or message consumer (e.g., NATS, RabbitMQ). It typically includes
   * message handlers and background processing logic instead of HTTP controllers.
   *
   * @param {unknown} [options] - Optional configuration object for customizing module behavior
   * @returns {DynamicModule} A NestJS dynamic module configuration
   *
   * @example
   * ```typescript
   * // In MicroserviceModule
   * @Module({
   *   imports: [AuthModule.forMicroservice({ transport: Transport.NATS })],
   * })
   * export class MicroserviceModule {}
   * ```
   */
  forMicroservice(options?: unknown): DynamicModule;
}
