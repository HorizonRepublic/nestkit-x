---
sidebar_position: 1
---

# Introduction

Welcome to the **NestKit-X** documentation - a powerful collection of libraries for building modern Node.js applications with NestJS.

## Overview

NestKit-X consists of three core modules, each addressing specific development needs:

### 🏗️ Core Library

The foundational library containing essential utilities, types, and shared functionality across the ecosystem.

**Key Features:**

- Type definitions and interfaces
- Utility functions and helpers
- Constants and enums
- Dependency injection tokens
- Common abstractions

**Structure:**

- `types/` - TypeScript type definitions
- `utils/` - Utility functions and helpers
- `enums/` - Enumeration definitions
- `tokens/` - Dependency injection tokens
- `constants/` - Application constants

### ⚡ Kernel Library

The architectural foundation providing core system functionality and lifecycle management.

**Key Features:**

- Application kernel management
- Service providers and factories
- Module system architecture
- Lifecycle hooks and events
- System-level abstractions

**Structure:**

- `kernel.ts` - Main kernel implementation
- `kernel.module.ts` - NestJS module definition
- `services/` - Core services
- `providers/` - Service providers

### 📝 Logger Library

A specialized logging library with advanced features and integrations.

**Key Features:**

- Structured logging
- HTTP request/response interceptors
- Configurable log levels
- Multiple transport support
- Context-aware logging

**Structure:**

- `logger.module.ts` - NestJS module definition
- `logger.provider.ts` - Logger service provider
- `logger-config-factory.service.ts` - Configuration factory
- `interceptors/` - HTTP logging interceptors
- `const.ts` - Logger constants

## Quick Start

```bash
# Install the core package
npm install @nestkit-x/core
# Install additional modules as needed
npm install @nestkit-x/kernel @nestkit-x/logger
```

### Basic Usage

```typescript
import { Module } from '@nestjs/common';
import { KernelModule } from '@nestkit-x/kernel';
import { LoggerModule } from '@nestkit-x/logger';

@Module({
  imports: [
    KernelModule.forRoot(),
    LoggerModule.forRoot({
      level: 'info', // Additional configuration
    }),
  ],
})
export class AppModule {}
```


## Architecture Principles

NestKit-X is designed with the following principles in mind:

- **Modularity** - Each library can be used independently
- **Type Safety** - Full TypeScript support with strict typing
- **Extensibility** - Easy to extend and customize
- **Performance** - Optimized for production workloads
- **Testing** - Comprehensive test coverage
- **Documentation** - Well-documented APIs and examples

## Requirements

- **Node.js**: >= 18.0.0
- **TypeScript**: >= 5.0.0
- **NestJS**: >= 10.0.0

## Technology Stack

Built with modern technologies:
- TypeScript 5.8.3
- NestJS 11.x
- Jest for testing
- ESLint for code quality
- Nx for monorepo management

## Next Steps

Explore the documentation for each library:

- [Core Library](./core/overview.md) - Essential utilities and types
- [Kernel Library](./kernel/overview.md) - System architecture and lifecycle
- [Logger Library](./logger/overview.md) - Advanced logging capabilities

Or check out the [examples](./examples/index.md) to get started quickly.

## Contributing

We welcome contributions! Please see our [Contributing Guide](./contributing.md) for details on how to get started.

## License

This project is licensed under the MIT License - see the [LICENSE](./license.md) file for details.
