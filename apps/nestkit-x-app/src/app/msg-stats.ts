/**
 * Singleton for tracking message statistics across requests.
 * Used for load testing and monitoring message delivery rates.
 */
export class MessageStats {
  private static instance: MessageStats;

  private eventsSent = 0;
  private eventsReceived = 0;
  private rpcSent = 0;
  private rpcReceived = 0;

  private startTime: number | null = null;
  private lastCheckTime: number | null = null;
  private lastEventsSent = 0;
  private lastEventsReceived = 0;
  private lastRpcSent = 0;
  private lastRpcReceived = 0;

  // ✅ Пікові значення
  private peakEventsSentPerSec = 0;
  private peakEventsReceivedPerSec = 0;
  private peakRpcSentPerSec = 0;
  private peakRpcReceivedPerSec = 0;
  private peakTotalSent = 0;
  private peakTotalReceived = 0;

  private constructor() {}

  public static getInstance(): MessageStats {
    if (!MessageStats.instance) {
      MessageStats.instance = new MessageStats();

      // ✅ Запускаємо перевірку пікових значень кожну секунду
      setInterval(() => {
        MessageStats.instance.updatePeaks();
      }, 1000);
    }

    return MessageStats.instance;
  }

  // ==================== Increment methods ====================

  public incrementEventsSent(): void {
    this.ensureStarted();
    this.eventsSent++;
  }

  public incrementEventsReceived(): void {
    this.ensureStarted();
    this.eventsReceived++;
  }

  public incrementRpcSent(): void {
    this.ensureStarted();
    this.rpcSent++;
  }

  public incrementRpcReceived(): void {
    this.ensureStarted();
    this.rpcReceived++;
  }

  // ==================== Peak tracking ====================

  private updatePeaks(): void {
    if (!this.startTime) return;

    const now = Date.now();
    const lastCheck = this.lastCheckTime || this.startTime;
    const elapsed = (now - lastCheck) / 1000; // секунди

    if (elapsed === 0) return;

    // Обчислюємо поточну швидкість
    const currentEventsSentPerSec = (this.eventsSent - this.lastEventsSent) / elapsed;
    const currentEventsReceivedPerSec = (this.eventsReceived - this.lastEventsReceived) / elapsed;
    const currentRpcSentPerSec = (this.rpcSent - this.lastRpcSent) / elapsed;
    const currentRpcReceivedPerSec = (this.rpcReceived - this.lastRpcReceived) / elapsed;

    // Оновлюємо піки
    this.peakEventsSentPerSec = Math.max(this.peakEventsSentPerSec, currentEventsSentPerSec);
    this.peakEventsReceivedPerSec = Math.max(
      this.peakEventsReceivedPerSec,
      currentEventsReceivedPerSec,
    );
    this.peakRpcSentPerSec = Math.max(this.peakRpcSentPerSec, currentRpcSentPerSec);
    this.peakRpcReceivedPerSec = Math.max(this.peakRpcReceivedPerSec, currentRpcReceivedPerSec);

    const totalSentPerSec = currentEventsSentPerSec + currentRpcSentPerSec;
    const totalReceivedPerSec = currentEventsReceivedPerSec + currentRpcReceivedPerSec;

    this.peakTotalSent = Math.max(this.peakTotalSent, totalSentPerSec);
    this.peakTotalReceived = Math.max(this.peakTotalReceived, totalReceivedPerSec);

    // Зберігаємо поточні значення для наступної перевірки
    this.lastCheckTime = now;
    this.lastEventsSent = this.eventsSent;
    this.lastEventsReceived = this.eventsReceived;
    this.lastRpcSent = this.rpcSent;
    this.lastRpcReceived = this.rpcReceived;
  }

  // ==================== Getters ====================

