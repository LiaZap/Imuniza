'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HourlyPoint } from '@/lib/types';

export function HourlyChart({ data }: { data: HourlyPoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: `${String(d.hour).padStart(2, '0')}h`,
  }));
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="hourlyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1f7a66" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#1f7a66" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={3} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={35} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 30px -12px rgba(16,71,59,0.18)',
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="messages"
            name="Mensagens"
            stroke="#1f7a66"
            strokeWidth={2}
            fill="url(#hourlyFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
