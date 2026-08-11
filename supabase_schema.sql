-- ========================================================
-- EVERHEALTH EMERGENCY PLATFORM - SUPABASE DATABASE SCHEMA
-- PostgreSQL / Supabase Schema for Spatial Matching, Inventory & Vitals
-- ========================================================

-- Enable PostGIS extension for spatial geography queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------
-- 1. USERS TABLE (PATIENTS)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_code VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(50),
  date_of_birth DATE,
  blood_type VARCHAR(10) DEFAULT 'O+',
  allergies TEXT[] DEFAULT '{}',
  medications TEXT[] DEFAULT '{}',
  medical_conditions TEXT[] DEFAULT '{}',
  budget_ceiling NUMERIC(12,2) DEFAULT 40000.00, -- Maximum Hospital Budget in ₹ Rupees
  insurance_provider VARCHAR(100) DEFAULT 'BlueCross',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for User lookup
CREATE INDEX IF NOT EXISTS idx_users_user_code ON public.users(user_code);

-- --------------------------------------------------------
-- 2. HOSPITALS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  license_id VARCHAR(100) NOT NULL,
  accreditation_code VARCHAR(100) DEFAULT 'SMC-88921-X',
  phone_number VARCHAR(50),
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(Point, 4326),
  service_tags TEXT[] DEFAULT '{"cardiac","trauma","icu"}',
  pricing_tier INT DEFAULT 2, -- Tier 1 (₹15,000), Tier 2 (₹35,000), Tier 3 (₹60,000)
  accepted_insurance TEXT[] DEFAULT '{"BlueCross","UnitedHealth"}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spatial index for ultra-fast nearby geographic querying
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON public.hospitals USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_hospitals_code ON public.hospitals(hospital_code);

-- Trigger to keep PostGIS point location in sync with lat/lng
CREATE OR REPLACE FUNCTION update_hospital_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_hospital_location
BEFORE INSERT OR UPDATE ON public.hospitals
FOR EACH ROW EXECUTE FUNCTION update_hospital_location();

-- --------------------------------------------------------
-- 3. HOSPITAL INVENTORY TABLE (BED COUNTS & AMBULANCES)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hospital_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
  icu_beds_available INT DEFAULT 4,
  general_beds_available INT DEFAULT 12,
  cardiac_beds_available INT DEFAULT 2,
  trauma_beds_available INT DEFAULT 3,
  ambulances_available INT DEFAULT 3,
  total_ambulance_fleet INT DEFAULT 5,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_hospital_id ON public.hospital_inventory(hospital_id);

-- --------------------------------------------------------
-- 4. VITAL READINGS TABLE (WEARABLE STREAMING DATA)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vital_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  heart_rate INT NOT NULL,
  spo2 NUMERIC(4,1) NOT NULL,
  fall_detected BOOLEAN DEFAULT FALSE,
  source_device VARCHAR(100) DEFAULT 'Apple Watch',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vital_readings_user ON public.vital_readings(user_id, recorded_at DESC);

-- --------------------------------------------------------
-- 5. EMERGENCY EVENTS TABLE (DISPATCH ALERTS & SLA)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  severity VARCHAR(50) DEFAULT 'SEVERE', -- MODERATE | SEVERE | LIFE_THREATENING
  status VARCHAR(50) DEFAULT 'PENDING_USER_CONFIRMATION', -- PENDING_USER_CONFIRMATION | TIMEOUT_DISPATCHED | CANCELLED | DISPATCHED
  trigger_reason TEXT NOT NULL,
  countdown_seconds INT DEFAULT 30,
  matched_hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_emergency_events_user ON public.emergency_events(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_events_status ON public.emergency_events(status);

-- --------------------------------------------------------
-- 6. HOSPITAL BOOKINGS TABLE (DISPATCH HISTORY)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hospital_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  emergency_event_id UUID REFERENCES public.emergency_events(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'DISPATCH_REQUESTED', -- DISPATCH_REQUESTED | ACCEPTED | REJECTED | EXPIRED
  assigned_ambulance_id VARCHAR(50),
  eta_minutes INT DEFAULT 6,
  sla_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --------------------------------------------------------
-- SEED DATA (INITIAL DEMO HOSPITALS & PATIENT)
-- --------------------------------------------------------
INSERT INTO public.users (user_code, full_name, email, phone_number, budget_ceiling, insurance_provider)
VALUES 
('usr-101', 'Jane Doe', 'jane.doe@example.com', '+91 98765 43210', 40000.00, 'BlueCross')
ON CONFLICT (user_code) DO NOTHING;

INSERT INTO public.hospitals (hospital_code, name, license_id, phone_number, address, latitude, longitude, service_tags, pricing_tier, accepted_insurance)
VALUES 
('hosp-001', 'St. Jude Trauma & Cardiac Emergency Center', 'LIC-CA-94812', '+1-555-0190', '500 Medical Plaza, San Francisco, CA', 37.7749, -122.4194, '{"cardiac","trauma","icu","pediatric"}', 2, '{"BlueCross","UnitedHealth","Kaiser"}'),
('hosp-002', 'Mercy Regional Emergency Care', 'LIC-CA-94815', '+1-555-0195', '120 Mission St, San Francisco, CA', 37.7833, -122.4167, '{"general","icu"}', 1, '{"BlueCross"}')
ON CONFLICT (hospital_code) DO NOTHING;

-- Seed inventory linked to hospitals
INSERT INTO public.hospital_inventory (hospital_id, icu_beds_available, general_beds_available, cardiac_beds_available, trauma_beds_available, ambulances_available, total_ambulance_fleet)
SELECT id, 4, 12, 2, 3, 3, 5 FROM public.hospitals WHERE hospital_code = 'hosp-001'
ON CONFLICT (hospital_id) DO NOTHING;

INSERT INTO public.hospital_inventory (hospital_id, icu_beds_available, general_beds_available, cardiac_beds_available, trauma_beds_available, ambulances_available, total_ambulance_fleet)
SELECT id, 2, 8, 0, 1, 2, 3 FROM public.hospitals WHERE hospital_code = 'hosp-002'
ON CONFLICT (hospital_id) DO NOTHING;

-- --------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vital_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_bookings ENABLE ROW LEVEL SECURITY;

-- Public read policies for demo / anon access
CREATE POLICY "Allow public read access to users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public read access to hospitals" ON public.hospitals FOR SELECT USING (true);
CREATE POLICY "Allow public read access to hospital_inventory" ON public.hospital_inventory FOR SELECT USING (true);
CREATE POLICY "Allow public read access to emergency_events" ON public.emergency_events FOR SELECT USING (true);

-- Public write policies for emergency stream
CREATE POLICY "Allow insert/update to users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow insert/update to inventory" ON public.hospital_inventory FOR ALL USING (true);
CREATE POLICY "Allow insert to vital_readings" ON public.vital_readings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow insert/update to emergency_events" ON public.emergency_events FOR ALL USING (true);
CREATE POLICY "Allow insert/update to hospital_bookings" ON public.hospital_bookings FOR ALL USING (true);
