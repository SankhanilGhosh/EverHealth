import { VitalReading, BaselineProfile } from '../types';
import { anomalyDetector, DetectionResult } from './anomaly_detector';

export class VitalsIngestionService {
  private vitalsHistory = new Map<string, VitalReading[]>();
  private userBaselines = new Map<string, BaselineProfile>();

  public setBaseline(userId: string, baseline: BaselineProfile): void {
    this.userBaselines.set(userId, baseline);
  }

  public getBaseline(userId: string): BaselineProfile | undefined {
    return this.userBaselines.get(userId);
  }

  public async ingestReading(reading: VitalReading): Promise<{
    reading: VitalReading;
    detectionResult: DetectionResult;
  }> {
    // 1. Save reading into user's time-series sliding window (keep last 20 readings)
    if (!this.vitalsHistory.has(reading.userId)) {
      this.vitalsHistory.set(reading.userId, []);
    }
    const history = this.vitalsHistory.get(reading.userId)!;
    history.unshift(reading);
    if (history.length > 20) {
      history.pop();
    }

    // 2. Retrieve baseline profile
    const baseline = this.userBaselines.get(reading.userId);

    // 3. Evaluate reading through Anomaly Detector
    const detectionResult = anomalyDetector.evaluateReading(reading, baseline, history);

    return { reading, detectionResult };
  }

  public getRecentReadings(userId: string, count: number = 10): VitalReading[] {
    return (this.vitalsHistory.get(userId) || []).slice(0, count);
  }

  public clearHistory(): void {
    this.vitalsHistory.clear();
    this.userBaselines.clear();
  }
}

export const vitalsIngestionService = new VitalsIngestionService();
