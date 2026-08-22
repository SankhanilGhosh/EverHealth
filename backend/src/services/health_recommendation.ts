import { UserProfile } from '../types';

export interface HealthPredictorInput {
  heartRate: number;
  spo2: number;
  stressLevel: number; // 1 - 100
  activityMinutes: number; // daily activity minutes
  userProfile?: UserProfile;
}

export interface RecommendationItem {
  category: 'CARDIOVASCULAR' | 'RESPIRATORY' | 'STRESS_MENTAL' | 'ACTIVITY_FITNESS' | 'DIET_HOUSEHOLD';
  title: string;
  advice: string;
  urgency: 'ROUTINE' | 'MODERATE' | 'URGENT' | 'EMERGENCY';
}

export interface FitnessTarget {
  stepTarget: number;
  activeMinutesTarget: number;
  hydrationLiters: number;
  sleepHours: number;
  targetHrZone: string;
  adjustmentReason: string;
  modeLabel: string;
}

export interface RecoveryPlanStep {
  id: string;
  title: string;
  category: 'VITALS' | 'NUTRITION' | 'MOBILITY' | 'REST' | 'CLINICAL';
  description: string;
  completed: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RecoveryPlan {
  title: string;
  summary: string;
  steps: RecoveryPlanStep[];
}

export interface HealthPredictionResult {
  healthScore: number; // 0 - 100
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  statusSummary: string;
  breakdown: {
    heartRateScore: number;
    spo2Score: number;
    stressScore: number;
    activityScore: number;
  };
  recommendations: RecommendationItem[];
  fitnessTargets: FitnessTarget;
  recoveryPlan: RecoveryPlan;
  evaluatedAt: Date;
}

export class HealthRecommendationEngine {
  /**
   * Predict Health Risk Level, Calculate Health Score, and Generate AI Health Recommendations,
   * Daily Fitness Targets, and Recovery Plans.
   */
  public predictRiskAndRecommend(input: HealthPredictorInput): HealthPredictionResult {
    const hr = Number(input.heartRate) || 72;
    const spo2 = Number(input.spo2) || 98;
    const stress = Number(input.stressLevel) || 30;
    const activity = Number(input.activityMinutes) || 30;

    // 1. Calculate Heart Rate Score (max 30 pts)
    let hrScore = 0;
    if (hr >= 60 && hr <= 80) hrScore = 30;
    else if ((hr >= 50 && hr < 60) || (hr > 80 && hr <= 90)) hrScore = 22;
    else if ((hr >= 40 && hr < 50) || (hr > 90 && hr <= 110)) hrScore = 12;
    else hrScore = 0; // Extreme bradycardia or tachycardia

    // 2. Calculate SpO2 Score (max 30 pts)
    let spo2Score = 0;
    if (spo2 >= 97) spo2Score = 30;
    else if (spo2 >= 94) spo2Score = 20;
    else if (spo2 >= 90) spo2Score = 10;
    else spo2Score = 0; // Hypoxia emergency

    // 3. Calculate Stress Score (max 20 pts)
    let stressScore = 0;
    if (stress <= 30) stressScore = 20;
    else if (stress <= 60) stressScore = 14;
    else if (stress <= 80) stressScore = 7;
    else stressScore = 0;

    // 4. Calculate Activity Score (max 20 pts)
    let activityScore = 0;
    if (activity >= 30) activityScore = 20;
    else if (activity >= 15) activityScore = 14;
    else if (activity >= 5) activityScore = 7;
    else activityScore = 2;

    const totalHealthScore = Math.min(100, Math.max(0, hrScore + spo2Score + stressScore + activityScore));

    // 5. Determine Risk Level
    let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
    let statusSummary = '';

    if (totalHealthScore >= 80 && spo2 >= 95 && hr >= 50 && hr <= 100) {
      riskLevel = 'LOW';
      statusSummary = 'Excellent physiological baseline with optimal vital stability.';
    } else if (totalHealthScore >= 65 && spo2 >= 92) {
      riskLevel = 'MODERATE';
      statusSummary = 'Mild vital deviation or elevated stress detected. Targeted lifestyle adjustments recommended.';
    } else if (totalHealthScore >= 45 || spo2 < 92 || hr > 120 || hr < 45) {
      riskLevel = 'HIGH';
      statusSummary = 'Elevated health risk! Notable oxygen drop, tachycardia, or chronic stress detected.';
    } else {
      riskLevel = 'CRITICAL';
      statusSummary = 'Critical risk level! Immediate medical attention or emergency evaluation advised.';
    }

    // 6. Generate Tailored Recommendations
    const recommendations: RecommendationItem[] = [];

    // Heart Rate Guidance
    if (hr > 90) {
      recommendations.push({
        category: 'CARDIOVASCULAR',
        title: 'High Resting Heart Rate (Tachycardia Warning)',
        advice: 'Reduce caffeine and stimulant intake. Drink 500ml electrolyte water and practice slow rhythmic breathing. Schedule an ECG if elevated HR persists.',
        urgency: hr > 120 ? 'URGENT' : 'MODERATE'
      });
    } else if (hr < 50) {
      recommendations.push({
        category: 'CARDIOVASCULAR',
        title: 'Low Heart Rate (Bradycardia Monitor)',
        advice: 'If not a trained athlete, monitor for dizziness or fatigue. Ensure proper thyroid and electrolyte levels are checked.',
        urgency: 'MODERATE'
      });
    } else {
      recommendations.push({
        category: 'CARDIOVASCULAR',
        title: 'Heart Rate in Optimal Zone',
        advice: 'Your resting heart rate is in a healthy range. Maintain consistent aerobic exercise to preserve cardiovascular endurance.',
        urgency: 'ROUTINE'
      });
    }

    // SpO2 Oxygen Guidance
    if (spo2 < 94) {
      recommendations.push({
        category: 'RESPIRATORY',
        title: 'Low Blood Oxygen Saturation (SpO2 Warning)',
        advice: 'Perform deep diaphragmatic lung expansion exercises. Sit upright in a well-ventilated space. Seek medical evaluation if SpO2 remains below 92%.',
        urgency: spo2 < 90 ? 'EMERGENCY' : 'URGENT'
      });
    } else {
      recommendations.push({
        category: 'RESPIRATORY',
        title: 'Optimal Tissue Oxygenation',
        advice: 'Blood oxygen saturation is excellent. Practice daily 4-7-8 breathing exercises to optimize lung vital capacity.',
        urgency: 'ROUTINE'
      });
    }

    // Stress Management
    if (stress > 60) {
      recommendations.push({
        category: 'STRESS_MENTAL',
        title: 'Elevated Cortisol & Stress Level',
        advice: 'High stress impacts heart rate variability and blood pressure. Take a 15-minute screen-free break, practice mindfulness meditation, and aim for 7.5+ hours of sleep.',
        urgency: stress > 80 ? 'URGENT' : 'MODERATE'
      });
    } else {
      recommendations.push({
        category: 'STRESS_MENTAL',
        title: 'Healthy Stress Recovery State',
        advice: 'Stress level is well-managed. Continue regular relaxation routines and balanced sleep hygiene.',
        urgency: 'ROUTINE'
      });
    }

    // Activity Guidance
    if (activity < 30) {
      recommendations.push({
        category: 'ACTIVITY_FITNESS',
        title: 'Increase Daily Active Movement',
        advice: `You recorded ${activity} active minutes today. Aim for at least 30 minutes of moderate activity (e.g. brisk walking, cycling, yoga) to boost metabolic health.`,
        urgency: 'MODERATE'
      });
    } else {
      recommendations.push({
        category: 'ACTIVITY_FITNESS',
        title: 'Great Physical Activity Volume',
        advice: `You completed ${activity} active minutes! Excellent work staying active. Ensure adequate hydration and post-workout protein intake.`,
        urgency: 'ROUTINE'
      });
    }

    // Household Dietary / Medical Conditions Integration
    if (input.userProfile && input.userProfile.medicalConditions && input.userProfile.medicalConditions.length > 0) {
      const conds = input.userProfile.medicalConditions.map((c: string) => c.toLowerCase());
      if (conds.some((c: string) => c.includes('diabet'))) {
        recommendations.push({
          category: 'DIET_HOUSEHOLD',
          title: 'Diabetic Household Protocol',
          advice: 'Maintain a low-glycemic index diet with fiber-rich whole grains. Monitor blood sugar post-meals and avoid refined sugars.',
          urgency: 'MODERATE'
        });
      }
      if (conds.some((c: string) => c.includes('hyper') || c.includes('bp') || c.includes('blood pressure'))) {
        recommendations.push({
          category: 'DIET_HOUSEHOLD',
          title: 'Hypertension Sodium Control Directive',
          advice: 'Limit sodium intake to under 2,000mg/day. Increase potassium-rich foods (bananas, spinach, coconut water) to regulate blood pressure.',
          urgency: 'MODERATE'
        });
      }
    }

    // 7. Calculate Dynamically Adjusted Fitness Targets
    const fitnessTargets: FitnessTarget = this.calculateFitnessTargets(totalHealthScore, riskLevel, hr, spo2, stress);

    // 8. Generate Personalized Recovery Plan
    const recoveryPlan: RecoveryPlan = this.generateRecoveryPlan(riskLevel, totalHealthScore, hr, spo2, stress, input.userProfile);

    return {
      healthScore: totalHealthScore,
      riskLevel,
      statusSummary,
      breakdown: {
        heartRateScore: hrScore,
        spo2Score: spo2Score,
        stressScore,
        activityScore
      },
      recommendations,
      fitnessTargets,
      recoveryPlan,
      evaluatedAt: new Date()
    };
  }

