import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_CONFIG, Environment, IAppConfig } from '@zerly/core';
import { Params as PinoParams } from 'nestjs-pino/params';
import type { LoggerOptions } from 'pino';
import * as pino from 'pino';

import { REDACTED_MSG, redactedPaths } from './const';

@Injectable()
export class LoggerConfigFactory {
  private readonly config: IAppConfig;

  public constructor(private readonly configService: ConfigService) {
    this.config = configService.getOrThrow<IAppConfig>(APP_CONFIG);
  }

  public get(): PinoParams {
    const isProduction = this.config.env === Environment.Prod;

    const baseConfig: LoggerOptions = {
      level: isProduction ? 'warn' : 'debug',
      name: this.config.name,
      redact: {
        censor: REDACTED_MSG,
        paths: redactedPaths,
      },
      serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    };

    const productionConfig: Partial<LoggerOptions> = isProduction
      ? {
          formatters: {
            level: (label: string) => ({ level: label }),
            log: (object: Record<string, unknown>) => ({
              ...object,
              service: this.config.name,
              version: this.config.version,
            }),
          },
        }
      : {};

    const developmentConfig: Partial<LoggerOptions> = !isProduction
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              errorLikeObjectKeys: ['err', 'error'],
              errorProps: 'stack,name,message,type',
              ignore: 'pid,hostname,req,res',
              messageFormat: '[{context}] {msg}',
              singleLine: true,
              translateTime: 'SYS:dd.mm.yyyy HH:MM:ss.l',
            },
          },
        }
      : {};

    return {
      pinoHttp: {
        autoLogging: false,
        ...baseConfig,
        ...productionConfig,
        ...developmentConfig,
      },
    };
  }
}
