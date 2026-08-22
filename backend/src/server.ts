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

// Register accredited hospitals from Desktop/hdata Database
const aiimsHospital: Hospital = {
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

const aiimsInventory: HospitalInventory = {
  hospitalId: aiimsHospital.id,
  icuBedsAvailable: 15,
  generalBedsAvailable: 50,
  cardiacBedsAvailable: 10,
  traumaBedsAvailable: 12,
  ambulancesAvailable: 8,
  totalAmbulanceFleet: 10,
  lastUpdatedAt: new Date(),
};

const apolloHospital: Hospital = {
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

const apolloInventory: HospitalInventory = {
  hospitalId: apolloHospital.id,
  icuBedsAvailable: 10,
  generalBedsAvailable: 35,
  cardiacBedsAvailable: 8,
  traumaBedsAvailable: 6,
  ambulancesAvailable: 5,
  totalAmbulanceFleet: 8,
  lastUpdatedAt: new Date(),
};

const fortisHospital: Hospital = {
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

const fortisInventory: HospitalInventory = {
  hospitalId: fortisHospital.id,
  icuBedsAvailable: 12,
  generalBedsAvailable: 40,
  cardiacBedsAvailable: 6,
  traumaBedsAvailable: 8,
  ambulancesAvailable: 6,
  totalAmbulanceFleet: 8,
  lastUpdatedAt: new Date(),
};

const narayanaHospital: Hospital = {
  id: 'hosp-narayana-bengaluru',
  name: 'Narayana Health – Bengaluru',
  licenseId: 'LIC-KA-00301',
  phoneNumber: '+91-80-71222222',
  address: '258/A, Bommasandra Industrial Area, Anekal Taluk, Bengaluru, Karnataka',
  latitude: 12.8093,
  longitude: 77.6974,
  serviceTags: ['medicine', 'surgery', 'cardiology', 'neurology', 'orthopaedics', 'paediatrics', 'gynaecology', 'ent', 'dermatology', 'diagnostics', 'emergency', 'icu'],
  pricingTier: 2,
  acceptedInsurance: ['BlueCross', 'Star Health', 'Ayushman Bharat', 'UnitedHealth'],
  isActive: true,
};

const narayanaInventory: HospitalInventory = {
  hospitalId: narayanaHospital.id,
  icuBedsAvailable: 14,
  generalBedsAvailable: 45,
  cardiacBedsAvailable: 12,
  traumaBedsAvailable: 6,
  ambulancesAvailable: 5,
  totalAmbulanceFleet: 7,
  lastUpdatedAt: new Date(),
};

const tataHospital: Hospital = {
  id: 'hosp-tata-mumbai',
  name: 'Tata Memorial Hospital – Mumbai',
  licenseId: 'LIC-MH-00401',
  phoneNumber: '+91-22-24177000',
  address: 'Dr. Ernest Borges Road, Parel, Mumbai, Maharashtra',
  latitude: 19.0028,
  longitude: 72.8427,
  serviceTags: ['medicine', 'surgery', 'cardiology', 'neurology', 'orthopaedics', 'paediatrics', 'gynaecology', 'ent', 'dermatology', 'diagnostics', 'emergency', 'icu', 'oncology'],
  pricingTier: 1,
  acceptedInsurance: ['Ayushman Bharat', 'Government Schemes', 'BlueCross', 'Star Health'],
  isActive: true,
};

const tataInventory: HospitalInventory = {
  hospitalId: tataHospital.id,
  icuBedsAvailable: 18,
  generalBedsAvailable: 60,
  cardiacBedsAvailable: 8,
  traumaBedsAvailable: 10,
  ambulancesAvailable: 7,
  totalAmbulanceFleet: 10,
  lastUpdatedAt: new Date(),
};

hospitalMatchingService.registerHospital(aiimsHospital, aiimsInventory);
hospitalMatchingService.registerHospital(apolloHospital, apolloInventory);
hospitalMatchingService.registerHospital(fortisHospital, fortisInventory);
hospitalMatchingService.registerHospital(narayanaHospital, narayanaInventory);
hospitalMatchingService.registerHospital(tataHospital, tataInventory);

// Sync hospitals and bed inventories directly into Supabase
syncHospitalToSupabase(stJudeHospital, stJudeInventory);
syncHospitalToSupabase(mercyHospital, mercyInventory);
syncHospitalToSupabase(aiimsHospital, aiimsInventory);
syncHospitalToSupabase(apolloHospital, apolloInventory);
syncHospitalToSupabase(fortisHospital, fortisInventory);
syncHospitalToSupabase(narayanaHospital, narayanaInventory);
syncHospitalToSupabase(tataHospital, tataInventory);

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` EverHealth Monitoring Platform is live!`);
  console.log(` Local Dashboard & API: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
