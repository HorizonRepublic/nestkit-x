#!/usr/bin/env node
import { Kernel } from '@zerly/kernel';
import { CliModule } from './cli.module';

Kernel.standalone(CliModule).subscribe({
  error: (err) => {
    console.error('Fatal CLI Error:', err);
    process.exit(1);
  },
});
