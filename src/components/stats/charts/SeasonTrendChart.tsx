// src/components/stats/charts/SeasonTrendChart.tsx
// Multi-line chart showing stat trends across games (PPG, APG, REB)

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface GameStatPoint {
  gameNum: number;
  date: string;
  ppg: number;
  apg: number;
  rpg: number;
  fgPct: number;
}

interface SeasonTrendChartProps {
  data: GameStatPoint[];
  title?: string;
}

export const SeasonTrendChart = ({ data, title = 'Season Trends' }: SeasonTrendChartProps) => {
  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 p-6">
        <h3 className="text-sm font-bold text-zinc-100 mb-4">{title}</h3>
        <div className="text-center text-zinc-400 py-8">
          No game data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-700 p-6">
      <h3 className="text-sm font-bold text-zinc-100 mb-4">{title}</h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis
            dataKey="gameNum"
            label={{ value: 'Game #', position: 'insideBottomRight', offset: -5 }}
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
          />
          <YAxis
            label={{ value: 'Stats', angle: -90, position: 'insideLeft' }}
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#fafafa' }}
            formatter={(value) => (typeof value === 'number' ? value.toFixed(1) : value)}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="ppg"
            stroke="#dc2626"
            strokeWidth={2}
            dot={false}
            name="PPG"
            isAnimationActive={true}
          />
          <Line
            type="monotone"
            dataKey="apg"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="APG"
            isAnimationActive={true}
          />
          <Line
            type="monotone"
            dataKey="rpg"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            name="RPG"
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="border-t border-zinc-700 mt-6 pt-4">
        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <div className="font-bold text-red-600">
              {data.length > 0 ? (data.reduce((sum, d) => sum + d.ppg, 0) / data.length).toFixed(1) : 0}
            </div>
            <div className="text-zinc-400">PPG Avg</div>
          </div>
          <div>
            <div className="font-bold text-blue-600">
              {data.length > 0 ? (data.reduce((sum, d) => sum + d.apg, 0) / data.length).toFixed(1) : 0}
            </div>
            <div className="text-zinc-400">APG Avg</div>
          </div>
          <div>
            <div className="font-bold text-green-600">
              {data.length > 0 ? (data.reduce((sum, d) => sum + d.rpg, 0) / data.length).toFixed(1) : 0}
            </div>
            <div className="text-zinc-400">RPG Avg</div>
          </div>
        </div>
      </div>
    </div>
  );
};
