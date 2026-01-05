import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export default function DailyDeskEnergyChart({ report }) {
  const chartData = report.days.map((day) => ({
    day: String(day.day).padStart(2, "0"),
    energyWh: Number.parseFloat(day.energyWh),
    usageMinutes: day.usageMinutes,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" />
        <YAxis
          yAxisId="left"
          label={{ value: "Năng lượng (Wh)", angle: -90, position: "insideLeft" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          label={{ value: "Thời gian (phút)", angle: 90, position: "insideRight" }}
        />
        <Tooltip />
        <Legend />
        <Bar
          yAxisId="left"
          dataKey="energyWh"
          fill="#3b82f6"
          name="Năng lượng (Wh)"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="usageMinutes"
          stroke="#f59e0b"
          strokeWidth={2}
          name="Thời gian sử dụng (phút)"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
