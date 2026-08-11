-- Emergency Health Monitoring & Dispatch Platform Database Schema
-- Compatible with PostgreSQL 14+, PostGIS, and TimescaleDB extension

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20),
    blood_type VARCHAR(10),
    allergies TEXT[],
    medications TEXT[],
    medical_conditions TEXT[],
    emergency_contacts JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {name, phone, relationship}
    budget_ceiling NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
    insurance_provider VARCHAR(255),
    insurance_policy_number VARCHAR(100),
    preferred_hospital_ids UUID[] DEFAULT '{}',
    preferred_hospital_tier VARCHAR(50) DEFAULT 'ANY', -- 'STANDARD', 'PREMIUM', 'ANY'
    device_tokens TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Baseline Profile Table (Personalized vital baselines)
CREATE TABLE IF NOT EXISTS baseline_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    resting_hr_min SMALLINT NOT NULL DEFAULT 60,
    resting_hr_max SMALLINT NOT NULL DEFAULT 90,
    spo2_floor NUMERIC(4, 1) NOT NULL DEFAULT 95.0,
    hrv_baseline SMALLINT DEFAULT 50,
    age_adjusted_hr_ceiling SMALLINT DEFAULT 170,
    last_recalculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Vitals Readings (Time-series data store)
CREATE TABLE IF NOT EXISTS vitals_readings (
    id UUID DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    heart_rate SMALLINT NOT NULL,
    spo2 NUMERIC(4, 1) NOT NULL,
    pulse SMALLINT,
    ecg_snippet JSONB,
    temperature NUMERIC(4, 1),
    fall_detected BOOLEAN NOT NULL DEFAULT FALSE,
    source_device VARCHAR(100) NOT NULL DEFAULT 'UNKNOWN',
    PRIMARY KEY (user_id, timestamp)
);

-- Create index for time-series queries
CREATE INDEX IF NOT EXISTS idx_vitals_user_time ON vitals_readings (user_id, timestamp DESC);

-- 4. Hospital Profile Table
CREATE TABLE IF NOT EXISTS hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    license_id VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL, -- Lat/Lng geo point
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    service_tags TEXT[] NOT NULL DEFAULT '{}', -- e.g., ['cardiac', 'trauma', 'icu', 'pediatric']
    pricing_tier SMALLINT NOT NULL DEFAULT 1, -- 1: Budget, 2: Standard, 3: Premium
    accepted_insurance TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index for hospital geo-queries
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals USING GIST (location);

-- 5. Hospital Inventory Table (Live bed & fleet status)
CREATE TABLE IF NOT EXISTS hospital_inventories (
    hospital_id UUID PRIMARY KEY REFERENCES hospitals(id) ON DELETE CASCADE,
    icu_beds_available INT NOT NULL DEFAULT 0,
    general_beds_available INT NOT NULL DEFAULT 0,
    cardiac_beds_available INT NOT NULL DEFAULT 0,
    trauma_beds_available INT NOT NULL DEFAULT 0,
    ambulances_available INT NOT NULL DEFAULT 0,
    total_ambulance_fleet INT NOT NULL DEFAULT 0,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Emergency Event Table
CREATE TABLE IF NOT EXISTS emergency_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trigger_vitals JSONB NOT NULL,
    detection_reason TEXT NOT NULL,
    severity VARCHAR(30) NOT NULL DEFAULT 'MODERATE', -- 'MODERATE', 'SEVERE', 'LIFE_THREATENING'
    status VARCHAR(30) NOT NULL DEFAULT 'TRIGGERED', -- 'TRIGGERED', 'COUNTDOWN_ACTIVE', 'CANCELLED_BY_USER', 'TIMEOUT_DISPATCHED', 'RESOLVED'
    alert_fired_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    matched_hospital_id UUID REFERENCES hospitals(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Booking Table (Hospital & Ambulance Dispatch Request)
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES emergency_events(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES hospitals(id),
    ambulance_id VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED', -- 'REQUESTED', 'ACCEPTED', 'REJECTED', 'EN_ROUTE', 'ARRIVED', 'CLOSED'
    eta_minutes INT,
    sla_expires_at TIMESTAMPTZ NOT NULL,
    dispatch_cost_estimate NUMERIC(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for status lookups
CREATE INDEX IF NOT EXISTS idx_events_user_status ON emergency_events (user_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings (event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_hospital_status ON bookings (hospital_id, status);
