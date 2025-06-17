import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_CONFIG, IAppConfig } from '@nestkit-x/kernel';
import { Params as PinoParams } from 'nestjs-pino/params';
import * as pino from 'pino';

import { redactedPaths } from './const';

@Injectable()
export class LoggerConfigFactory {
  private readonly config: IAppConfig;

  public constructor(private readonly configService: ConfigService) {
    this.config = configService.getOrThrow<IAppConfig>(APP_CONFIG);
  }

  public get(): PinoParams {
    const isProduction = this.config.env === 'production';

    const baseConfig = {
      level: isProduction ? 'info' : 'debug',
      quietReqLogger: true,
      redact: {
        censor: '**HIDDEN**',
        paths: redactedPaths,
      },
      serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    };

    const productionConfig = isProduction
      ? {
          formatters: {
            level: (label: string): { level: string } => ({ level: label }),
            log: (object: Record<string, unknown>): Record<string, unknown> => ({
              ...object,
              service: this.config.name,
              version: this.config.version,
            }),
          },
        }
      : {};

    const developmentConfig = !isProduction
      ? {
          transport: {
            options: {
              colorize: true,
              errorLikeObjectKeys: ['err', 'error'],
              errorProps: 'stack,name,message,type',
              ignore: 'pid,hostname,req,res',
              messageFormat: '[{context}] {msg}',
              singleLine: true,
              translateTime: 'SYS:dd.mm.yyyy HH:MM:ss.l',
            },
            target: 'pino-pretty',
          },
        }
      : {};

    return {
      pinoHttp: {
        ...baseConfig,
        ...productionConfig,
        ...developmentConfig,
      },
    };
  }
}
