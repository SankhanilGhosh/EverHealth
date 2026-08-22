import { describe, it, expect, beforeEach } from 'vitest';
import { HospitalMatchingService } from '../../backend/src/services/hospital_matching';
import { Hospital, HospitalInventory, UserProfile } from '../../backend/src/types';

describe('HData Hospitals Registration & Spatial Ranking Unit Tests', () => {
  let service: HospitalMatchingService;

  const mockPatient: UserProfile = {
    id: 'usr-hdata-test',
    fullName: 'Rahul Sharma',
    email: 'rahul@example.com',
    phoneNumber: '+91-98765-43210',
    dateOfBirth: '1988-06-15',
    bloodType: 'B+',
    allergies: ['Penicillin'],
    medications: ['Amlodipine'],
    medicalConditions: ['Hypertension'],
    emergencyContacts: [],
    budgetCeiling: 40000.00,
    insuranceProvider: 'BlueCross',
    preferredHospitalIds: [],
    preferredHospitalTier: 'ANY',
    deviceTokens: [],
  };

  const aiims: Hospital = {
    id: 'hosp-aiims-delhi',
    name: 'AIIMS New Delhi',
    licenseId: 'LIC-DL-00101',
    phoneNumber: '+91-11-26588500',
    address: 'Ansari Nagar, New Delhi',
    latitude: 28.5672,
    longitude: 77.2100,
    serviceTags: ['medicine', 'surgery', 'cardiology', 'neurology', 'orthopaedics', 'paediatrics', 'gynaecology', 'ent', 'dermatology', 'diagnostics', 'emergency', 'icu'],
    pricingTier: 1,
    acceptedInsurance: ['Ayushman Bharat', 'Government Schemes', 'BlueCross', 'UnitedHealth'],
    isActive: true,
  };

  const aiimsInv: HospitalInventory = {
    hospitalId: aiims.id,
    icuBedsAvailable: 15,
    generalBedsAvailable: 50,
    cardiacBedsAvailable: 10,
    traumaBedsAvailable: 12,
    ambulancesAvailable: 8,
    totalAmbulanceFleet: 10,
    lastUpdatedAt: new Date(),
  };

  const apollo: Hospital = {
    id: 'hosp-apollo-delhi',
    name: 'Apollo Hospitals – Delhi',
    licenseId: 'LIC-DL-00102',
    phoneNumber: '+91-11-26925858',
    address: 'Sarita Vihar, Delhi-Mathura Road, New Delhi',
    latitude: 28.5355,
    longitude: 77.2880,
    serviceTags: ['medicine', 'surgery', 'cardiology', 'neurology', 'orthopaedics', 'paediatrics', 'gynaecology', 'ent', 'dermatology', 'diagnostics', 'emergency', 'icu'],
    pricingTier: 2,
    acceptedInsurance: ['BlueCross', 'UnitedHealth', 'Star Health', 'Max Bupa', 'Cigna'],
    isActive: true,
  };

  const apolloInv: HospitalInventory = {
    hospitalId: apollo.id,
    icuBedsAvailable: 10,
    generalBedsAvailable: 35,
    cardiacBedsAvailable: 8,
    traumaBedsAvailable: 6,
    ambulancesAvailable: 5,
    totalAmbulanceFleet: 8,
    lastUpdatedAt: new Date(),
  };

  const fortis: Hospital = {
    id: 'hosp-fortis-gurugram',
    name: 'Fortis Memorial Research Institute – Gurugram',
    licenseId: 'LIC-HR-00201',
    phoneNumber: '+91-124-4921021',
    address: 'Sector 44, Opposite HUDA City Centre, Gurugram, Haryana',
    latitude: 28.4595,
    longitude: 77.0725,
    serviceTags: ['medicine', 'surgery', 'cardiology', 'neurology', 'orthopaedics', 'paediatrics', 'gynaecology', 'ent', 'dermatology', 'diagnostics', 'emergency', 'icu'],
    pricingTier: 3,
    acceptedInsurance: ['BlueCross', 'UnitedHealth', 'Religare', 'Cigna', 'Max Bupa'],
    isActive: true,
  };

  const fortisInv: HospitalInventory = {
    hospitalId: fortis.id,
    icuBedsAvailable: 12,
    generalBedsAvailable: 40,
    cardiacBedsAvailable: 6,
    traumaBedsAvailable: 8,
    ambulancesAvailable: 6,
    totalAmbulanceFleet: 8,
    lastUpdatedAt: new Date(),
  };

  beforeEach(() => {
    service = new HospitalMatchingService();
    service.registerHospital(aiims, aiimsInv);
    service.registerHospital(apollo, apolloInv);
    service.registerHospital(fortis, fortisInv);
  });

  it('should register and retrieve all hdata hospitals', () => {
    const list = service.getAllHospitals();
    expect(list.length).toBe(3);
    expect(service.getHospital('hosp-aiims-delhi')?.name).toBe('AIIMS New Delhi');
    expect(service.getHospital('hosp-apollo-delhi')?.name).toBe('Apollo Hospitals – Delhi');
    expect(service.getHospital('hosp-fortis-gurugram')?.name).toBe('Fortis Memorial Research Institute – Gurugram');
  });

  it('should rank AIIMS and Apollo within ₹40,000 budget and filter Fortis in MODERATE severity', async () => {
    const delhiLoc = { latitude: 28.5672, longitude: 77.2100 };
    const matches = await service.findBestMatches(delhiLoc, mockPatient, 'MODERATE');

    expect(matches.length).toBe(2);
    expect(matches[0].hospital.id).toBe('hosp-aiims-delhi');
    expect(matches[1].hospital.id).toBe('hosp-apollo-delhi');
  });

  it('should override budget ceiling for LIFE_THREATENING emergencies and include Fortis', async () => {
    const delhiLoc = { latitude: 28.5672, longitude: 77.2100 };
    const matches = await service.findBestMatches(delhiLoc, mockPatient, 'LIFE_THREATENING');

    expect(matches.length).toBe(3);
    const fortisMatch = matches.find(m => m.hospital.id === 'hosp-fortis-gurugram');
    expect(fortisMatch?.budgetOverrideApplied).toBe(true);
  });
});
