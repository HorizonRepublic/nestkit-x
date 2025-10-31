// import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
//
// export class JetstreamClientProxy extends ClientProxy {
//   public close(): any {}
//
//   public connect(): Promise<any> {
//     return Promise.resolve(undefined);
//   }
//
//   protected dispatchEvent<T>(packet: ReadPacket<T>): Promise<T> {
//     return Promise.resolve(undefined);
//   }
//
//   protected publish(
//     packet: ReadPacket<T>,
//     callback: { (packet: WritePacket<any>): void },
//   ): { (): void } {
//     return {};
//   }
//
//   public unwrap<T>(): T {
//     return undefined;
//   }
// }
