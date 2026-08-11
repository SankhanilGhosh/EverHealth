import { VitalReading, BaselineProfile, Severity } from '../types';

export interface DetectionResult {
  isEmergency: boolean;
  severity: Severity;
  reason: string;
}

export class AnomalyDetector {
  /**
   * Dual-layer anomaly detection pipeline:
   * Layer 1: Local / On-device rule-based thresholds
   * Layer 2: Personalized baseline & sliding-window trend evaluation
   */
  public evaluateReading(
    reading: VitalReading,
    baseline?: BaselineProfile,
    recentHistory: VitalReading[] = []
  ): DetectionResult {
    // 1. Fall Detection - Immediate Critical Override
    if (reading.fallDetected) {
      return {
        isEmergency: true,
        severity: 'LIFE_THREATENING',
        reason: 'Hard impact / fall detected with potential unconsciousness',
      };
    }

    // 2. Fixed Threshold Checks (Layer 1)
    if (reading.spo2 > 0 && reading.spo2 < 88.0) {
      return {
        isEmergency: true,
        severity: 'LIFE_THREATENING',
        reason: `Critically low oxygen saturation (SpO2: ${reading.spo2}%)`,
      };
    }

    if (reading.heartRate >= 160) {
      return {
        isEmergency: true,
        severity: 'SEVERE',
        reason: `Severe tachycardia detected (Heart Rate: ${reading.heartRate} bpm)`,
      };
    }

    if (reading.heartRate > 0 && reading.heartRate <= 38) {
      return {
        isEmergency: true,
        severity: 'LIFE_THREATENING',
        reason: `Critical bradycardia detected (Heart Rate: ${reading.heartRate} bpm)`,
      };
    }

    // 3. Personalized Baseline Evaluation (Layer 2)
    if (baseline) {
      // Check relative SpO2 drop below user's personal floor
      if (reading.spo2 > 0 && reading.spo2 < baseline.spo2Floor) {
        return {
          isEmergency: true,
          severity: reading.spo2 < baseline.spo2Floor - 4 ? 'LIFE_THREATENING' : 'SEVERE',
          reason: `SpO2 level (${reading.spo2}%) dropped below personal baseline floor (${baseline.spo2Floor}%)`,
        };
      }

      // Check sustained HR deviation from personal resting ceiling
      if (reading.heartRate > baseline.restingHrMax + 35) {
        return {
          isEmergency: true,
          severity: 'MODERATE',
          reason: `Elevated heart rate (${reading.heartRate} bpm) significantly exceeds personal baseline max (${baseline.restingHrMax} bpm)`,
        };
      }
    }

    // 4. Rate of Decline / Sliding Window Trend Analysis
    if (recentHistory.length >= 3) {
      const oldest = recentHistory[recentHistory.length - 1];
      const spo2Drop = oldest.spo2 - reading.spo2;

      // SpO2 dropped rapidly over last N samples
      if (spo2Drop >= 4.0 && reading.spo2 <= 92.0) {
        return {
          isEmergency: true,
          severity: 'LIFE_THREATENING',
          reason: `Rapid oxygen drop detected (${spo2Drop.toFixed(1)}% decline in recent window)`,
        };
      }

      // Sustained combined risk: HR spike + SpO2 drop
      const hrRise = reading.heartRate - oldest.heartRate;
      if (hrRise >= 25 && spo2Drop >= 2.5) {
        return {
          isEmergency: true,
          severity: 'SEVERE',
          reason: `Multi-vital alert: HR increased by ${hrRise} bpm while SpO2 fell by ${spo2Drop.toFixed(1)}%`,
        };
      }
    }

    return {
      isEmergency: false,
      severity: 'MODERATE',
      reason: 'Vitals within normal limits',
    };
  }
}

export const anomalyDetector = new AnomalyDetector();
