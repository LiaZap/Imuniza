'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeeklyPoint } from '@/lib/types';

function formatDay(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
}

export function WeeklyChart({ data }: { data: WeeklyPoint[] }) {
  const chartData = data.map((d) => ({ ...d, label: formatDay(d.date) }));
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="messages" name="Mensagens" fill="#1f7a66" radius={[4, 4, 0, 0]} />
          <Bar dataKey="handoffs" name="Encaminhamentos" fill="#8dc63f" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
