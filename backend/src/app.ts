import express, { Request, Response } from 'express';
import path from 'path';
import { vitalsIngestionService } from './services/vitals_ingestion';
import { alertService } from './services/alert_service';
import { hospitalMatchingService } from './services/hospital_matching';
import { bookingService } from './services/booking_service';
import { VitalReading, UserProfile, Severity, Hospital, HospitalInventory } from './types';
import { supabase } from './db/supabase_client';

const app = express();
app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), 'public')));

// In-Memory storage for fast caching
const usersDb = new Map<string, UserProfile>();

// Seed default mock user
const mockUser: UserProfile = {
  id: 'usr-101',
  fullName: 'Jane Doe',
  email: 'jane.doe@example.com',
  phoneNumber: '+1-555-0199',
  password: 'password123',
  dateOfBirth: '1985-04-12',
  bloodType: 'O+',
  allergies: ['Penicillin'],
  medications: ['Lisinopril'],
  medicalConditions: ['Hypertension'],
  emergencyContacts: [
    { name: 'John Doe', phone: '+1-555-0188', relationship: 'Spouse' }
  ],
  budgetCeiling: 40000.00,
  insuranceProvider: 'BlueCross',
  preferredHospitalIds: [],
  preferredHospitalTier: 'ANY',
  deviceTokens: ['fcm-token-123']
};
usersDb.set(mockUser.id, mockUser);

