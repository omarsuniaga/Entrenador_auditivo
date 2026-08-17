/**
 * Infrastructure Adapter: PDFReportAdapter
 * Generates and downloads comprehensive PDF training reports with
 * acoustic diagnostics, accuracy metrics, frequency band mastery, and charts.
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ProgressReport } from '../../core/entities/TrainingSession';
import { DIFFICULTY_CONFIGS_20, DifficultyLevel } from '../../core/entities/DifficultyProfile';

export class PDFReportAdapter {
  /**
   * Generates and triggers download of a high-resolution PDF report
   * @param report The domain progress report object
   * @param elementToCapture Optional DOM element (for rendering interactive charts into PDF)
   */
  static async exportToPDF(report: ProgressReport, elementToCapture?: HTMLElement | null): Promise<void> {
    try {
      if (elementToCapture) {
        // If a visual DOM report container is available, capture it using html2canvas
        const canvas = await html2canvas(elementToCapture, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#05070a'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`AudioFit_Reporte_Sesion_${new Date(report.timestamp).toISOString().slice(0, 10)}.pdf`);
        return;
      }
    } catch (err) {
      console.warn('DOM capture failed, falling back to programmatic jsPDF generator:', err);
    }

    // Programmatic high-precision jsPDF generator
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const diffConfig = DIFFICULTY_CONFIGS_20[report.difficultyLevel as DifficultyLevel] || DIFFICULTY_CONFIGS_20[1];

    // Background
    doc.setFillColor(5, 7, 10);
    doc.rect(0, 0, 210, 297, 'F');

    // Header Card
    doc.setFillColor(10, 13, 20);
    doc.roundedRect(15, 15, 180, 38, 3, 3, 'F');
    doc.setDrawColor(6, 182, 212);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, 15, 180, 38, 3, 3, 'D');

    // Brand Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(6, 182, 212);
    doc.text('AUDIOFIT // INFORME DE ENTRENAMIENTO AUDITIVO', 20, 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(`ID de Sesión: ${report.sessionId}`, 20, 34);
    doc.text(`Fecha: ${new Date(report.timestamp).toLocaleString()}`, 20, 40);
    doc.text(`Dificultad: ${diffConfig.title} (Rango: ${diffConfig.minHz}-${diffConfig.maxHz} Hz, Tol: ±${diffConfig.toleranceHz}Hz)`, 20, 46);

    // KPI Metrics Section
    const startY = 60;
    const boxWidth = 42;
    const boxHeight = 24;

    const kpis = [
      { label: 'PRECISIÓN GLOBAL', val: `${report.overallAccuracy}%`, color: [6, 182, 212] },
      { label: 'DESVIACIÓN MEDIA', val: `±${report.overallAvgDeviationHz} Hz`, color: [168, 85, 247] },
      { label: 'DESVIACIÓN ESTÁNDAR', val: `±${report.standardDeviationHz} Hz`, color: [245, 158, 11] },
      { label: 'PUNTOS TOTALES', val: `${report.totalScore}/${report.maxPossibleScore}`, color: [16, 185, 129] }
    ];

    kpis.forEach((kpi, idx) => {
      const x = 15 + idx * (boxWidth + 4);
      doc.setFillColor(15, 20, 30);
      doc.roundedRect(x, startY, boxWidth, boxHeight, 2, 2, 'F');
      
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(kpi.label, x + 4, startY + 7);

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.text(kpi.val, x + 4, startY + 18);
    });

    // Band Mastery Table
    let tableY = startY + boxHeight + 12;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('DOMINIO ESPECTRAL POR BANDAS DE FRECUENCIA', 15, tableY);

    tableY += 6;
    doc.setFillColor(20, 26, 38);
    doc.rect(15, tableY, 180, 8, 'F');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('BANDA', 18, tableY + 5.5);
    doc.text('RANGO (HZ)', 65, tableY + 5.5);
    doc.text('INTENTOS', 105, tableY + 5.5);
    doc.text('PRECISIÓN', 135, tableY + 5.5);
    doc.text('ERROR MEDIO (HZ)', 165, tableY + 5.5);

    tableY += 8;
    doc.setFont('helvetica', 'normal');
    report.bandSummaries.forEach((bandSummary, i) => {
      const isEven = i % 2 === 0;
      doc.setFillColor(isEven ? 12 : 16, isEven ? 16 : 22, isEven ? 24 : 32);
      doc.rect(15, tableY, 180, 7.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.text(bandSummary.band.nameEs, 18, tableY + 5);

      doc.setTextColor(148, 163, 184);
      doc.text(`${bandSummary.band.minHz} - ${bandSummary.band.maxHz} Hz`, 65, tableY + 5);
      doc.text(`${bandSummary.attemptsCount}`, 110, tableY + 5);

      doc.setTextColor(bandSummary.averageAccuracy >= 80 ? 16 : 245, bandSummary.averageAccuracy >= 80 ? 185 : 158, bandSummary.averageAccuracy >= 80 ? 129 : 11);
      doc.text(bandSummary.attemptsCount > 0 ? `${bandSummary.averageAccuracy}%` : 'N/A', 135, tableY + 5);

      doc.setTextColor(148, 163, 184);
      doc.text(bandSummary.attemptsCount > 0 ? `±${bandSummary.averageDeviationHz} Hz` : 'N/A', 165, tableY + 5);

      tableY += 7.5;
    });

    // Best / Worst Rounds Section
    tableY += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('EJERCICIOS DESTACADOS', 15, tableY);

    tableY += 6;
    if (report.bestRound) {
      doc.setFillColor(15, 20, 30);
      doc.roundedRect(15, tableY, 88, 22, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(16, 185, 129);
      doc.text('MEJOR INTENTO', 20, tableY + 6);
      doc.setTextColor(255, 255, 255);
      doc.text(`Ronda #${report.bestRound.roundNumber} - ${report.bestRound.targetHz} Hz`, 20, tableY + 12);
      doc.setTextColor(148, 163, 184);
      doc.text(`Precisión: ${report.bestRound.accuracy}% (Desviación: ${report.bestRound.deviationHz} Hz)`, 20, tableY + 18);
    }

    if (report.worstRound) {
      doc.setFillColor(15, 20, 30);
      doc.roundedRect(107, tableY, 88, 22, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(244, 63, 94);
      doc.text('MAYOR DESVIACIÓN', 112, tableY + 6);
      doc.setTextColor(255, 255, 255);
      doc.text(`Ronda #${report.worstRound.roundNumber} - ${report.worstRound.targetHz} Hz`, 112, tableY + 12);
      doc.setTextColor(148, 163, 184);
      doc.text(`Precisión: ${report.worstRound.accuracy}% (Desviación: ${report.worstRound.deviationHz} Hz)`, 112, tableY + 18);
    }

    tableY += 28;

    // Recommendations Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('DIAGNÓSTICO Y RECOMENDACIONES TÉCNICAS', 15, tableY);

    tableY += 6;
    doc.setFillColor(15, 20, 30);
    doc.roundedRect(15, tableY, 180, 32, 2, 2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    let recY = tableY + 7;
    report.recommendations.forEach((rec) => {
      doc.text(`• ${rec}`, 20, recY);
      recY += 7;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('AudioFit Web App • Arquitectura Hexagonal • Calibración Psicoacústica de Audio en Tiempo Real', 15, 285);

    doc.save(`AudioFit_Reporte_${report.sessionId}.pdf`);
  }
}
