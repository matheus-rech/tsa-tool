import { useRef, useEffect } from 'react';
import { TSAResults, TSAParams } from '@/types';
import { computeMonitoringBoundary, computeFutilityBoundary, normalQuantile } from '@/lib/statistics';

interface TSAChartProps {
  results: TSAResults;
  params: TSAParams;
}

export function TSAChart({ results, params }: TSAChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !results.cumulativeData.length) return;

    // Draw function
    const draw = () => {
      if (!canvasRef.current || !containerRef.current) return;
      
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      
      // Update canvas size
      canvas.width = rect.width * dpr;
      canvas.height = 500 * dpr;
      
      // Reset transform before scaling
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      const width = rect.width;
      const height = 500;
      const padding = { top: 40, right: 50, bottom: 70, left: 80 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      // Clear and draw background
      ctx.fillStyle = '#0c1425';
      ctx.fillRect(0, 0, width, height);

      const data = results.cumulativeData;
      const maxInfoFraction = Math.max(1.3, ...data.map(d => d.informationFraction)) * 1.1;
      const yMin = -6, yMax = 6;
      
      const xScale = (v: number) => padding.left + (v / maxInfoFraction) * chartWidth;
      const yScale = (v: number) => padding.top + ((yMax - v) / (yMax - yMin)) * chartHeight;

      // Draw grid
      ctx.strokeStyle = '#1e2d44';
      ctx.lineWidth = 1;

      // Vertical grid
      for (let i = 0; i <= 10; i++) {
        const x = xScale((i / 10) * maxInfoFraction);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
      }

      // Horizontal grid
      for (let z = yMin; z <= yMax; z += 1) {
        const y = yScale(z);
        ctx.strokeStyle = z === 0 ? '#2d4a6a' : '#1e2d44';
        ctx.lineWidth = z === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      }

      // Draw axes
      ctx.strokeStyle = '#4a6fa5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding.left, padding.top);
      ctx.lineTo(padding.left, height - padding.bottom);
      ctx.lineTo(width - padding.right, height - padding.bottom);
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = '#8ba4c7';
      ctx.font = '12px "IBM Plex Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';

      // X-axis labels
      for (let i = 0; i <= 10; i += 2) {
        const frac = (i / 10) * maxInfoFraction;
        ctx.fillText(`${(frac * 100).toFixed(0)}%`, xScale(frac), height - padding.bottom + 25);
      }
      ctx.font = '13px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText('Information Fraction (% of Required Information Size)', width / 2, height - 15);

      // Y-axis labels
      ctx.textAlign = 'right';
      ctx.font = '12px "IBM Plex Mono", monospace';
      for (let z = yMin; z <= yMax; z += 2) {
        ctx.fillText(z.toString(), padding.left - 12, yScale(z) + 4);
      }

      // Y-axis title
      ctx.save();
      ctx.translate(20, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.font = '13px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText('Cumulative Z-Score', 0, 0);
      ctx.restore();

      // Draw RIS line (100%)
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.moveTo(xScale(1), padding.top);
      ctx.lineTo(xScale(1), height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label RIS
      ctx.fillStyle = '#a855f7';
      ctx.font = '11px "IBM Plex Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RIS (100%)', xScale(1), padding.top - 10);

      // Draw conventional significance lines
      const zAlpha = normalQuantile(1 - params.alpha / 2);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, yScale(zAlpha));
      ctx.lineTo(width - padding.right, yScale(zAlpha));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding.left, yScale(-zAlpha));
      ctx.lineTo(width - padding.right, yScale(-zAlpha));
      ctx.stroke();
      ctx.setLineDash([]);

      // Label conventional boundary
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText(`Z = ±${zAlpha.toFixed(2)}`, width - padding.right + 5, yScale(zAlpha) + 4);

      // Draw O'Brien-Fleming monitoring boundaries (Lan-DeMets spending)
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;

      // Upper monitoring boundary
      ctx.beginPath();
      let first = true;
      for (let i = 2; i <= 100; i++) {
        const frac = (i / 100) * maxInfoFraction;
        const boundary = Math.min(computeMonitoringBoundary(frac, params.alpha), 8);
        const x = xScale(frac);
        const y = yScale(boundary);
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Lower monitoring boundary
      ctx.beginPath();
      first = true;
      for (let i = 2; i <= 100; i++) {
        const frac = (i / 100) * maxInfoFraction;
        const boundary = -Math.min(computeMonitoringBoundary(frac, params.alpha), 8);
        if (first) { ctx.moveTo(xScale(frac), yScale(boundary)); first = false; }
        else ctx.lineTo(xScale(frac), yScale(boundary));
      }
      ctx.stroke();

      // Draw futility boundaries (beta-spending inner wedge)
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      // Upper futility boundary
      ctx.beginPath();
      first = true;
      for (let i = 2; i <= 100; i++) {
        const frac = (i / 100) * maxInfoFraction;
        const boundary = Math.min(computeFutilityBoundary(frac, params.beta), 8);
        if (first) { ctx.moveTo(xScale(frac), yScale(boundary)); first = false; }
        else ctx.lineTo(xScale(frac), yScale(boundary));
      }
      ctx.stroke();

      // Lower futility boundary
      ctx.beginPath();
      first = true;
      for (let i = 2; i <= 100; i++) {
        const frac = (i / 100) * maxInfoFraction;
        const boundary = -Math.min(computeFutilityBoundary(frac, params.beta), 8);
        if (first) { ctx.moveTo(xScale(frac), yScale(boundary)); first = false; }
        else ctx.lineTo(xScale(frac), yScale(boundary));
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Fill areas
      // Benefit area (green tint above upper monitoring)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
      ctx.beginPath();
      ctx.moveTo(xScale(0.02), yScale(Math.min(computeMonitoringBoundary(0.02, params.alpha), 8)));
      for (let i = 2; i <= 100; i++) {
        const frac = (i / 100) * maxInfoFraction;
        const boundary = Math.min(computeMonitoringBoundary(frac, params.alpha), 8);
        ctx.lineTo(xScale(frac), yScale(boundary));
      }
      ctx.lineTo(width - padding.right, padding.top);
      ctx.lineTo(padding.left, padding.top);
      ctx.closePath();
      ctx.fill();

      // Harm area (red tint below lower monitoring)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
      ctx.beginPath();
      ctx.moveTo(xScale(0.02), yScale(-Math.min(computeMonitoringBoundary(0.02, params.alpha), 8)));
      for (let i = 2; i <= 100; i++) {
        const frac = (i / 100) * maxInfoFraction;
        const boundary = -Math.min(computeMonitoringBoundary(frac, params.alpha), 8);
        ctx.lineTo(xScale(frac), yScale(boundary));
      }
      ctx.lineTo(width - padding.right, height - padding.bottom);
      ctx.lineTo(padding.left, height - padding.bottom);
      ctx.closePath();
      ctx.fill();

      // Draw Z-curve with glow effect
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      data.forEach((point, i) => {
        const x = xScale(point.informationFraction);
        const y = yScale(point.zStatistic);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw data points
      data.forEach((point, i) => {
        const x = xScale(point.informationFraction);
        const y = yScale(point.zStatistic);

        // Outer glow
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.fill();

        // Main circle
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#06b6d4';
        ctx.fill();

        // Inner highlight
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#67e8f9';
        ctx.fill();

        // Border
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#0c1425';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Add study number
        if (data.length <= 15 || i % 2 === 0) {
          ctx.fillStyle = '#8ba4c7';
          ctx.font = '9px "IBM Plex Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText((i + 1).toString(), x, y - 14);
        }
      });

      // Final Z label with background
      const last = data[data.length - 1];
      const labelX = xScale(last.informationFraction) + 15;
      const labelY = yScale(last.zStatistic);
      const labelText = `Z = ${last.zStatistic.toFixed(2)}`;

      ctx.font = 'bold 12px "IBM Plex Mono", monospace';
      const textWidth = ctx.measureText(labelText).width;

      // Label background
      ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
      ctx.beginPath();
      ctx.roundRect(labelX - 4, labelY - 10, textWidth + 8, 20, 4);
      ctx.fill();

      // Label text
      ctx.fillStyle = '#0c1425';
      ctx.textAlign = 'left';
      ctx.fillText(labelText, labelX, labelY + 4);
    };

    // Initial draw
    draw();

    // Handle resize
    const handleResize = () => {
      window.requestAnimationFrame(draw);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [results, params]);

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} className="w-full h-[500px]" />
    </div>
  );
}