// --------------------------------------------------------
// SUPABASE DATABASE PERSISTENCE HELPERS
// --------------------------------------------------------
export async function syncUserToSupabase(user: UserProfile) {
  if (!supabase) return;
  try {
    await supabase.from('users').upsert({
      user_code: user.id,
      full_name: user.fullName,
      email: user.email || `${user.id}@example.com`,
      phone_number: user.phoneNumber,
      blood_type: user.bloodType,
      allergies: user.allergies,
      medications: user.medications,
      medical_conditions: user.medicalConditions,
      budget_ceiling: user.budgetCeiling,
      insurance_provider: user.insuranceProvider,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_code' });
    console.log(`[Supabase DB Active Entry] Patient ${user.id} (${user.fullName}) persisted.`);
  } catch (err) {
    console.error(`[Supabase DB] Failed to save user:`, err);
  }
}

export async function syncHospitalToSupabase(hospital: Hospital, inventory?: HospitalInventory) {
  if (!supabase) return;
  try {
    const { data: hosp } = await supabase.from('hospitals').upsert({
      hospital_code: hospital.id,
      name: hospital.name,
      license_id: hospital.licenseId,
      address: hospital.address,
      latitude: hospital.latitude,
      longitude: hospital.longitude,
      pricing_tier: hospital.pricingTier,
      service_tags: hospital.serviceTags,
      accepted_insurance: hospital.acceptedInsurance,
      is_active: hospital.isActive
    }, { onConflict: 'hospital_code' }).select().single();

    if (hosp && inventory) {
      await supabase.from('hospital_inventory').upsert({
        hospital_id: hosp.id,
        icu_beds_available: inventory.icuBedsAvailable,
        general_beds_available: inventory.generalBedsAvailable,
        cardiac_beds_available: inventory.cardiacBedsAvailable,
        trauma_beds_available: inventory.traumaBedsAvailable,
        ambulances_available: inventory.ambulancesAvailable,
        total_ambulance_fleet: inventory.totalAmbulanceFleet,
        last_updated_at: new Date().toISOString()
      }, { onConflict: 'hospital_id' });
    }
    console.log(`[Supabase DB Active Entry] Hospital ${hospital.name} & Inventory persisted.`);
  } catch (err) {
    console.error(`[Supabase DB] Failed to save hospital:`, err);
  }
}

export async function syncVitalToSupabase(reading: VitalReading) {
  if (!supabase) return;
  try {
    const { data: u } = await supabase.from('users').select('id').eq('user_code', reading.userId).single();
    if (u) {
      await supabase.from('vital_readings').insert({
        user_id: u.id,
        heart_rate: reading.heartRate,
        spo2: reading.spo2,
        fall_detected: reading.fallDetected,
        source_device: reading.sourceDevice || 'Apple Watch'
      });
      console.log(`[Supabase DB Active Entry] Vital Reading (HR: ${reading.heartRate}, SpO2: ${reading.spo2}%) persisted.`);
    }
  } catch (err) {
    console.error(`[Supabase DB] Failed to save vital reading:`, err);
  }
}

export async function syncEmergencyEventToSupabase(userId: string, reason: string, severity: string, status: string = 'PENDING_USER_CONFIRMATION') {
  if (!supabase) return;
  try {
    const { data: u } = await supabase.from('users').select('id').eq('user_code', userId).single();
    if (u) {
      const { data: evt } = await supabase.from('emergency_events').insert({
        user_id: u.id,
        severity,
        status,
        trigger_reason: reason,
        countdown_seconds: 30
      }).select().single();
      console.log(`[Supabase DB Active Entry] Emergency Event persisted for patient ${userId}.`);
      return evt;
    }
  } catch (err) {
    console.error(`[Supabase DB] Failed to save emergency event:`, err);
  }
}

// Initial Sync for Mock Patient
syncUserToSupabase(mockUser);

// Wire Alert Service Timeout Event to Hospital Matching & Dispatch Engine
alertService.on('alert:timeout', async (event) => {
  console.log(`[HTTP App] Received alert timeout for event ${event.id}. Auto-executing hospital matching...`);
  const user = usersDb.get(event.userId) || mockUser;
  const userLocation = { latitude: 37.7749, longitude: -122.4194 };

  const matches = await hospitalMatchingService.findBestMatches(
    userLocation,
    user,
    event.severity
  );

  if (matches.length > 0) {
    event.matchedHospitalId = matches[0].hospital.id;
    await bookingService.initiateBookingCascade(event, matches);
  } else {
    console.error(`[HTTP App] Alert ${event.id}: No eligible hospital matches found nearby.`);
  }
});

/**
 * 0. User & Hospital Authentication (Login Check)
 * POST /v1/auth/login
 */
app.post('/v1/auth/login', (req: Request, res: Response) => {
  try {
    const { emailOrPhone, password, role } = req.body;
    if (!emailOrPhone || !password) {
      return res.status(400).json({ error: 'Please enter both your login ID (Email/Phone) and password.' });
    }

    const query = String(emailOrPhone).trim().toLowerCase();

    if (role === 'hospital') {
      const list = hospitalMatchingService.getAllHospitals();
      const match = list.find(item => 
        item.hospital.id.toLowerCase() === query ||
        item.hospital.licenseId.toLowerCase() === query ||
        item.hospital.name.toLowerCase().includes(query)
      );

      if (!match) {
        return res.status(401).json({ error: 'Hospital facility record not found in database. New hospital facilities must register first.' });
      }

      return res.status(200).json({ status: 'OK', role: 'hospital', hospital: match.hospital });
    }

    // Patient authentication against user database
    let foundUser: UserProfile | undefined;
    for (const u of usersDb.values()) {
      const userEmail = (u.email || '').trim().toLowerCase();
      const userPhone = (u.phoneNumber || '').replace(/[^0-9]/g, '');
      const cleanQuery = query.replace(/[^0-9]/g, '');

      if (
        u.id.toLowerCase() === query ||
        (userEmail && userEmail === query) ||
        (userPhone && cleanQuery && userPhone === cleanQuery)
      ) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      return res.status(401).json({ error: 'Account not found in database. New users must sign up first before logging in.' });
    }

    const storedPassword = foundUser.password || 'password123';
    if (storedPassword !== password) {
      return res.status(401).json({ error: 'Incorrect password. Login failed.' });
    }

    // Omit password from response
    const { password: _, ...safeUser } = foundUser;
    return res.status(200).json({ status: 'OK', role: 'patient', user: safeUser });
  } catch (err: any) {
    console.error('Login authentication error:', err);
    return res.status(500).json({ error: 'Internal server authentication error' });
  }
});

/**
 * Google Fit Smartwatch Integration Endpoint
 * POST /v1/integrations/google-fit/sync
 */
app.post('/v1/integrations/google-fit/sync', async (req: Request, res: Response) => {
  try {
    const { userId, heartRate, spo2, deviceName } = req.body;
    const targetUserId = userId || mockUser.id;

    const hrVal = Number(heartRate !== undefined ? heartRate : 72);
    const spo2Val = Number(spo2 !== undefined ? spo2 : 98.2);

    const isFallDetected = (hrVal >= 160 || hrVal <= 38 || spo2Val < 88);

    const reading: VitalReading = {
      userId: targetUserId,
      timestamp: new Date(),
      heartRate: hrVal,
      spo2: spo2Val,
      fallDetected: isFallDetected,
      sourceDevice: deviceName || 'Google Fit Wear OS Smartwatch'
    };

    const result = await vitalsIngestionService.ingestReading(reading);
    syncVitalToSupabase(reading);

    if (result.detectionResult.isEmergency) {
      const alert = await alertService.triggerAlert(
        targetUserId,
        reading,
        `[Google Fit Telemetry] ${result.detectionResult.reason}`,
        result.detectionResult.severity
      );
      syncEmergencyEventToSupabase(targetUserId, result.detectionResult.reason, result.detectionResult.severity);

      return res.status(200).json({
        status: 'ANOMALY_DETECTED',
        source: 'Google Fit API',
        reading,
        detection: result.detectionResult,
        alert
      });
    }

    return res.status(200).json({
      status: 'OK',
      source: 'Google Fit API',
      reading,
      detection: result.detectionResult
    });
  } catch (err: any) {
    console.error('Error syncing Google Fit telemetry:', err);
    return res.status(500).json({ error: 'Failed to process Google Fit watch sync' });
  }
});

/**
 * 1. Stream continuous vitals
 * POST /v1/vitals/stream
 */
app.post('/v1/vitals/stream', async (req: Request, res: Response) => {
  const reading: VitalReading = req.body;
  if (!reading.userId || reading.heartRate === undefined || reading.spo2 === undefined) {
    return res.status(400).json({ error: 'Invalid vital reading payload' });
  }

  const result = await vitalsIngestionService.ingestReading(reading);

  // Sync active reading to Supabase database
  syncVitalToSupabase(reading);

  // Auto-trigger alert if anomaly detected
  if (result.detectionResult.isEmergency) {
    const alert = await alertService.triggerAlert(
      reading.userId,
      reading,
      result.detectionResult.reason,
      result.detectionResult.severity
    );
    syncEmergencyEventToSupabase(reading.userId, result.detectionResult.reason, result.detectionResult.severity);

    return res.status(200).json({
      status: 'ANOMALY_DETECTED',
      detection: result.detectionResult,
      alert,
    });
  }

  return res.status(200).json({
    status: 'OK',
    detection: result.detectionResult,
  });
});

/**
 * 2. Create emergency alert
 * POST /v1/emergency/alerts
 */
app.post('/v1/emergency/alerts', async (req: Request, res: Response) => {
  const { userId, vitals, reason, severity, countdownSeconds } = req.body;
  if (!userId || !vitals) {
    return res.status(400).json({ error: 'Missing userId or vitals in alert request' });
  }

  const event = await alertService.triggerAlert(
    userId,
    vitals,
    reason || 'Manual emergency alert trigger',
    (severity as Severity) || 'SEVERE',
    countdownSeconds || 30
  );

  syncEmergencyEventToSupabase(userId, reason || 'Manual alert', severity || 'SEVERE');

  return res.status(201).json({ event });
});

/**
 * 3. Cancel alert within 30-second window
 * POST /v1/emergency/alerts/:id/cancel
 */
app.post('/v1/emergency/alerts/:id/cancel', async (req: Request, res: Response) => {
  const alertId = req.params.id;
  const { reason } = req.body;

  const event = await alertService.cancelAlert(alertId, reason || 'Cancelled by user tap');
  if (!event) {
    return res.status(404).json({ error: 'Alert event not found or expired' });
  }

  return res.status(200).json({ event });
});

/**
 * 4. Spatial Hospital Matching query
 * GET /v1/hospitals/nearby
 */
app.get('/v1/hospitals/nearby', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string) || 37.7749;
    const lng = parseFloat(req.query.lng as string) || -122.4194;
    const userId = (req.query.userId as string) || mockUser.id;
    const severity = ((req.query.severity as string) || 'SEVERE') as Severity;

    const baseUser = usersDb.get(userId) || mockUser;
    const budgetCeiling = req.query.budgetCeiling !== undefined ? Number(req.query.budgetCeiling) : baseUser.budgetCeiling;
    const insuranceProvider = (req.query.insuranceProvider as string) || baseUser.insuranceProvider;

    const userProfile: UserProfile = {
      ...baseUser,
      budgetCeiling,
      insuranceProvider,
    };

    const requiredServices = req.query.requiredServices ? (req.query.requiredServices as string).split(',').map(s => s.trim()) : [];

    const matches = await hospitalMatchingService.findBestMatches(
      { latitude: lat, longitude: lng },
      userProfile,
      severity,
      requiredServices
    );

    return res.status(200).json({ count: matches.length, matches });
  } catch (err: any) {
    console.error('Error fetching hospital matches:', err);
    return res.status(500).json({ error: err.message || 'Error processing hospital matching' });
  }
});

