---
sidebar_position: 1
---

# Introduction

Welcome to **NestKit-X** - a comprehensive ecosystem designed to streamline NestJS application development by
eliminating repetitive boilerplate code and providing seamless integration between modules.

## Motivation

As developers working with NestJS, we've all been there - spinning up new instances, writing the same boilerplate code
for every project, and copying configurations from previous services. Even small microservices require substantial
setup: configuring Swagger, setting up middleware, creating application hooks, and writing lengthy `main.ts` files.

Most boilerplates end up being discarded or heavily modified because they either include unnecessary features or lack
specific requirements. Instead of creating yet another template that would gather dust, we decided to build something
different.

**NestKit-X** was born from the frustration of writing the same modular code repeatedly. Rather than copying and pasting
from previous projects, we created an ecosystem that reduces most configurations and module integrations to simple
package installations.

## What is NestKit-X?

NestKit-X can be technically described as a **framework** - it provides a comprehensive ecosystem of well-integrated
modules that are pre-configured and work seamlessly together out of the box.

### Key Benefits

- **Zero Boilerplate**: Forget about massive `main.ts` files filled with Swagger configurations
- **No More Copy-Paste**: Stop copying middleware and application hooks between projects
- **Dependency Injection for Everything**: Use DI patterns for all framework configurations
- **Microservice Ready**: Create new services without domain-specific dependencies
- **Pre-integrated Ecosystem**: All modules work together without additional configuration

## Quick Start

Getting started with NestKit-X is incredibly simple. The framework is built around a custom kernel that requires minimal
setup in your main application file.

### Basic Configuration

Create your application configuration class. The `IAppConfig` interface and `APP_CONFIG` token are already provided by
`@nestkit-x/core`:

```typescript
import { IAppConfig } from '@nestkit-x/core';

class AppConfig implements IAppConfig {
  // Implement the required properties
  readonly env: Environment;
  readonly host: string;
  readonly name: string;
  readonly port: number;
  readonly version: string;
}
```

Then register your configuration. NestKit-X comes with `@nestjs/config` built-in, so you can register your config in
several ways:

:::info Configuration Registration

You can register your configuration using the standard NestJS approach or the enhanced NestKit-X way:

**Standard NestJS approach:**

```typescript
import { APP_CONFIG } from '@nestkit-x/core';
import { registerAs } from '@nestjs/config';

export const appConfig = registerAs(APP_CONFIG, () => new AppConfig()); // or your own config style
```

**NestKit-X enhanced approach (with validation):**

```typescript
import { APP_CONFIG } from '@nestkit-x/core';
import { ConfigBuilder } from '@nestkit-x/config';

export const appConfig = ConfigBuilder.from(AppConfig, APP_CONFIG)
  .validate((c) => typia.assertEquals<IAppConfig>(c)) // or your own validator. typia is not must-have
  .build();
```

The NestKit-X approach provides additional features like validation and enhanced type safety if you uses typia.
Details about configuration options will be covered in the [Config section](./overview/config.md).
:::

Later you can access this config via token `APP_CONFIG`

### Application Bootstrap

Finally, bootstrap your application in a single line:

```typescript
// main.ts
import { NestKitKernel } from '@nestkit-x/kernel';
import { AppModule } from './app/app.module';

NestKitKernel.init(AppModule);
```

That's it! Your service is configured, running, and ready for development.

## Architecture Overview

The system is built around the custom [**Kernel**](overview/01-kernel.md) - the core engine that extends standard NestJS
capabilities
and makes the framework more flexible and powerful.

### The Kernel System

The kernel serves as:

- **Bootstrap Engine**: Handles application initialization and lifecycle management
- **Module Coordinator**: Manages integration between different NestKit-X modules
- **State Management**: Provides StateService for controlling application lifecycle and bootstrap phases
- **Service Registry**: Maintains references to core application services

Beyond simple application startup, the kernel provides additional capabilities and serves as the foundation for all
other NestKit-X modules. It's important to distinguish the kernel from the core package - while `@nestkit-x/core`
contains constants and types, the kernel is the actual system engine that powers the entire ecosystem.

## What's Next?

This introduction provides a high-level overview of NestKit-X and its benefits. To dive deeper:

- Explore the [`@nestkit-x/kernel`](overview/01-kernel.md) documentation to understand the core system
- Check out individual **Module** guides for specific integrations
- Review **Configuration** options for customizing your application
- See **Examples** for real-world implementation patterns

Welcome to a more efficient way of building NestJS applications!
