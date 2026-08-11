import { describe, it, expect, beforeEach } from 'vitest';
import { HospitalMatchingService } from '../../backend/src/services/hospital_matching';
import { Hospital, HospitalInventory, UserProfile } from '../../backend/src/types';

describe('HospitalMatchingService Unit Tests', () => {
  let service: HospitalMatchingService;

  const mockUser: UserProfile = {
    id: 'usr-1',
    fullName: 'Alice Smith',
    email: 'alice@example.com',
    phoneNumber: '+1-555-0100',
    dateOfBirth: '1990-01-01',
    bloodType: 'A+',
    allergies: [],
    medications: [],
    medicalConditions: [],
    emergencyContacts: [],
    budgetCeiling: 20000.00, // Budget ceiling in Rupees
    insuranceProvider: 'HealthPlus',
    preferredHospitalIds: [],
    preferredHospitalTier: 'ANY',
    deviceTokens: [],
  };

  const cheapHospital: Hospital = {
    id: 'hosp-cheap',
    name: 'Community Clinic',
    licenseId: 'LIC-001',
    phoneNumber: '+1-555-1111',
    address: '123 Main St',
    latitude: 37.775,
    longitude: -122.419,
    serviceTags: ['general'],
    pricingTier: 1, // ₹15,000 <= ₹20,000 budget ceiling
    acceptedInsurance: ['HealthPlus'],
    isActive: true,
  };

  const expensiveHospital: Hospital = {
    id: 'hosp-expensive',
    name: 'Advanced Trauma Center',
    licenseId: 'LIC-002',
    phoneNumber: '+1-555-2222',
    address: '456 Specialty Way',
    latitude: 37.776,
    longitude: -122.420,
    serviceTags: ['cardiac', 'trauma', 'icu'],
    pricingTier: 3, // ₹60,000 > ₹20,000 budget ceiling
    acceptedInsurance: ['HealthPlus'],
    isActive: true,
  };

  const inventory: HospitalInventory = {
    hospitalId: '',
    icuBedsAvailable: 2,
    generalBedsAvailable: 5,
    cardiacBedsAvailable: 2,
    traumaBedsAvailable: 2,
    ambulancesAvailable: 3,
    totalAmbulanceFleet: 5,
    lastUpdatedAt: new Date(),
  };

  beforeEach(() => {
    service = new HospitalMatchingService();
    service.registerHospital(cheapHospital, { ...inventory, hospitalId: cheapHospital.id });
    service.registerHospital(expensiveHospital, { ...inventory, hospitalId: expensiveHospital.id });
  });

  it('should filter out expensive hospital for MODERATE severity when over budget', async () => {
    const userLocation = { latitude: 37.7749, longitude: -122.4194 };
    const matches = await service.findBestMatches(userLocation, mockUser, 'MODERATE');

    expect(matches.length).toBe(1);
    expect(matches[0].hospital.id).toBe('hosp-cheap');
    expect(matches[0].isBudgetExceeded).toBe(false);
  });

  it('should apply LIFE_THREATENING budget override and include expensive hospital', async () => {
    const userLocation = { latitude: 37.7749, longitude: -122.4194 };
    const matches = await service.findBestMatches(userLocation, mockUser, 'LIFE_THREATENING');

    expect(matches.length).toBe(2);
    const expensiveMatch = matches.find((m) => m.hospital.id === 'hosp-expensive');
    expect(expensiveMatch).toBeDefined();
    expect(expensiveMatch?.budgetOverrideApplied).toBe(true);
    expect(expensiveMatch?.matchReasons.some((r) => r.includes('LIFE_THREATENING Override'))).toBe(true);
  });
});
