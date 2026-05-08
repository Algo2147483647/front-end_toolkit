import { formatHistoryDateLabel } from "../priceHistory";
import { formatNumber } from "../portfolio";
import type { PriceHistoryCandle } from "../types";

interface CandlestickChartProps {
  candles: PriceHistoryCandle[];
  locale: string;
}

export default function CandlestickChart({ candles, locale }: CandlestickChartProps) {
  if (!candles.length) {
    return <div className="empty-state">No historical candles available.</div>;
  }

  const width = Math.max(980, candles.length * 14);
  const height = 560;
  const marginTop = 28;
  const marginRight = 20;
  const marginBottom = 38;
  const marginLeft = 76;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;

  const highValue = Math.max(...candles.map((candle) => candle.high));
  const lowValue = Math.min(...candles.map((candle) => candle.low));
  const range = Math.max(highValue - lowValue, 1);
  const paddedHigh = highValue + range * 0.06;
  const paddedLow = lowValue - range * 0.06;
  const paddedRange = paddedHigh - paddedLow;
  const step = plotWidth / Math.max(candles.length, 1);
  const bodyWidth = Math.max(5, Math.min(12, step * 0.64));

  const yFor = (value: number) => marginTop + ((paddedHigh - value) / paddedRange) * plotHeight;

  const gridValues = Array.from({ length: 5 }, (_, index) => paddedLow + (paddedRange / 4) * index).reverse();
  const xLabelStep = Math.max(1, Math.floor(candles.length / 6));

  return (
    <div className="candle-chart-scroll">
      <svg className="candle-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Historical candlestick chart">
        <rect x={0} y={0} width={width} height={height} rx={16} className="candle-chart-bg" />

        {gridValues.map((value) => {
          const y = yFor(value);
          return (
            <g key={value}>
              <line x1={marginLeft} x2={width - marginRight} y1={y} y2={y} className="candle-grid-line" />
              <text x={marginLeft - 10} y={y + 4} textAnchor="end" className="candle-axis-label">
                {formatNumber(value, locale, 4)}
              </text>
            </g>
          );
        })}

        {candles.map((candle, index) => {
          const xCenter = marginLeft + step * index + step / 2;
          const openY = yFor(candle.open);
          const closeY = yFor(candle.close);
          const highY = yFor(candle.high);
          const lowY = yFor(candle.low);
          const bodyY = Math.min(openY, closeY);
          const bodyHeight = Math.max(2, Math.abs(closeY - openY));
          const isUp = candle.close >= candle.open;

          return (
            <g key={`${candle.date}-${index}`}>
              <line x1={xCenter} x2={xCenter} y1={highY} y2={lowY} className={isUp ? "candle-wick up" : "candle-wick down"} />
              <rect
                x={xCenter - bodyWidth / 2}
                y={bodyY}
                width={bodyWidth}
                height={bodyHeight}
                rx={2}
                className={isUp ? "candle-body up" : "candle-body down"}
              />
            </g>
          );
        })}

        {candles.map((candle, index) => {
          if (index % xLabelStep !== 0 && index !== candles.length - 1) {
            return null;
          }
          const x = marginLeft + step * index + step / 2;
          return (
            <text key={`${candle.date}-label`} x={x} y={height - 10} textAnchor="middle" className="candle-axis-label">
              {formatHistoryDateLabel(candle.date).slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