/**
 * 5. Update Hospital Bed & Fleet Inventory
 * PUT /v1/hospitals/:id/inventory
 */
app.put('/v1/hospitals/:id/inventory', async (req: Request, res: Response) => {
  const hospitalId = req.params.id;
  const updated = hospitalMatchingService.updateInventory(hospitalId, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Hospital inventory not found' });
  }

  const h = hospitalMatchingService.getHospital(hospitalId);
  if (h) syncHospitalToSupabase(h, updated);

  return res.status(200).json({ inventory: updated });
});

/**
 * Update Hospital Services Offered
 * PUT /v1/hospitals/:id/services
 */
app.put('/v1/hospitals/:id/services', async (req: Request, res: Response) => {
  const hospitalId = req.params.id;
  const { serviceTags } = req.body;
  if (!Array.isArray(serviceTags)) {
    return res.status(400).json({ error: 'serviceTags must be an array of strings' });
  }
  const updated = hospitalMatchingService.updateServices(hospitalId, serviceTags);
  if (!updated) {
    return res.status(404).json({ error: 'Hospital not found' });
  }

  const inv = hospitalMatchingService.getInventory(hospitalId);
  syncHospitalToSupabase(updated, inv);

  return res.status(200).json({ hospital: updated });
});

/**
 * Get all Hospitals
 * GET /v1/hospitals
 */
