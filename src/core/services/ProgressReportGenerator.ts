/**
 * Domain Service: ProgressReportGenerator
 * Compiles deep audio-perceptual analytics, session evolution, and EQ band competencies.
 */

import { TrainingSession, ProgressReport } from '../entities/TrainingSession';

export interface GlobalUserAnalytics {
  totalSessionsCompleted: number;
  totalRoundsPlayed: number;
  overallAverageAccuracy: number;
  overallAverageDeviationHz: number;
  bestSessionAccuracy: number;
  mostAccurateBand: string;
  leastAccurateBand: string;
  historyTimeline: Array<{
    date: string;
    accuracy: number;
    avgDeviationHz: number;
    rounds: number;
  }>;
}

export class ProgressReportGenerator {
  /**
   * Generates a detailed report for a single session
   */
  static generateSessionReport(session: TrainingSession): ProgressReport {
    return session.generateProgressReport();
  }

  /**
   * Aggregates multiple past sessions into a global user profile
   */
  static compileGlobalAnalytics(sessions: TrainingSession[]): GlobalUserAnalytics {
    const completedSessions = sessions.filter(s => s.completedRoundsCount > 0);

    if (completedSessions.length === 0) {
      return {
        totalSessionsCompleted: 0,
        totalRoundsPlayed: 0,
        overallAverageAccuracy: 0,
        overallAverageDeviationHz: 0,
        bestSessionAccuracy: 0,
        mostAccurateBand: 'N/A',
        leastAccurateBand: 'N/A',
        historyTimeline: []
      };
    }

    let totalRounds = 0;
    let sumAccuracy = 0;
    let sumDeviationHz = 0;
    let bestAcc = 0;

    const timeline = completedSessions.map(s => {
      const acc = s.averageAccuracy;
      const dev = s.averageDeviationHz;
      const count = s.completedRoundsCount;

      totalRounds += count;
      sumAccuracy += acc * count;
      sumDeviationHz += dev * count;
      if (acc > bestAcc) bestAcc = acc;

      return {
        date: new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        accuracy: acc,
        avgDeviationHz: dev,
        rounds: count
      };
    });

    const overallAvgAcc = totalRounds > 0 ? Math.round((sumAccuracy / totalRounds) * 10) / 10 : 0;
    const overallAvgDev = totalRounds > 0 ? Math.round((sumDeviationHz / totalRounds) * 10) / 10 : 0;

    // Collect all completed rounds across sessions to determine band strengths
    const allRounds = completedSessions.flatMap(s => s.rounds.filter(r => r.completed));
    const bandMap: Record<string, { totalAcc: number; count: number; name: string }> = {};

    allRounds.forEach(r => {
      const band = r.targetFrequency.band;
      if (!bandMap[band.id]) {
        bandMap[band.id] = { totalAcc: 0, count: 0, name: band.nameEs };
      }
      bandMap[band.id].totalAcc += r.accuracyPercentage || 0;
      bandMap[band.id].count += 1;
    });

    const bandList = Object.values(bandMap).map(b => ({
      name: b.name,
      avg: b.count > 0 ? b.totalAcc / b.count : 0
    }));

    bandList.sort((a, b) => b.avg - a.avg);

    return {
      totalSessionsCompleted: completedSessions.length,
      totalRoundsPlayed: totalRounds,
      overallAverageAccuracy: overallAvgAcc,
      overallAverageDeviationHz: overallAvgDev,
      bestSessionAccuracy: Math.round(bestAcc * 10) / 10,
      mostAccurateBand: bandList.length > 0 ? `${bandList[0].name} (${Math.round(bandList[0].avg)}%)` : 'N/A',
      leastAccurateBand: bandList.length > 1 ? `${bandList[bandList.length - 1].name} (${Math.round(bandList[bandList.length - 1].avg)}%)` : 'N/A',
      historyTimeline: timeline
    };
  }
}