  private calculateFitnessTargets(score: number, riskLevel: string, hr: number, spo2: number, stress: number): FitnessTarget {
    if (riskLevel === 'LOW') {
      return {
        stepTarget: 10000,
        activeMinutesTarget: 45,
        hydrationLiters: 3.0,
        sleepHours: 8.0,
        targetHrZone: '110-140 BPM (Moderate Aerobic Target)',
        adjustmentReason: 'Optimal health score (80+). Full capacity active targets assigned to build cardiovascular resilience.',
        modeLabel: '⚡ Peak Performance Mode'
      };
    } else if (riskLevel === 'MODERATE') {
      return {
        stepTarget: 6000,
        activeMinutesTarget: 30,
        hydrationLiters: 3.2,
        sleepHours: 8.5,
        targetHrZone: '95-115 BPM (Light Aerobic & Mobility Target)',
        adjustmentReason: 'Moderate risk level. Activity intensity reduced by 33% and hydration increased to prevent fatigue and support recovery.',
        modeLabel: '🟡 Moderate Adaptation Mode'
      };
    } else if (riskLevel === 'HIGH') {
      return {
        stepTarget: 3000,
        activeMinutesTarget: 15,
        hydrationLiters: 3.5,
        sleepHours: 9.0,
        targetHrZone: 'Resting < 90 BPM (Gentle Movement Only)',
        adjustmentReason: 'High risk level detected! Physical load reduced by 70% and sleep allocation increased to stabilize vitals.',
        modeLabel: '🟠 Light Recovery & Rest Mode'
      };
    } else {
      return {
        stepTarget: 1000,
        activeMinutesTarget: 0,
        hydrationLiters: 3.5,
        sleepHours: 10.0,
        targetHrZone: 'Absolute Rest (< 80 BPM)',
        adjustmentReason: 'Critical health risk! All strenuous activity paused. Full clinical bed rest & monitoring active.',
        modeLabel: '🚨 Strict Clinical Rest Mode'
      };
    }
  }