  public getStats() {
    const uptime = this.startTime ? Date.now() - this.startTime : 0;
    const uptimeSeconds = Math.floor(uptime / 1000);

    return {
      uptime: uptimeSeconds,
      events: {
        sent: this.eventsSent,
        received: this.eventsReceived,
        lost: this.eventsSent - this.eventsReceived,
        successRate: this.calculateSuccessRate(this.eventsSent, this.eventsReceived),
      },
      rpc: {
        sent: this.rpcSent,
        received: this.rpcReceived,
        lost: this.rpcSent - this.rpcReceived,
        successRate: this.calculateSuccessRate(this.rpcSent, this.rpcReceived),
      },
      throughput: {
        eventsSentPerSec: this.calculateRate(this.eventsSent, uptimeSeconds),
        eventsReceivedPerSec: this.calculateRate(this.eventsReceived, uptimeSeconds),
        rpcSentPerSec: this.calculateRate(this.rpcSent, uptimeSeconds),
        rpcReceivedPerSec: this.calculateRate(this.rpcReceived, uptimeSeconds),
      },
      peaks: {
        eventsSentPerSec: Math.floor(this.peakEventsSentPerSec),
        eventsReceivedPerSec: Math.floor(this.peakEventsReceivedPerSec),
        rpcSentPerSec: Math.floor(this.peakRpcSentPerSec),
        rpcReceivedPerSec: Math.floor(this.peakRpcReceivedPerSec),
        totalSentPerSec: Math.floor(this.peakTotalSent),
        totalReceivedPerSec: Math.floor(this.peakTotalReceived),
      },
    };
  }

  // ==================== Logging ====================

  public logStats(): void {
    const stats = this.getStats();

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 MESSAGE STATISTICS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`⏱️  Uptime: ${stats.uptime}s`);
    console.log('');
    console.log('📨 EVENTS:');
    console.log(`   Sent:         ${stats.events.sent.toLocaleString()}`);
    console.log(`   Received:     ${stats.events.received.toLocaleString()}`);
    console.log(`   Lost:         ${stats.events.lost.toLocaleString()}`);
    console.log(`   Success Rate: ${stats.events.successRate}%`);
    console.log('');
    console.log('🔄 RPC:');
    console.log(`   Sent:         ${stats.rpc.sent.toLocaleString()}`);
    console.log(`   Received:     ${stats.rpc.received.toLocaleString()}`);
    console.log(`   Lost:         ${stats.rpc.lost.toLocaleString()}`);
    console.log(`   Success Rate: ${stats.rpc.successRate}%`);
    console.log('');
    console.log('⚡ THROUGHPUT (Average):');
    console.log(`   Events Sent:     ${stats.throughput.eventsSentPerSec.toFixed(2)}/s`);
    console.log(`   Events Received: ${stats.throughput.eventsReceivedPerSec.toFixed(2)}/s`);
    console.log(`   RPC Sent:        ${stats.throughput.rpcSentPerSec.toFixed(2)}/s`);
    console.log(`   RPC Received:    ${stats.throughput.rpcReceivedPerSec.toFixed(2)}/s`);
    console.log('');
    console.log('🔥 PEAKS (1-second window):');
    console.log(`   Events Sent:     ${stats.peaks.eventsSentPerSec.toLocaleString()}/s`);
    console.log(`   Events Received: ${stats.peaks.eventsReceivedPerSec.toLocaleString()}/s`);
    console.log(`   RPC Sent:        ${stats.peaks.rpcSentPerSec.toLocaleString()}/s`);
    console.log(`   RPC Received:    ${stats.peaks.rpcReceivedPerSec.toLocaleString()}/s`);
    console.log(`   Total Sent:      ${stats.peaks.totalSentPerSec.toLocaleString()}/s 🚀`);
    console.log(`   Total Received:  ${stats.peaks.totalReceivedPerSec.toLocaleString()}/s 🚀`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n');
  }

  public reset(): void {
    this.eventsSent = 0;
    this.eventsReceived = 0;
    this.rpcSent = 0;
    this.rpcReceived = 0;
    this.startTime = null;
    this.lastCheckTime = null;
    this.lastEventsSent = 0;
    this.lastEventsReceived = 0;
    this.lastRpcSent = 0;
    this.lastRpcReceived = 0;

    // ✅ Скидаємо піки
    this.peakEventsSentPerSec = 0;
    this.peakEventsReceivedPerSec = 0;
    this.peakRpcSentPerSec = 0;
    this.peakRpcReceivedPerSec = 0;
    this.peakTotalSent = 0;
    this.peakTotalReceived = 0;
  }

  // ==================== Private helpers ====================

  private ensureStarted(): void {
    if (this.startTime === null) {
      this.startTime = Date.now();
      this.lastCheckTime = this.startTime;
    }
  }

  private calculateSuccessRate(sent: number, received: number): string {
    if (sent === 0) return '0.00';

    return ((received / sent) * 100).toFixed(2);
  }

  private calculateRate(count: number, seconds: number): number {
    if (seconds === 0) return 0;

    return count / seconds;
  }
}
