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

  it('should adjust daily fitness targets based on risk level', () => {
    const lowRiskResult = healthRecommendationEngine.predictRiskAndRecommend({
      heartRate: 70,
      spo2: 99.0,
      stressLevel: 20,
      activityMinutes: 45
    });

    const highRiskResult = healthRecommendationEngine.predictRiskAndRecommend({
      heartRate: 115,
      spo2: 91.0,
      stressLevel: 80,
      activityMinutes: 10
    });

    expect(lowRiskResult.fitnessTargets.stepTarget).toBeGreaterThan(highRiskResult.fitnessTargets.stepTarget);
    expect(lowRiskResult.fitnessTargets.activeMinutesTarget).toBeGreaterThan(highRiskResult.fitnessTargets.activeMinutesTarget);
    expect(highRiskResult.fitnessTargets.sleepHours).toBeGreaterThanOrEqual(lowRiskResult.fitnessTargets.sleepHours);
  });

  it('should generate a tailored recovery plan with action steps', () => {
    const result = healthRecommendationEngine.predictRiskAndRecommend({
      heartRate: 88,
      spo2: 95.0,
      stressLevel: 65,
      activityMinutes: 20
    });

    expect(result.recoveryPlan).toBeDefined();
    expect(result.recoveryPlan.steps.length).toBeGreaterThan(0);
    expect(result.recoveryPlan.title).toContain('Plan');
  });
});
