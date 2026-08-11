import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { alertService } from '../../backend/src/services/alert_service';
import { vitalsIngestionService } from '../../backend/src/services/vitals_ingestion';
import { hospitalMatchingService } from '../../backend/src/services/hospital_matching';
import { bookingService } from '../../backend/src/services/booking_service';
import { redisCache } from '../../backend/src/db/redis_cache';
import { Hospital, HospitalInventory, UserProfile, VitalReading } from '../../backend/src/types';

describe('Emergency Platform End-to-End Pipeline Integration Test', () => {
  const mockUser: UserProfile = {
    id: 'usr-pipeline-1',
    fullName: 'John Pipeline',
    email: 'john@example.com',
    phoneNumber: '+1-555-9999',
    dateOfBirth: '1980-05-05',
    bloodType: 'B+',
    allergies: ['Latex'],
    medications: [],
    medicalConditions: ['Cardiac Arrhythmia'],
    emergencyContacts: [{ name: 'Sarah', phone: '+1-555-8888', relationship: 'Sister' }],
    budgetCeiling: 600.00,
    insuranceProvider: 'UnitedHealth',
    preferredHospitalIds: [],
    preferredHospitalTier: 'ANY',
    deviceTokens: ['token-xyz'],
  };

  const hospital: Hospital = {
    id: 'hosp-pipeline-1',
    name: 'City General Emergency Hospital',
    licenseId: 'LIC-PIPE-99',
    phoneNumber: '+1-555-4444',
    address: '789 Rescue Blvd',
    latitude: 37.775,
    longitude: -122.419,
    serviceTags: ['cardiac', 'trauma', 'icu'],
    pricingTier: 2,
    acceptedInsurance: ['UnitedHealth'],
    isActive: true,
  };

  const inventory: HospitalInventory = {
    hospitalId: hospital.id,
    icuBedsAvailable: 3,
    generalBedsAvailable: 10,
    cardiacBedsAvailable: 4,
    traumaBedsAvailable: 2,
    ambulancesAvailable: 2,
    totalAmbulanceFleet: 4,
    lastUpdatedAt: new Date(),
  };

  beforeEach(() => {
    alertService.clear();
    vitalsIngestionService.clearHistory();
    hospitalMatchingService.clear();
    bookingService.clear();

    hospitalMatchingService.registerHospital(hospital, inventory);
  });

  afterEach(() => {
    redisCache.close();
  });

  it('should process vital anomaly, trigger countdown alert, and support user cancellation', async () => {
    const reading: VitalReading = {
      userId: mockUser.id,
      timestamp: new Date(),
      heartRate: 175, // Tachycardia breach
      spo2: 95,
      fallDetected: false,
      sourceDevice: 'Apple Watch Series 9',
    };

    const ingestionResult = await vitalsIngestionService.ingestReading(reading);
    expect(ingestionResult.detectionResult.isEmergency).toBe(true);
    expect(ingestionResult.detectionResult.severity).toBe('SEVERE');

    const alert = await alertService.triggerAlert(
      mockUser.id,
      reading,
      ingestionResult.detectionResult.reason,
      ingestionResult.detectionResult.severity,
      30
    );

    expect(alert).not.toBeNull();
    expect(alert?.status).toBe('COUNTDOWN_ACTIVE');

    // Cancel alert within window
    const cancelledAlert = await alertService.cancelAlert(alert!.id, 'User recovered / false alarm');
    expect(cancelledAlert?.status).toBe('CANCELLED_BY_USER');
  });

  it('should auto-dispatch hospital booking when alert countdown times out', async () => {
    const reading: VitalReading = {
      userId: mockUser.id,
      timestamp: new Date(),
      heartRate: 180,
      spo2: 86, // Life-threatening
      fallDetected: true,
      sourceDevice: 'Garmin Venu 3',
    };

    // Set 1-second short countdown timer for integration testing
    const alert = await alertService.triggerAlert(
      mockUser.id,
      reading,
      'Severe respiratory drop and hard impact fall',
      'LIFE_THREATENING',
      1 // 1 second timer
    );

    expect(alert?.status).toBe('COUNTDOWN_ACTIVE');

    // Wait for 1.2 seconds for Redis cache timer to expire and trigger handleCountdownTimeout
    await new Promise((resolve) => setTimeout(resolve, 1300));

    const updatedAlert = alertService.getEvent(alert!.id);
    expect(updatedAlert?.status).toBe('TIMEOUT_DISPATCHED');
  });
});