app.get('/v1/hospitals', (req: Request, res: Response) => {
  const list = hospitalMatchingService.getAllHospitals();
  return res.status(200).json({ count: list.length, list });
});

/**
 * Register New Hospital
 * POST /v1/hospitals
 */
app.post('/v1/hospitals', async (req: Request, res: Response) => {
  const { hospital, inventory } = req.body;
  if (!hospital || !hospital.id || !hospital.name) {
    return res.status(400).json({ error: 'Invalid hospital registration payload' });
  }
  const inv = inventory || {
    hospitalId: hospital.id,
    icuBedsAvailable: 5,
    generalBedsAvailable: 15,
    cardiacBedsAvailable: 3,
    traumaBedsAvailable: 4,
    ambulancesAvailable: 2,
    totalAmbulanceFleet: 4,
    lastUpdatedAt: new Date(),
  };
  hospitalMatchingService.registerHospital(hospital, inv);

  // Sync to Supabase active database
  syncHospitalToSupabase(hospital, inv);

  return res.status(201).json({ hospital, inventory: inv });
});

/**
 * Get User Profile
 * GET /v1/users/:id
 */
app.get('/v1/users/:id', (req: Request, res: Response) => {
  const userId = req.params.id;
  const user = usersDb.get(userId) || mockUser;
  return res.status(200).json({ user });
});

/**
 * Update User Profile / Budget Ceiling
 * PUT /v1/users/:id
 */
app.put('/v1/users/:id', async (req: Request, res: Response) => {
  const userId = req.params.id;
  const existing = usersDb.get(userId) || mockUser;
  const updated: UserProfile = {
    ...existing,
    ...req.body,
    budgetCeiling: req.body.budgetCeiling !== undefined ? Number(req.body.budgetCeiling) : existing.budgetCeiling,
  };
  usersDb.set(userId, updated);

  // Sync active user to Supabase
  syncUserToSupabase(updated);

  return res.status(200).json({ user: updated });
});

/**
 * Register New Patient User
 * POST /v1/users
 */
app.post('/v1/users', async (req: Request, res: Response) => {
  const user: UserProfile = {
    id: req.body.id || `usr-${Date.now()}`,
    fullName: req.body.fullName || 'Anonymous Patient',
    email: req.body.email ? req.body.email.trim().toLowerCase() : '',
    phoneNumber: req.body.phoneNumber || '',
    password: req.body.password || 'password123',
    dateOfBirth: req.body.dateOfBirth || '1990-01-01',
    bloodType: req.body.bloodType || 'O+',
    allergies: req.body.allergies || [],
    medications: req.body.medications || [],
    medicalConditions: req.body.medicalConditions || [],
    emergencyContacts: req.body.emergencyContacts || [],
    budgetCeiling: Number(req.body.budgetCeiling) || 40000.00,
    insuranceProvider: req.body.insuranceProvider || 'BlueCross',
    preferredHospitalIds: [],
    preferredHospitalTier: req.body.preferredHospitalTier || 'ANY',
    deviceTokens: ['fcm-token-demo']
  };
  usersDb.set(user.id, user);

  // Sync active user registration to Supabase database
  syncUserToSupabase(user);

  return res.status(201).json({ user });
});

/**
 * 6. Hospital Accept / Reject / Update Booking
 * PATCH /v1/bookings/:id
 */
app.patch('/v1/bookings/:id', async (req: Request, res: Response) => {
  const bookingId = req.params.id;
  const { status } = req.body;

  const booking = await bookingService.updateBookingStatus(bookingId, status);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  return res.status(200).json({ booking });
});

// HTML fallback for SPA client routes (/login, /signup, /user-dashboard, /hospital-dashboard)
app.get(['/login', '/signup', '/user-dashboard', '/hospital-dashboard'], (req: Request, res: Response) => {
  res.sendFile(path.resolve(process.cwd(), 'public', 'index.html'));
});

export { app, usersDb };
