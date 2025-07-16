import { DynamicModule, Module } from '@nestjs/common';

@Module({})
export class NestKitMicroserviceClientModule {
  public static forRoot(): DynamicModule {
    return {
      module: NestKitMicroserviceClientModule,
    };
  }
}
