import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import { 
  BarChart2, Filter, ChevronDown, Calendar, Clock, CheckSquare, Mail, 
  TrendingUp, TrendingDown, Loader2, Users, CheckCircle, ArrowRight
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { analyticsService } from '../api/analytics.api';
import { exportService } from '../api/export.api';
import { useAppSelector } from '../hooks/useAppDispatch';

const TP = ({ active, payload, label }: any) => active && payload?.length ? (
  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 shadow-md text-[12px] backdrop-blur-md">
    <p className="font-bold text-[var(--color-text)] mb-1">{label}</p>
    {payload.map((p: any) => <p key={p.name} style={{ color: p.color || p.stroke }} className="font-semibold">{p.name}: {p.value}</p>)}
  </div>
) : null;

const fu = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.25, 1, 0.5, 1] as const, delay },
});

// Helper mapping for KPI icons
const getIconForLabel = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes('meeting')) return <Calendar size={14} />;
  if (l.includes('duration')) return <Clock size={14} />;
  if (l.includes('action') || l.includes('task')) return <CheckSquare size={14} />;
  if (l.includes('summary')) return <BarChart2 size={14} />;
  return <TrendingUp size={14} />;
};

export default function Analytics() {
  const token = useAppSelector(s => s.auth.accessToken) || localStorage.getItem('im_access_token') || '';

  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsService.getAnalytics().then((res: any) => res?.data ?? res),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });

  const handleExportAnalytics = () => {
    exportService.downloadAnalyticsCSV();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !rawData) {
    return <div className="text-red-500 p-5">Failed to load analytics data.</div>;
  }

  const data = rawData;
  const { weekly = [], taskData = [], productivity = [], engagement = [] } = data;

  const totalTasks = taskData.reduce((acc: number, curr: any) => acc + curr.value, 0);

  return (
    <div className="flex flex-col gap-6 font-sans text-[var(--color-text)] pb-10">
      
      {/* Header Row */}
      <motion.div {...fu(0)} className="flex items-center justify-between flex-wrap gap-4 bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <BarChart2 size={24} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics Hub</h1>
            <p className="text-[13px] text-[var(--color-text-secondary)] font-medium mt-0.5">Track meeting performance, engagement and outcomes.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleExportAnalytics}>
            Export CSV
          </Button>
        </div>
      </motion.div>

      {/* KPI Row (Dynamic based on backend 'engagement' array) */}
      <motion.div {...fu(0.05)} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {engagement.map((metric: any, i: number) => (
          <Card key={i} className="p-5 flex flex-col justify-between border border-[var(--color-border)] bg-[var(--color-surface)] rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                {getIconForLabel(metric.label)}
              </div>
              <p className="text-[12px] font-bold">{metric.label}</p>
            </div>
            <div>
              <p className="text-3xl font-bold mb-1">{metric.value}</p>
              <p className={`text-[11px] font-medium flex items-center gap-1 ${metric.up ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
                {metric.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {metric.trend} <span className="text-[var(--color-text-secondary)]">vs previous</span>
              </p>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Charts Row */}
      <motion.div {...fu(0.1)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Task Completion Distribution (Replacing Talk-Time) */}
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-2xl shadow-sm flex flex-col">
          <h2 className="text-[14px] font-bold mb-4">Task Completion</h2>
          <div className="flex-1 flex items-center justify-between">
            <div className="relative w-[160px] h-[160px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={taskData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                    {taskData.map((e: any, i: number) => <Cell key={i} fill={e.color || '#6366F1'} />)}
                  </Pie>
                  <Tooltip content={<TP />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-[var(--color-text-secondary)] font-semibold">Total Tasks</span>
                <span className="text-[15px] font-bold">{totalTasks}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 pl-4">
              {taskData.map((d: any) => (
                <div key={d.name} className="flex items-center gap-2 text-[12px]">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color || '#6366F1' }} />
                  <div>
                    <span className="font-bold text-[var(--color-text)]">{d.name}</span>
                    <p className="text-[10px] text-[var(--color-text-secondary)] font-semibold">{d.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Activity Trend (Replacing Sentiment) */}
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-2xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[14px] font-bold">Activity Trend</h2>
            <div className="flex items-center gap-4 text-[11px] font-bold">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Meetings</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Tasks</span>
            </div>
          </div>
          <div className="flex-1 h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekly} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<TP />} />
                <Line type="monotone" dataKey="meetings" name="Meetings" stroke="#6366F1" strokeWidth={2} dot={{ r: 3, fill: '#6366F1', strokeWidth: 0 }} />
                <Line type="monotone" dataKey="tasks" name="Tasks" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Productivity Over Time (Replacing Effectiveness) */}
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-2xl shadow-sm flex flex-col">
          <h2 className="text-[14px] font-bold mb-6">Productivity Over Time</h2>
          <div className="flex-1 h-[160px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productivity} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gEffect" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818CF8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="week" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} ticks={[0, 25, 50, 75, 100]} />
                <Tooltip content={<TP />} />
                <Area type="monotone" dataKey="score" name="Score" stroke="#6366F1" fill="url(#gEffect)" strokeWidth={2.5} activeDot={{ r: 6, fill: '#fff', stroke: '#6366F1', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

      </motion.div>

      {/* Dynamic Insights Row */}
      <motion.div {...fu(0.15)} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Insights */}
        <Card className="col-span-1 lg:col-span-2 p-6 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-2xl shadow-sm flex flex-col">
          <h2 className="text-[14px] font-bold mb-6">Dynamic Insights</h2>
          <div className="flex-1 flex flex-col gap-4">
            
            {engagement.length > 0 && (
              <div className="flex gap-3 p-3.5 bg-[var(--color-surface-2)] rounded-xl border border-[var(--color-border)]">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                  <BarChart2 size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-[12.5px] font-bold mb-1 leading-snug">Based on {engagement[0]?.label}, you are at {engagement[0]?.value}</p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] font-medium leading-snug">
                    {engagement[0]?.up ? 'Great job! Keep maintaining focused discussions.' : 'Consider focusing on efficiency to improve this metric.'}
                  </p>
                </div>
              </div>
            )}

            {productivity.length > 0 && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 mt-1">
                  <Clock size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-[12.5px] font-bold mb-1 leading-snug">Current productivity score is {productivity[productivity.length - 1]?.score}%</p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] font-medium leading-snug">
                    This is based on your task completion rate over the past week.
                  </p>
                </div>
              </div>
            )}

          </div>

          <button className="text-[13px] font-bold text-indigo-600 dark:text-indigo-400 mt-6 flex items-center gap-1 hover:underline w-max">
            View all insights <ArrowRight size={14} />
          </button>
        </Card>

      </motion.div>

    </div>
  );
}
