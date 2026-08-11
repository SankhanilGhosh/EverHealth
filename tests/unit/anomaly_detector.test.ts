import { describe, it, expect } from 'vitest';
import { anomalyDetector } from '../../backend/src/services/anomaly_detector';
import { VitalReading, BaselineProfile } from '../../backend/src/types';

describe('AnomalyDetector Unit Tests', () => {
  it('should trigger LIFE_THREATENING emergency on fall detection', () => {
    const reading: VitalReading = {
      userId: 'u1',
      timestamp: new Date(),
      heartRate: 75,
      spo2: 98,
      fallDetected: true,
      sourceDevice: 'Watch',
    };

    const res = anomalyDetector.evaluateReading(reading);
    expect(res.isEmergency).toBe(true);
    expect(res.severity).toBe('LIFE_THREATENING');
    expect(res.reason).toContain('fall detected');
  });

  it('should trigger LIFE_THREATENING emergency on SpO2 drop < 88%', () => {
    const reading: VitalReading = {
      userId: 'u1',
      timestamp: new Date(),
      heartRate: 80,
      spo2: 85.5,
      fallDetected: false,
      sourceDevice: 'Watch',
    };

    const res = anomalyDetector.evaluateReading(reading);
    expect(res.isEmergency).toBe(true);
    expect(res.severity).toBe('LIFE_THREATENING');
  });

  it('should trigger personalized baseline SpO2 breach', () => {
    const reading: VitalReading = {
      userId: 'u1',
      timestamp: new Date(),
      heartRate: 72,
      spo2: 93.0,
      fallDetected: false,
      sourceDevice: 'Watch',
    };

    const baseline: BaselineProfile = {
      userId: 'u1',
      restingHrMin: 60,
      restingHrMax: 85,
      spo2Floor: 96.0,
      hrvBaseline: 50,
      ageAdjustedHrCeiling: 170,
      lastRecalculatedAt: new Date(),
    };

    const res = anomalyDetector.evaluateReading(reading, baseline);
    expect(res.isEmergency).toBe(true);
    expect(res.reason).toContain('personal baseline floor');
  });

  it('should return normal status for non-emergency vitals', () => {
    const reading: VitalReading = {
      userId: 'u1',
      timestamp: new Date(),
      heartRate: 72,
      spo2: 98.0,
      fallDetected: false,
      sourceDevice: 'Watch',
    };

    const res = anomalyDetector.evaluateReading(reading);
    expect(res.isEmergency).toBe(false);
  });
});
