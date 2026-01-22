# @zerly/kernel

Core kernel for NestJS applications with reactive lifecycle management based on RxJS.

## Installation

```shell
npm install @zerly/kernel
```

## Usage

```typescript
import { Kernel } from '@zerly/kernel';
import { AppModule } from './app.module';

Kernel.init(AppModule).subscribe({
  next: () => console.log('Application started'),
  error: (err) => console.error('Bootstrap failed:', err),
});
```

## Features

- Reactive bootstrap based on RxJS
- Application state management through AppState
- Fastify adapter integration
- Centralized lifecycle management
- Type-safe configuration

## Development

### Building

```shell
nx build kernel
```

### Running unit tests

```shell
nx test kernel
```

## License

MIT © Horizon Republic
