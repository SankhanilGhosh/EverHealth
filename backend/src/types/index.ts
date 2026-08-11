export type Severity = 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';

export type EventStatus =
  | 'TRIGGERED'
  | 'COUNTDOWN_ACTIVE'
  | 'CANCELLED_BY_USER'
  | 'TIMEOUT_DISPATCHED'
  | 'RESOLVED';

export type BookingStatus =
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'CLOSED';

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender?: string;
  bloodType?: string;
  allergies: string[];
  medications: string[];
  medicalConditions: string[];
  emergencyContacts: EmergencyContact[];
  budgetCeiling: number;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  preferredHospitalIds: string[];
  preferredHospitalTier: 'STANDARD' | 'PREMIUM' | 'ANY';
  deviceTokens: string[];
  password?: string;
}

export interface BaselineProfile {
  userId: string;
  restingHrMin: number;
  restingHrMax: number;
  spo2Floor: number;
  hrvBaseline: number;
  ageAdjustedHrCeiling: number;
  lastRecalculatedAt: Date;
}

export interface VitalReading {
  id?: string;
  userId: string;
  timestamp: Date;
  heartRate: number;
  spo2: number;
  pulse?: number;
  ecgSnippet?: Record<string, any>;
  temperature?: number;
  fallDetected: boolean;
  sourceDevice: string;
}

export interface Hospital {
  id: string;
  name: string;
  licenseId: string;
  phoneNumber: string;
  address: string;
  latitude: number;
  longitude: number;
  serviceTags: string[]; // e.g. ['cardiac', 'trauma', 'icu', 'pediatric']
  pricingTier: number; // 1 (Budget), 2 (Standard), 3 (Premium)
  acceptedInsurance: string[];
  isActive: boolean;
}

export interface HospitalInventory {
  hospitalId: string;
  icuBedsAvailable: number;
  generalBedsAvailable: number;
  cardiacBedsAvailable: number;
  traumaBedsAvailable: number;
  ambulancesAvailable: number;
  totalAmbulanceFleet: number;
  lastUpdatedAt: Date;
}

export interface EmergencyEvent {
  id: string;
  userId: string;
  triggerVitals: VitalReading | VitalReading[];
  detectionReason: string;
  severity: Severity;
  status: EventStatus;
  alertFiredAt: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  matchedHospitalId?: string;
  createdAt: Date;
}

export interface Booking {
  id: string;
  eventId: string;
  hospitalId: string;
  ambulanceId?: string;
  status: BookingStatus;
  etaMinutes?: number;
  slaExpiresAt: Date;
  dispatchCostEstimate?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface HospitalMatchResult {
  hospital: Hospital;
  inventory: HospitalInventory;
  etaMinutes: number;
  score: number;
  matchReasons: string[];
  isBudgetExceeded: boolean;
  budgetOverrideApplied: boolean;
}
