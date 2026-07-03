import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const DATA = [
  { day: 'Mon', meetings: 4 }, { day: 'Tue', meetings: 6 },
  { day: 'Wed', meetings: 3 }, { day: 'Thu', meetings: 8 },
  { day: 'Fri', meetings: 5 }, { day: 'Sat', meetings: 2 },
  { day: 'Sun', meetings: 1 },
];

const TP = ({ active, payload, label }: any) => active && payload?.length ? (
  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 shadow-xl">
    <p className="text-xs font-semibold text-[var(--color-text)]">{label}: {payload[0].value} meetings</p>
  </div>
) : null;

const AnalyticsChart = () => (
  <ResponsiveContainer width="100%" height={120}>
    <AreaChart data={DATA} margin={{ top: 5, right: 0, bottom: 0, left: -30 }}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
        </linearGradient>
      </defs>
      <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
      <Tooltip content={<TP />} />
      <Area type="monotone" dataKey="meetings" stroke="#6366F1" fill="url(#cg)" strokeWidth={2} />
    </AreaChart>
  </ResponsiveContainer>
);

export default AnalyticsChart;
