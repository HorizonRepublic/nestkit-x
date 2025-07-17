// managers/pattern.registry.ts
import { MessageHandler } from '@nestjs/microservices';
import { LoggerService } from '@nestjs/common';
import { JsKind } from '../const/enum';

export class JsPatternRegistry {
  private readonly svc: string;

  constructor(
    serviceName: string,
    private readonly handlers: Map<string, MessageHandler>,
    private readonly logger: LoggerService,
  ) {
    this.svc = serviceName;
  }

  /** скорочує subject → повертає handler або null */
  getHandler(subject: string): MessageHandler | null {
    const base = this.denormalize(subject);
    return this.handlers.get(base) ?? null;
  }

  /** повертає списки і одразу лог/debug */
  list(): { events: string[]; messages: string[] } {
    const ev: string[] = [];
    const cmd: string[] = [];
    for (const [p, h] of this.handlers) (h.isEventHandler ? ev : cmd).push(p);

    this.logger.log(`Events: ${ev.join(', ') || 'none'}; Messages: ${cmd.join(', ') || 'none'}`);

    return { events: ev, messages: cmd };
  }

  /* ───── helpers ───── */

  private denormalize(subj: string): string {
    const cmd = `${this.svc}.${JsKind.Command}.`;
    const evt = `${this.svc}.${JsKind.Event}.`;

    if (subj.startsWith(cmd)) return subj.replace(cmd, '');
    if (subj.startsWith(evt)) return subj.replace(evt, '');

    return subj;
  }
}
