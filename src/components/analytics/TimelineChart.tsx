import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface TimelineChartProps {
  data: { data: string; inviati: number; aperti: number; risposte: number }[];
}

export function TimelineChart({ data }: TimelineChartProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="terminal-header mb-4">Andamento giornaliero</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 10%, 15%)" />
            <XAxis dataKey="data" tick={{ fontSize: 10, fill: "hsl(240, 10%, 55%)" }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "hsl(240, 10%, 55%)" }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "hsl(240, 14%, 7%)",
                border: "1px solid hsl(240, 10%, 15%)",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "monospace",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace" }} />
            <Line type="monotone" dataKey="inviati" stroke="hsl(213, 100%, 60%)" strokeWidth={2} dot={false} name="Inviati" />
            <Line type="monotone" dataKey="aperti" stroke="hsl(40, 100%, 50%)" strokeWidth={2} dot={false} name="Aperti" />
            <Line type="monotone" dataKey="risposte" stroke="hsl(152, 100%, 45%)" strokeWidth={2} dot={false} name="Risposte" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
