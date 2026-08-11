import EventEmitter from 'events';
import { Hospital } from '../types';

export class RedisCacheService extends EventEmitter {
  private kvStore = new Map<string, { value: string; expiresAt?: number }>();
  private geoStore = new Map<string, Map<string, { lat: number; lng: number }>>();
  private activeTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    super();
  }

  // Set String with TTL (seconds)
  async setWithExpiry(key: string, value: string, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.kvStore.set(key, { value, expiresAt });

    // Clear existing timer if any
    if (this.activeTimers.has(key)) {
      clearTimeout(this.activeTimers.get(key)!);
    }

    // Register active countdown timeout trigger
    const timer = setTimeout(() => {
      this.kvStore.delete(key);
      this.activeTimers.delete(key);
      this.emit('expired', key, value);
    }, ttlSeconds * 1000);

    this.activeTimers.set(key, timer);
  }

  async get(key: string): Promise<string | null> {
    const entry = this.kvStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cancelExpiry(key);
      return null;
    }
    return entry.value;
  }

  async delete(key: string): Promise<boolean> {
    this.cancelExpiry(key);
    return this.kvStore.delete(key);
  }

  cancelExpiry(key: string): void {
    if (this.activeTimers.has(key)) {
      clearTimeout(this.activeTimers.get(key)!);
      this.activeTimers.delete(key);
    }
    this.kvStore.delete(key);
  }

  // Geo Spatial Storage (Simulates Redis GEOADD & GEORADIUS)
  async geoAdd(key: string, memberId: string, lat: number, lng: number): Promise<void> {
    if (!this.geoStore.has(key)) {
      this.geoStore.set(key, new Map());
    }
    this.geoStore.get(key)!.set(memberId, { lat, lng });
  }

  async geoRadius(
    key: string,
    centerLat: number,
    centerLng: number,
    radiusKm: number
  ): Promise<Array<{ memberId: string; distanceKm: number }>> {
    const spatialMap = this.geoStore.get(key);
    if (!spatialMap) return [];

    const results: Array<{ memberId: string; distanceKm: number }> = [];

    for (const [memberId, coord] of spatialMap.entries()) {
      const dist = this.haversineDistance(centerLat, centerLng, coord.lat, coord.lng);
      if (dist <= radiusKm) {
        results.push({ memberId, distanceKm: dist });
      }
    }

    return results.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  // Haversine formula calculation for geo distances
  public haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  private toRadians(deg: number): number {
    return deg * (Math.PI / 180);
  }

  close(): void {
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    this.kvStore.clear();
    this.geoStore.clear();
  }
}

export const redisCache = new RedisCacheService();
