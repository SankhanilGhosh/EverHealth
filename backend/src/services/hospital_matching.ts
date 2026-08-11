import { Hospital, HospitalInventory, UserProfile, HospitalMatchResult, Severity } from '../types';
import { redisCache } from '../db/redis_cache';

export class HospitalMatchingService {
  private hospitals = new Map<string, Hospital>();
  private inventories = new Map<string, HospitalInventory>();

  public registerHospital(hospital: Hospital, inventory: HospitalInventory): void {
    this.hospitals.set(hospital.id, hospital);
    this.inventories.set(hospital.id, inventory);
    redisCache.geoAdd('hospitals:geo', hospital.id, hospital.latitude, hospital.longitude);
  }

  public updateInventory(hospitalId: string, inventory: Partial<HospitalInventory>): HospitalInventory | null {
    const existing = this.inventories.get(hospitalId);
    if (!existing) return null;

    const updated: HospitalInventory = {
      ...existing,
      ...inventory,
      lastUpdatedAt: new Date(),
    };
    this.inventories.set(hospitalId, updated);
    return updated;
  }

  public updateServices(hospitalId: string, serviceTags: string[]): Hospital | null {
    const existing = this.hospitals.get(hospitalId);
    if (!existing) return null;

    const updated: Hospital = {
      ...existing,
      serviceTags: serviceTags.map(s => s.toLowerCase().trim()),
    };
    this.hospitals.set(hospitalId, updated);
    return updated;
  }

  public updateHospitalInfo(hospitalId: string, info: Partial<Hospital>): Hospital | null {
    const existing = this.hospitals.get(hospitalId);
    if (!existing) return null;

    const updated: Hospital = {
      ...existing,
      ...info,
    };
    this.hospitals.set(hospitalId, updated);
    return updated;
  }

  public getAllHospitals(): { hospital: Hospital; inventory: HospitalInventory }[] {
    const list: { hospital: Hospital; inventory: HospitalInventory }[] = [];
    for (const [id, hospital] of this.hospitals.entries()) {
      const inventory = this.inventories.get(id);
      if (inventory) {
        list.push({ hospital, inventory });
      }
    }
    return list;
  }

  public getHospital(id: string): Hospital | undefined {
    return this.hospitals.get(id);
  }

  public getInventory(id: string): HospitalInventory | undefined {
    return this.inventories.get(id);
  }

  public async findBestMatches(
    userLocation: { latitude: number; longitude: number },
    userProfile: UserProfile,
    severity: Severity,
    requiredServices: string[] = [],
    maxRadiusKm: number = 25
  ): Promise<HospitalMatchResult[]> {
    // 1. Spatial query: Find hospitals within radius
    const nearby = await redisCache.geoRadius(
      'hospitals:geo',
      userLocation.latitude,
      userLocation.longitude,
      maxRadiusKm
    );

    const candidates: HospitalMatchResult[] = [];
    const isLifeThreatening = severity === 'LIFE_THREATENING';

    for (const item of nearby) {
      const hospital = this.hospitals.get(item.memberId);
      const inventory = this.inventories.get(item.memberId);

      if (!hospital || !inventory || !hospital.isActive) continue;

      // 2. Hard Filter: Bed Availability Check
      const totalBeds =
        inventory.icuBedsAvailable +
        inventory.generalBedsAvailable +
        inventory.cardiacBedsAvailable +
        inventory.traumaBedsAvailable;

      if (totalBeds <= 0 && inventory.ambulancesAvailable <= 0) {
        continue; // No bed or ambulance capacity available
      }

      // Hard Filter: Service Tag match
      const hasRequiredServices = requiredServices.every((tag) =>
        hospital.serviceTags.includes(tag.toLowerCase())
      );
      if (requiredServices.length > 0 && !hasRequiredServices) {
        continue;
      }

      // 3. Budget & Pricing Evaluation in Rupees (₹)
      const estimatedCost = hospital.pricingTier === 1 ? 15000 : hospital.pricingTier === 2 ? 35000 : 60000; // ₹15,000 (Budget), ₹35,000 (Standard), ₹60,000 (Premium)
      const isBudgetExceeded = estimatedCost > userProfile.budgetCeiling;

      // Hard filter for normal emergencies, advisory bypass for LIFE_THREATENING
      if (isBudgetExceeded && !isLifeThreatening) {
        continue; // Filter out if over budget during non-life-threatening emergency
      }

      // 4. Calculate ETA (Simulated 2 min per km + 3 min base dispatch delay)
      const etaMinutes = Math.round(item.distanceKm * 2.0 + 3);

      // 5. Weighted Soft Scoring Formula
      let score = 100;
      const matchReasons: string[] = [];

      // ETA Score (decay with distance)
      score -= etaMinutes * 2.5;
      matchReasons.push(`Estimated ETA: ${etaMinutes} mins (${item.distanceKm} km)`);

      // Service Match bonus
      if (hasRequiredServices && requiredServices.length > 0) {
        score += 20;
        matchReasons.push(`Direct match for services: ${requiredServices.join(', ')}`);
      }

      // Insurance Match bonus
      if (
        userProfile.insuranceProvider &&
        hospital.acceptedInsurance.includes(userProfile.insuranceProvider)
      ) {
        score += 15;
        matchReasons.push(`In-network for ${userProfile.insuranceProvider}`);
      }

      // Preferred Hospital Bonus
      if (userProfile.preferredHospitalIds.includes(hospital.id)) {
        score += 25;
        matchReasons.push('User preferred hospital list match');
      }

      // Hospital Capacity Load Score
      if (inventory.icuBedsAvailable > 0) score += 10;
      if (inventory.ambulancesAvailable > 0) score += 10;

      // Penalty if over budget during LIFE_THREATENING override
      let budgetOverrideApplied = false;
      if (isBudgetExceeded && isLifeThreatening) {
        score -= 15; // Moderate soft penalty
        budgetOverrideApplied = true;
        matchReasons.push(
          `[LIFE_THREATENING Override]: Included hospital exceeding budget ceiling (₹${estimatedCost.toLocaleString('en-IN')} > ₹${userProfile.budgetCeiling.toLocaleString('en-IN')})`
        );
      }

      candidates.push({
        hospital,
        inventory,
        etaMinutes,
        score: Math.round(score * 10) / 10,
        matchReasons,
        isBudgetExceeded,
        budgetOverrideApplied,
      });
    }

    // Sort by final score descending
    return candidates.sort((a, b) => b.score - a.score);
  }

  public clear(): void {
    this.hospitals.clear();
    this.inventories.clear();
  }
}

export const hospitalMatchingService = new HospitalMatchingService();
