'use client';

import { FC, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { PriceCandle } from '@/services/oracleAPI';

interface PriceChartProps {
  candles: PriceCandle[];
  pair: string;
  color?: string;
  height?: number;
}

interface ChartDataPoint {
  time: string;
  timestamp: number;
  price: number;
  high: number;
  low: number;
  open: number;
  close: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartDataPoint;
    return (
      <div className="glass-card p-3 rounded-lg border border-white/10">
        <p className="text-xs text-gray-400 mb-2">{data.time}</p>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-xs text-gray-500">Open</span>
            <span className="text-xs text-white font-medium">${data.open.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-xs text-gray-500">High</span>
            <span className="text-xs text-green-400 font-medium">${data.high.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-xs text-gray-500">Low</span>
            <span className="text-xs text-red-400 font-medium">${data.low.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-xs text-gray-500">Close</span>
            <span className="text-xs text-white font-medium">${data.close.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const PriceChart: FC<PriceChartProps> = ({ candles, pair, color = '#8B5CF6', height = 400 }) => {
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!candles || candles.length === 0) return [];

    return candles.map((candle) => ({
      time: new Date(candle.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: candle.timestamp,
      price: candle.close,
      high: candle.high,
      low: candle.low,
      open: candle.open,
      close: candle.close,
    }));
  }, [candles]);

  const { minPrice, maxPrice, priceChange, changePercent } = useMemo(() => {
    if (chartData.length === 0) {
      return { minPrice: 0, maxPrice: 0, priceChange: 0, changePercent: 0 };
    }

    const prices = chartData.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const firstPrice = chartData[0].price;
    const lastPrice = chartData[chartData.length - 1].price;
    const change = lastPrice - firstPrice;
    const percent = firstPrice > 0 ? (change / firstPrice) * 100 : 0;

    // Add padding to min/max
    const padding = (max - min) * 0.1;

    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      priceChange: change,
      changePercent: percent,
    };
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>Collecting price data...</p>
          <p className="text-xs text-gray-600 mt-1">Chart will appear shortly</p>
        </div>
      </div>
    );
  }

  const isPositive = changePercent >= 0;
  const gradientId = `colorPrice-${pair.replace('/', '-')}`;

  return (
    <div>
      {/* Price Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-white">
            ${chartData[chartData.length - 1]?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`px-2 py-1 rounded-lg text-sm font-medium ${isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </span>
        </div>
        <div className="text-sm text-gray-500">
          {chartData.length} data points
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? '#22C55E' : '#EF4444'} stopOpacity={0.3} />
              <stop offset="100%" stopColor={isPositive ? '#22C55E' : '#EF4444'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B7280', fontSize: 11 }}
            dy={10}
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B7280', fontSize: 11 }}
            tickFormatter={(value) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            dx={-10}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="price"
            stroke={isPositive ? '#22C55E' : '#EF4444'}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            animationDuration={500}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-green-400 rounded" />
          <span>Price Up</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-red-400 rounded" />
          <span>Price Down</span>
        </div>
      </div>
    </div>
  );
};

export default PriceChart;
