import { describe, it, expect } from 'vitest';
import { healthRecommendationEngine } from '../../backend/src/services/health_recommendation';

describe('Health Recommendation Engine Unit Test', () => {
  it('should classify LOW risk for optimal vitals, high activity, and low stress', () => {
    const result = healthRecommendationEngine.predictRiskAndRecommend({
      heartRate: 72,
      spo2: 98.5,
      stressLevel: 25,
      activityMinutes: 45
    });

    expect(result.healthScore).toBeGreaterThanOrEqual(80);
    expect(result.riskLevel).toBe('LOW');
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('should classify HIGH or CRITICAL risk when SpO2 drops or HR spikes', () => {
    const result = healthRecommendationEngine.predictRiskAndRecommend({
      heartRate: 140,
      spo2: 89.0,
      stressLevel: 85,
      activityMinutes: 0
    });

    expect(result.healthScore).toBeLessThan(60);
    expect(result.riskLevel).toMatch(/HIGH|CRITICAL/);
    expect(result.recommendations.some(r => r.urgency === 'URGENT' || r.urgency === 'EMERGENCY')).toBe(true);
  });
});
