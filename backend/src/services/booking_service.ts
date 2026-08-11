import { v4 as uuidv4 } from 'uuid';
import { Booking, BookingStatus, HospitalMatchResult, EmergencyEvent } from '../types';
import { redisCache } from '../db/redis_cache';
import { EventEmitter } from 'events';

export class BookingService extends EventEmitter {
  private activeBookings = new Map<string, Booking>();
  private matchQueues = new Map<string, HospitalMatchResult[]>(); // eventId -> ranked candidates
  private currentMatchIndexes = new Map<string, number>(); // eventId -> index of active candidate
  private slaSeconds = 25; // 25s SLA per hospital prompt

  constructor() {
    super();
    // Listen for SLA timeout from Redis cache
    redisCache.on('expired', (key: string, value: string) => {
      if (key.startsWith('booking:sla:')) {
        const bookingId = key.replace('booking:sla:', '');
        this.handleSlaTimeout(bookingId);
      }
    });
  }

  public async initiateBookingCascade(
    event: EmergencyEvent,
    matchResults: HospitalMatchResult[]
  ): Promise<Booking | null> {
    if (matchResults.length === 0) {
      console.error(`[BookingService] No candidate hospitals available for event ${event.id}`);
      this.emit('booking:failed', { event, reason: 'No available hospitals found' });
      return null;
    }

    this.matchQueues.set(event.id, matchResults);
    this.currentMatchIndexes.set(event.id, 0);

    return this.createBookingForCandidate(event, matchResults[0]);
  }

  private async createBookingForCandidate(
    event: EmergencyEvent,
    match: HospitalMatchResult
  ): Promise<Booking> {
    const bookingId = uuidv4();
    const slaExpiresAt = new Date(Date.now() + this.slaSeconds * 1000);

    const booking: Booking = {
      id: bookingId,
      eventId: event.id,
      hospitalId: match.hospital.id,
      ambulanceId: `AMB-${Math.floor(100 + Math.random() * 900)}`,
      status: 'REQUESTED',
      etaMinutes: match.etaMinutes,
      slaExpiresAt,
      dispatchCostEstimate: match.hospital.pricingTier * 250,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.activeBookings.set(bookingId, booking);

    // Set Redis SLA expiration timer
    const payload = JSON.stringify({ bookingId, eventId: event.id, hospitalId: match.hospital.id });
    await redisCache.setWithExpiry(`booking:sla:${bookingId}`, payload, this.slaSeconds);

    console.log(
      `[BookingService] Dispatch requested to Hospital "${match.hospital.name}" (${match.hospital.id}). SLA: ${this.slaSeconds}s.`
    );

    this.emit('booking:requested', booking, match);
    return booking;
  }

  public async updateBookingStatus(
    bookingId: string,
    newStatus: BookingStatus
  ): Promise<Booking | null> {
    const booking = this.activeBookings.get(bookingId);
    if (!booking) return null;

    booking.status = newStatus;
    booking.updatedAt = new Date();

    if (newStatus === 'ACCEPTED') {
      // Clear SLA timer on hospital acceptance
      await redisCache.delete(`booking:sla:${bookingId}`);
      console.log(`[BookingService] Booking ${bookingId} ACCEPTED by hospital ${booking.hospitalId}!`);
      this.emit('booking:accepted', booking);
    } else if (newStatus === 'REJECTED') {
      await redisCache.delete(`booking:sla:${bookingId}`);
      console.log(`[BookingService] Booking ${bookingId} REJECTED by hospital ${booking.hospitalId}. Cascading...`);
      await this.cascadeToNextHospital(booking.eventId);
    }

    return booking;
  }

  private async handleSlaTimeout(bookingId: string): Promise<void> {
    const booking = this.activeBookings.get(bookingId);
    if (!booking || booking.status !== 'REQUESTED') return;

    console.log(`[BookingService] Hospital response SLA expired for booking ${bookingId}. Cascading...`);
    booking.status = 'REJECTED';
    booking.updatedAt = new Date();
    this.emit('booking:sla_expired', booking);

    await this.cascadeToNextHospital(booking.eventId);
  }

  private async cascadeToNextHospital(eventId: string): Promise<void> {
    const queue = this.matchQueues.get(eventId);
    const currentIndex = this.currentMatchIndexes.get(eventId) ?? 0;
    const nextIndex = currentIndex + 1;

    if (!queue || nextIndex >= queue.length) {
      console.error(`[BookingService] All candidate hospitals exhausted/rejected for event ${eventId}!`);
      this.emit('booking:exhausted', { eventId });
      return;
    }

    this.currentMatchIndexes.set(eventId, nextIndex);
    const nextMatch = queue[nextIndex];
    console.log(`[BookingService] Cascading dispatch for event ${eventId} to candidate #${nextIndex + 1}: ${nextMatch.hospital.name}`);

    // Create booking for next hospital in cascade queue
    const dummyEvent: EmergencyEvent = {
      id: eventId,
      userId: '',
      triggerVitals: [] as any,
      detectionReason: '',
      severity: 'MODERATE',
      status: 'TIMEOUT_DISPATCHED',
      alertFiredAt: new Date(),
      createdAt: new Date(),
    };

    await this.createBookingForCandidate(dummyEvent, nextMatch);
  }

  public getBooking(bookingId: string): Booking | undefined {
    return this.activeBookings.get(bookingId);
  }

  public clear(): void {
    this.activeBookings.clear();
    this.matchQueues.clear();
    this.currentMatchIndexes.clear();
  }
}

export const bookingService = new BookingService();
