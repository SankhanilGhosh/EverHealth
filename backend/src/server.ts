import { app, syncHospitalToSupabase } from './app';
import { hospitalMatchingService } from './services/hospital_matching';
import { Hospital, HospitalInventory } from './types';

const PORT = process.env.PORT || 3000;

// Register default demo hospitals for local deployment
const stJudeHospital: Hospital = {
  id: 'hosp-001',
  name: 'St. Jude Trauma & Cardiac Emergency Center',
  licenseId: 'LIC-CA-94812',
  phoneNumber: '+1-555-0190',
  address: '500 Medical Plaza, San Francisco, CA',
  latitude: 37.7749,
  longitude: -122.4194,
  serviceTags: ['cardiac', 'trauma', 'icu', 'pediatric'],
  pricingTier: 2,
  acceptedInsurance: ['BlueCross', 'UnitedHealth', 'Kaiser'],
  isActive: true,
};

const stJudeInventory: HospitalInventory = {
  hospitalId: stJudeHospital.id,
  icuBedsAvailable: 4,
  generalBedsAvailable: 12,
  cardiacBedsAvailable: 2,
  traumaBedsAvailable: 3,
  ambulancesAvailable: 3,
  totalAmbulanceFleet: 5,
  lastUpdatedAt: new Date(),
};

const mercyHospital: Hospital = {
  id: 'hosp-002',
  name: 'Mercy Regional Emergency Care',
  licenseId: 'LIC-CA-94815',
  phoneNumber: '+1-555-0195',
  address: '120 Mission St, San Francisco, CA',
  latitude: 37.7833,
  longitude: -122.4167,
  serviceTags: ['general', 'icu', 'pediatric', 'cardiac'],
  pricingTier: 1,
  acceptedInsurance: ['BlueCross'],
  isActive: true,
};

const mercyInventory: HospitalInventory = {
  hospitalId: mercyHospital.id,
  icuBedsAvailable: 2,
  generalBedsAvailable: 8,
  cardiacBedsAvailable: 2,
  traumaBedsAvailable: 1,
  ambulancesAvailable: 2,
  totalAmbulanceFleet: 3,
  lastUpdatedAt: new Date(),
};

hospitalMatchingService.registerHospital(stJudeHospital, stJudeInventory);
hospitalMatchingService.registerHospital(mercyHospital, mercyInventory);

// Sync hospitals and bed inventories directly into Supabase
syncHospitalToSupabase(stJudeHospital, stJudeInventory);
syncHospitalToSupabase(mercyHospital, mercyInventory);

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` EverHealth Monitoring Platform is live!`);
  console.log(` Local Dashboard & API: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
