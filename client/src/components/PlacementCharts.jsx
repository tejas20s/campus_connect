import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const colors = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#2dd4bf'];

export default function PlacementCharts({ mode, data }) {
  if (!data.length) {
    return <p className="py-16 text-center text-sm text-slate-400">No selected placement records for these filters.</p>;
  }

  if (mode === 'company') {
    return (
      <div className="mt-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="placements" nameKey="name" cx="50%" cy="48%" outerRadius={105} label={({ name, value }) => `${name} (${value})`}>
              {data.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#fff' }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const isDepartment = mode === 'department';
  return (
    <div className="mt-4 h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: isDepartment ? 40 : 20 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            dataKey={isDepartment ? 'name' : 'year'}
            angle={isDepartment ? -25 : 0}
            textAnchor={isDepartment ? 'end' : 'middle'}
            interval={0}
            height={isDepartment ? 70 : 30}
            tick={{ fill: '#cbd5e1', fontSize: 11 }}
          />
          <YAxis allowDecimals={false} tick={{ fill: '#cbd5e1' }} />
          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#fff' }} />
          <Bar dataKey="placements" fill={isDepartment ? '#38bdf8' : '#a78bfa'} name="Placed students" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
