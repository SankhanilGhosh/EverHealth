import { v4 as uuidv4 } from 'uuid';
import { EmergencyEvent, VitalReading, Severity } from '../types';
import { redisCache } from '../db/redis_cache';
import { EventEmitter } from 'events';

export class AlertService extends EventEmitter {
  private activeEvents = new Map<string, EmergencyEvent>();
  private refractoryWindowMs = 5 * 60 * 1000; // 5 minutes
  private lastAlertTimestamp = new Map<string, number>();

  constructor() {
    super();
    // Listen for server-authoritative timer expiration from Redis Cache
    redisCache.on('expired', (key: string, value: string) => {
      if (key.startsWith('alert:countdown:')) {
        const eventId = key.replace('alert:countdown:', '');
        this.handleCountdownTimeout(eventId, value);
      }
    });
  }

  public async triggerAlert(
    userId: string,
    vitals: VitalReading,
    reason: string,
    severity: Severity,
    countdownSeconds: number = 30
  ): Promise<EmergencyEvent | null> {
    // 1. Refractory Window Check to prevent alert storms
    const lastFired = this.lastAlertTimestamp.get(userId);
    if (lastFired && Date.now() - lastFired < this.refractoryWindowMs) {
      console.log(`[AlertService] Alert suppressed for user ${userId}: within refractory window.`);
      return null;
    }

    const eventId = uuidv4();
    const event: EmergencyEvent = {
      id: eventId,
      userId,
      triggerVitals: vitals,
      detectionReason: reason,
      severity,
      status: 'COUNTDOWN_ACTIVE',
      alertFiredAt: new Date(),
      createdAt: new Date(),
    };

    this.activeEvents.set(eventId, event);
    this.lastAlertTimestamp.set(userId, Date.now());

    // 2. Set server-authoritative countdown in Redis Cache
    const payload = JSON.stringify({ userId, eventId, severity, reason });
    await redisCache.setWithExpiry(`alert:countdown:${eventId}`, payload, countdownSeconds);

    console.log(
      `[AlertService] Alert ${eventId} triggered for user ${userId}. ${countdownSeconds}s countdown started.`
    );
    this.emit('alert:triggered', event);

    return event;
  }

  public async cancelAlert(eventId: string, reason: string): Promise<EmergencyEvent | null> {
    const event = this.activeEvents.get(eventId);
    if (!event) return null;

    if (event.status !== 'COUNTDOWN_ACTIVE') {
      console.log(`[AlertService] Alert ${eventId} cannot be cancelled (status: ${event.status})`);
      return event;
    }

    // Cancel server-side timer
    await redisCache.delete(`alert:countdown:${eventId}`);

    event.status = 'CANCELLED_BY_USER';
    event.cancelledAt = new Date();
    event.cancellationReason = reason;

    console.log(`[AlertService] Alert ${eventId} cancelled by user. Reason: ${reason}`);
    this.emit('alert:cancelled', event);

    return event;
  }

  private async handleCountdownTimeout(eventId: string, rawPayload: string): Promise<void> {
    const event = this.activeEvents.get(eventId);
    if (!event) return;

    if (event.status !== 'COUNTDOWN_ACTIVE') {
      return;
    }

    event.status = 'TIMEOUT_DISPATCHED';
    console.log(`[AlertService] Alert ${eventId} timed out! Initiating emergency dispatch...`);

    // Emit event timeout for Hospital Matching & Dispatch Engine and Notification Service
    this.emit('alert:timeout', event);
  }

  public getEvent(eventId: string): EmergencyEvent | undefined {
    return this.activeEvents.get(eventId);
  }

  public getAllEvents(): EmergencyEvent[] {
    return Array.from(this.activeEvents.values());
  }

  public clear(): void {
    this.activeEvents.clear();
    this.lastAlertTimestamp.clear();
  }
}

export const alertService = new AlertService();
