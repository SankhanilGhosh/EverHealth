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
  evaluatedAt: Date;
}

export class HealthRecommendationEngine {
  /**
   * Predict Health Risk Level, Calculate Health Score, and Generate AI Health Recommendations
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
      const conds = input.userProfile.medicalConditions.map(c => c.toLowerCase());
      if (conds.some(c => c.includes('diabet'))) {
        recommendations.push({
          category: 'DIET_HOUSEHOLD',
          title: 'Diabetic Household Protocol',
          advice: 'Maintain a low-glycemic index diet with fiber-rich whole grains. Monitor blood sugar post-meals and avoid refined sugars.',
          urgency: 'MODERATE'
        });
      }
      if (conds.some(c => c.includes('hyper') || c.includes('bp') || c.includes('blood pressure'))) {
        recommendations.push({
          category: 'DIET_HOUSEHOLD',
          title: 'Hypertension Sodium Control Directive',
          advice: 'Limit sodium intake to under 2,000mg/day. Increase potassium-rich foods (bananas, spinach, coconut water) to regulate blood pressure.',
          urgency: 'MODERATE'
        });
      }
    }

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
      evaluatedAt: new Date()
    };
  }
}

export const healthRecommendationEngine = new HealthRecommendationEngine();
