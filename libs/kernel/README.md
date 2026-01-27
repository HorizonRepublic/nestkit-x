# @zerly/kernel

The beating heart of the **Zerly** ecosystem.

`@zerly/kernel` provides a robust, opinionated, and secure bootstrap mechanism for NestJS applications. It abstracts away the repetitive boilerplate of `main.ts`, ensuring a consistent initialization flow for both HTTP servers and CLI/Standalone applications.

## Key Features

- **Unified Entry Point:** Initialize your entire application with a single line of code.
- **Dual Mode:** Seamlessly switch between **HTTP Server** (default) and **Standalone/CLI** modes using a simple flag.
- **Lifecycle Management:** Advanced hooks (`onCreated`, `onListening`) for precise control over initialization (Swagger, Microservices, etc.).
- **Fastify by Default:** Pre-configured `FastifyAdapter` with security best practices (body limits, timeouts, poisoning protection).

## Installation

```bash
bash pnpm add @zerly/kernel
```

## Usage

### 1. Bootstrap your application

Replace the contents of your `main.ts` with the following:

```typescript 
import { Kernel } from '@zerly/kernel';
import { AppModule } from './app/app.module'; // <-- your root module

Kernel.init(AppModule);
```

That's it!
Kernel handles adapter creation, configuration and error handling.

### 2. Run in HTTP Mode (Default)

Just start your application as usual. The kernel will bootstrap the NestJS IoC container, attach the Fastify adapter, and start listening on the configured port.

```bash
bash node dist/apps/my-app/main.js
```

Output:

```shell
Application is listening on http://0.0.0.0:3000
```

### 3. Run in CLI / Standalone Mode

Pass the `--cli` flag to start the application in **Standalone Mode**.
This bypasses the HTTP server initialization, making it ideal for:
- **System Scheduled Tasks:** Jobs triggered by OS cron, Kubernetes CronJobs, or cloud schedulers.
- **CLI Utilities:** Database migrations, seeding scripts, or administrative commands.
- **One-off Scripts:** CI/CD pipeline tasks.

```bash
node dist/apps/my-app/main.js --cli my-command
```

> **Note:** While Standalone mode is typically used for short-lived processes, you can also use it for long-running background workers (e.g., queue consumers) by ensuring your command keeps the process alive.


## Advanced Features

### Lifecycle Hooks (AppStateService)

`@zerly/kernel` exposes an `AppStateService` that allows you to hook into specific stages of the application lifecycle. This is the recommended way to register third-party integrations that require an `INestApplication` instance (e.g., Swagger, Helmet, Microservices).

Inject `APP_STATE_SERVICE` into your providers:

```typescript 
import { Inject, Injectable } from '@nestjs/common';
import { APP_STATE_SERVICE, IAppStateService } from '@zerly/core';

@Injectable()
export class AppSetupProvider {
  constructor(@Inject(APP_STATE_SERVICE) private readonly appState: IAppStateService) {
    // Executed after the app is created, but BEFORE it starts listening
    this.appState.onCreated((app) => {
      // Register Swagger
      const config = new DocumentBuilder().setTitle('My API').build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api', app, document);

      // Register Global Middlewares
      app.enableCors();
    });

// Executed AFTER the app has started listening
    this.appState.onListening((app) => {
      console.log('🚀 Microservices and WebSockets are ready!');
    });
  }
}
```

### Accessing the App Reference

If you desperately need access to the `INestApplication` instance outside of the bootstrap flow, you can use `AppRefService`.

> ⚠️ **Warning:** Use this sparingly. Ideally, your logic should be encapsulated within modules and providers.

```typescript
import { Inject } from '@nestjs/common';
import { APP_REF_SERVICE, IAppRefService } from '@zerly/core';

export class MyService {
  constructor(@Inject(APP_REF_SERVICE) private readonly appRef: IAppRefService) {
  }

  someMethod() {
    const app = this.appRef.get(); // Returns INestApplication 
    // Do something risky... 
  }
}
```

### Environment Configuration

The Kernel automatically integrates with `@zerly/config`. When the application starts (even in development), it can automatically generate an updated `.env.example` file based on your configuration classes, ensuring your team always knows which environment variables are required.

## Frequently Asked Questions

### Can I replace the underlying HTTP adapter?

**No.** The choice of the **FastifyAdapter** is intentional. It represents the de facto standard for performance and efficiency in modern Node.js services. By standardizing on Fastify, we ensure optimal compatibility, security defaults, and performance tuning across the entire ecosystem. While this might be revisited in future major versions, the current architectural vision prioritizes a unified, high-performance foundation.

### Why can't I register microservices or middlewares directly in `main.ts`?

The framework's architecture treats the application bootstrapping process as a composition of modular building blocks. Instead of polluting the entry point (`main.ts`) with imperative setup logic, `@zerly/kernel` encourages the use of **lifecycle hooks**.

This approach allows you to:

- Decouple infrastructure setup (Swagger, Helmet, WebSockets) from the application entry point.
- Maintain a clean and consistent `main.ts` across all services.
- Deterministically manage initialization order via the `AppStateService`.

Use the `onCreated` hook for registering global middlewares (Helmet, compression, CORS) and documentation generation, and `onListening` for post-startup tasks.

### How do I control the execution order of multiple lifecycle hooks?

`AppStateService` supports a priority system. When registering a callback via .onCreated() or .onListening(), you can pass a second argument representing the priority (default is 0).

Lower numbers (e.g., -100) run earlier.
Higher numbers (e.g., 100) run later.

This allows you to ensure that critical configurations (like database connections or global error filters) are established before secondary services.

### Where do I configure the listening port and host?

Configuration is handled automatically via environment variables through `@zerly/config`.
Set `APP_PORT` in your `.env` file to change the port (default: `3000`).
Set `APP_HOST` to change the binding interface (default: `0.0.0.0`).

**Auto-generation behavior:**
If no `.env` file is present, the kernel will generate a base `.env.example` file with the following defaults:

```dotenv 
APP_ENV="production" # App environment. Possible values: local, production, stage, test. (Default: production) 
APP_HOST="0.0.0.0" # (Default: 0.0.0.0) 
APP_NAME="example-app" # kebab-case is recommended. (Default: example-app) 
APP_PORT="3000" # (Default: 3000) 
APP_GENERATE_ENV_EXAMPLE="true" # Use false in production. (Default: true) 
APP_LOG_LEVEL="info" # (Default: info)
```

> **Important for NX Users:**
> When running within an NX monorepo, the kernel attempts to detect the project root to place the `.env.example` correctly. To ensure accuracy, we recommend manually creating a `.env` file containing at least the `APP_NAME` variable (matching your project directory name) before the first run. This guarantees the generator resolves the correct path for the example file.

### How do I register global Pipes, Guards, or Interceptors?

#### Declarative (Recommended):

Use the standard NestJS APP_PIPE, APP_GUARD, and APP_INTERCEPTOR providers within your AppModule or a shared CoreModule. This is the most "Nest-way" approach.

#### Imperative:

Use the onCreated hook in AppStateService to access the app instance and call app.useGlobalPipes(). This is useful if your pipes require dependencies that are only available after bootstrap.

## Roadmap

- [ ] **WebSockets Support:** Optimized adapters and lifecycle management for WS.

## License

This project is part of the **Zerly** ecosystem.
MIT Licensed.
