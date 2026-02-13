import { Injectable, Logger, VERSION_NEUTRAL } from '@nestjs/common';
import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';

@Injectable()
export class RoutesInspectorProvider {
  private readonly logger = new Logger('RoutesInspector');

  public constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  public inspect(): void {
    const controllers = this.discoveryService.getControllers();
    // ModuleName -> ControllerName -> Routes[]
    const tree: Record<string, Record<string, string[]>> = {};

    controllers.forEach((wrapper) => {
      const { instance, name, host } = wrapper;

      if (!instance || !name) return;

      const moduleName = host?.name ?? 'UnknownModule';

      const controllerPath =
        this.reflector.get<string | string[]>(PATH_METADATA, instance.constructor) || '';
      const version = this.reflector.get<string | string[] | typeof VERSION_NEUTRAL>(
        VERSION_METADATA,
        instance.constructor,
      );

      const safeControllerPath = Array.isArray(controllerPath) ? controllerPath[0] : controllerPath;
      const basePath = this.normalizePath(safeControllerPath);

      const prototype = Object.getPrototypeOf(instance);
      const methods = this.metadataScanner.getAllMethodNames(prototype);

      const routes: string[] = [];

      methods.forEach((methodName) => {
        const methodRef = instance[methodName];
        const path = this.reflector.get<string | string[]>(PATH_METADATA, methodRef);
        const requestMethod = this.reflector.get<number>('method', methodRef);
        const methodVersion = this.reflector.get<string | string[] | typeof VERSION_NEUTRAL>(
          VERSION_METADATA,
          methodRef,
        );

        if (path !== undefined && requestMethod !== undefined) {
          const methodStr = this.mapMethodIdToString(requestMethod);
          const safePath = Array.isArray(path) ? path[0] : path;
          const routePath = this.normalizePath(safePath);
          const fullPath = `/${basePath}/${routePath}`.replace(/\/+/g, '/').replace(/\/$/, '');

          // Визначаємо ефективну версію

          const effectiveVersion = methodVersion !== undefined ? methodVersion : version;
          const versionStr = this.formatVersion(effectiveVersion);

          routes.push(`${versionStr}${this.colorMethod(methodStr)} ${fullPath || '/'}`);
        }
      });

      if (routes.length > 0) {
        if (!tree[moduleName]) {
          tree[moduleName] = {};
        }

        tree[moduleName][name] = routes;
      }
    });

    if (Object.keys(tree).length > 0) {
      this.logger.log('Mapped Routes:');

      Object.entries(tree).forEach(([moduleName, controllersMap]) => {
        // Module Name
        this.logger.log(`\x1b[35m[Module] ${moduleName}\x1b[0m`);

        Object.entries(controllersMap).forEach(([controllerName, routes]) => {
          // Controller Name
          this.logger.log(`  \x1b[36m${controllerName}\x1b[0m`);

          routes.forEach((route, index) => {
            const isLast = index === routes.length - 1;
            const prefix = isLast ? '└──' : '├──';

            this.logger.log(`   ${prefix} ${route}`);
          });
        });
      });
    }
  }

  // --- Helpers ---

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatVersion(version: any): string {
    if (version === undefined || version === null) return '';
    if (version === VERSION_NEUTRAL) return '\x1b[90m[Neutral]\x1b[0m ';

    const versionContent = Array.isArray(version) ? version.join(',') : String(version);

    return `\x1b[90m[v${versionContent}]\x1b[0m `;
  }

  private normalizePath(path: string | undefined): string {
    if (!path) return '';
    return path.startsWith('/') ? path.slice(1) : path;
  }

  private mapMethodIdToString(id: number): string {
    switch (id) {
      case 0:
        return 'GET';
      case 1:
        return 'POST';
      case 2:
        return 'PUT';
      case 3:
        return 'DELETE';
      case 4:
        return 'PATCH';
      case 5:
        return 'ALL';
      case 6:
        return 'OPTIONS';
      case 7:
        return 'HEAD';
      default:
        return 'ANY';
    }
  }

  private colorMethod(method: string): string {
    switch (method) {
      case 'GET':
        return `\x1b[32m${method}\x1b[0m`;
      case 'POST':
        return `\x1b[33m${method}\x1b[0m`;
      case 'PUT':
        return `\x1b[34m${method}\x1b[0m`;
      case 'DELETE':
        return `\x1b[31m${method}\x1b[0m`;
      case 'PATCH':
        return `\x1b[35m${method}\x1b[0m`;
      default:
        return method;
    }
  }
}