  private generateRecoveryPlan(
    riskLevel: string,
    score: number,
    hr: number,
    spo2: number,
    stress: number,
    userProfile?: UserProfile
  ): RecoveryPlan {
    const steps: RecoveryPlanStep[] = [];

    if (riskLevel === 'LOW') {
      steps.push({
        id: 'rec-1',
        title: 'Aerobic Exercise Session',
        category: 'MOBILITY',
        description: 'Complete 45 minutes of brisk walking, jogging, or cycling keeping HR in 110-140 BPM range.',
        completed: false,
        priority: 'MEDIUM'
      });
      steps.push({
        id: 'rec-2',
        title: 'Optimal Hydration Routine',
        category: 'NUTRITION',
        description: 'Drink 3.0 Liters of water evenly spread across morning, afternoon, and post-workout.',
        completed: false,
        priority: 'LOW'
      });
      steps.push({
        id: 'rec-3',
        title: 'Post-Workout Mobility Stretch',
        category: 'MOBILITY',
        description: '10 minutes of hamstrings, hip flexors, and spinal decompression stretching.',
        completed: false,
        priority: 'LOW'
      });
      steps.push({
        id: 'rec-4',
        title: 'Circadian Sleep Hygiene',
        category: 'REST',
        description: 'Dim lights 30 minutes before bed; maintain a cool room (68°F/20°C) for 8 hours of sleep.',
        completed: false,
        priority: 'MEDIUM'
      });
    } else if (riskLevel === 'MODERATE') {
      steps.push({
        id: 'rec-1',
        title: 'Low-Impact Active Recovery Walk',
        category: 'MOBILITY',
        description: 'Take a 30-minute light walking session; avoid high-intensity sprinting or heavy lifting.',
        completed: false,
        priority: 'HIGH'
      });
      steps.push({
        id: 'rec-2',
        title: 'Vagus Nerve Diaphragmatic Breathing',
        category: 'REST',
        description: 'Perform 10 minutes of 4-7-8 breathing (4s inhale, 7s hold, 8s exhale) to calm nervous system.',
        completed: false,
        priority: 'HIGH'
      });
      steps.push({
        id: 'rec-3',
        title: 'Electrolyte Replenishment',
        category: 'NUTRITION',
        description: 'Consume 3.2L fluid intake including 1 glass of coconut water or sodium-potassium electrolyte.',
        completed: false,
        priority: 'MEDIUM'
      });
      steps.push({
        id: 'rec-4',
        title: 'Extended Evening Wind-Down',
        category: 'REST',
        description: 'Disconnect from work screens 1 hour before sleep; aim for 8.5 hours rest.',
        completed: false,
        priority: 'HIGH'
      });
    } else if (riskLevel === 'HIGH') {
      steps.push({
        id: 'rec-1',
        title: 'Vitals & Oxygenation Pacing',
        category: 'VITALS',
        description: 'Sit upright in an air-ventilated room. Measure SpO2 every 2 hours using smartwatch telemetry.',
        completed: false,
        priority: 'HIGH'
      });
      steps.push({
        id: 'rec-2',
        title: 'Gentle Indoor Mobility & Breathing',
        category: 'MOBILITY',
        description: '15 minutes of slow pacing indoors or seated chest-opening stretches.',
        completed: false,
        priority: 'MEDIUM'
      });
      steps.push({
        id: 'rec-3',
        title: 'High-Hydration & Cellular Recovery',
        category: 'NUTRITION',
        description: 'Sip 3.5L fluids with ORS (Oral Rehydration Solution) to maintain vascular volume.',
        completed: false,
        priority: 'HIGH'
      });
      steps.push({
        id: 'rec-4',
        title: 'Mandatory Rest & Sleep Extension',
        category: 'REST',
        description: 'Take two 30-minute daytime rest breaks and ensure 9 full hours of sleep tonight.',
        completed: false,
        priority: 'HIGH'
      });
    } else { // CRITICAL
      steps.push({
        id: 'rec-1',
        title: 'Strict Bed Rest Protocol',
        category: 'CLINICAL',
        description: 'Remain at rest in a comfortable semi-reclining position. Avoid any physical exertion.',
        completed: false,
        priority: 'HIGH'
      });
      steps.push({
        id: 'rec-2',
        title: 'Emergency SLA Dispatch Readiness',
        category: 'CLINICAL',
        description: 'Verify phone number and emergency contact (+91-98765-43210). 30s SLA auto-dispatch standing by.',
        completed: false,
        priority: 'HIGH'
      });
      steps.push({
        id: 'rec-3',
        title: 'Continuous Live Vitals Monitoring',
        category: 'VITALS',
        description: 'Keep NoiseFit watch connected for real-time heart rate & SpO2 anomaly telemetry streaming.',
        completed: false,
        priority: 'HIGH'
      });
    }

    // Add specialized pre-existing condition step if applicable
    if (userProfile && userProfile.medicalConditions && userProfile.medicalConditions.length > 0) {
      const conds = userProfile.medicalConditions.map((c: string) => c.toLowerCase());
      if (conds.some((c: string) => c.includes('diabet'))) {
        steps.push({
          id: 'rec-cond-diab',
          title: 'Diabetic Household Blood Sugar Check',
          category: 'CLINICAL',
          description: 'Log fasting and 2-hr postprandial glucose level. Keep quick-acting glucose glucose tabs ready.',
          completed: false,
          priority: 'HIGH'
        });
      }
      if (conds.some((c: string) => c.includes('hyper') || c.includes('bp') || c.includes('blood pressure'))) {
        steps.push({
          id: 'rec-cond-bp',
          title: 'Hypertension Blood Pressure Log',
          category: 'CLINICAL',
          description: 'Measure morning BP; strictly adhere to low sodium dietary ceiling (< 1500mg).',
          completed: false,
          priority: 'HIGH'
        });
      }
    }

    return {
      title: riskLevel === 'LOW' ? 'Peak Performance & Endurance Plan'
        : riskLevel === 'MODERATE' ? 'Active Recovery & Stress Mitigation Plan'
        : riskLevel === 'HIGH' ? 'Vitals Stabilization & Recovery Plan'
        : 'Urgent Clinical Rest & Emergency Protocol',
      summary: `Tailored recovery roadmap calibrated to your ${riskLevel} risk rating and predicted Health Score of ${score}/100.`,
      steps
    };
  }
}

export const healthRecommendationEngine = new HealthRecommendationEngine();

