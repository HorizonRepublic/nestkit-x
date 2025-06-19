import { WithImplicitCoercion } from 'node:buffer';
import { createZstdCompress } from 'node:zlib';

import { Inject, Injectable } from '@nestjs/common';
import {
  APP_REF_SERVICE,
  APP_STATE_SERVICE,
  IAppRefService,
  IAppStateService,
} from '@nestkit-x/core';

import type { NextFunction, Request, Response } from 'express';

const zstdMiddleware =
  (threshold = 1024) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const acceptEncoding = req.headers['accept-encoding'] ?? '';

    if (!acceptEncoding.includes('zstd')) {
      next();
      return;
    }

    // Кешуємо original write/end з правильними типами
    const rawWrite = res.write.bind(res);
    const rawEnd = res.end.bind(res);

    const chunks: Buffer[] = [];
    let ended = false;
    let headersSent = false;

    const restoreOriginalMethods = (): void => {
      res.write = rawWrite;
      res.end = rawEnd;
    };

    const handleError = (error: Error): void => {
      console.error('ZSTD compression error:', error);
      restoreOriginalMethods();

      if (!headersSent && !res.headersSent) {
        res.removeHeader('Content-Encoding');
        res.removeHeader('Vary');
      }

      if (!ended) {
        const body = Buffer.concat(chunks);

        res.setHeader('Content-Length', body.length);
        rawWrite(body);
        rawEnd();
      }
    };

    // Перевизначаємо write з правильною типізацією
    res.write = (
      chunk: WithImplicitCoercion<ArrayLike<number> | string>,
      // eslint-disable-next-line unused-imports/no-unused-vars
      encoding?: ((error: Error | null | undefined) => void) | BufferEncoding,
      cb?: (error: Error | null | undefined) => void,
    ): boolean => {
      if (ended) return false;

      try {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      } catch (error) {
        handleError(error as Error);
        return false;
      }
    };

    res.end = (
      chunk?: (() => void) | Buffer | string | Uint8Array,
      encoding?: (() => void) | BufferEncoding,
      cb?: () => void,
    ): Response => {
      if (ended) return res;

      try {
        // Обробляємо різні варіанти виклику end()
        let actualChunk: undefined | WithImplicitCoercion<ArrayLike<number> | string>;
        let actualCallback: (() => void) | undefined;

        if (typeof chunk === 'function') {
          // end(cb)
          actualCallback = chunk;
          actualChunk = undefined;
        } else if (typeof encoding === 'function') {
          // end(chunk, cb)
          actualChunk = chunk;
          actualCallback = encoding;
        } else {
          // end(chunk, encoding, cb) або end(chunk)
          actualChunk = chunk;
          actualCallback = cb;
        }

        if (actualChunk) {
          chunks.push(Buffer.isBuffer(actualChunk) ? actualChunk : Buffer.from(actualChunk));
        }

        ended = true;

        const body = Buffer.concat(chunks);

        // Якщо тіло менше порогу - відправляємо без стиснення
        if (body.length < threshold) {
          restoreOriginalMethods();
          res.setHeader('Content-Length', body.length);
          rawWrite(body);

          if (actualCallback) {
            return rawEnd(actualCallback);
          }

          return rawEnd();
        }

        // Налаштовуємо заголовки для стиснення
        res.removeHeader('Content-Length');
        res.setHeader('Content-Encoding', 'zstd');
        res.setHeader('Vary', 'Accept-Encoding');
        headersSent = true;

        const zstd = createZstdCompress();

        zstd.on('data', (compressedChunk: Buffer) => {
          try {
            rawWrite(compressedChunk);
          } catch (writeError) {
            console.error('Error writing compressed data:', writeError);
          }
        });

        zstd.on('end', () => {
          restoreOriginalMethods();
          if (actualCallback) {
            actualCallback();
          }

          rawEnd();
        });

        zstd.on('error', (compressionError: Error) => {
          handleError(compressionError);
        });

        zstd.end(body);

        return res;
      } catch (error) {
        handleError(error as Error);
        return res;
      }
    };

    next();
  };

@Injectable()
export class CompressionProvider {
  public constructor(
    @Inject(APP_REF_SERVICE)
    private readonly appRef: IAppRefService,

    @Inject(APP_STATE_SERVICE)
    private readonly appStateService: IAppStateService,
  ) {
    this.appStateService.onCreated(() => {
      const app = this.appRef.get();

      app.use(zstdMiddleware(1024));
    });
  }
}
