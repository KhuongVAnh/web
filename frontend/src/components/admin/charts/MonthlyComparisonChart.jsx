import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export default function MonthlyComparisonChart({ selectedMonth, compareMonths }) {
  const roomNames = selectedMonth.byRoom.map((r) => r.roomName)
  const chartData = roomNames.map((roomName) => {
    const dataPoint = {
      name: roomName,
      [`${selectedMonth.month}/${selectedMonth.year}`]: selectedMonth.byRoom.find((r) => r.roomName === roomName)
        ?.totalEnergyWh || 0,
    }

    compareMonths.forEach((cm) => {
      const monthLabel = `${cm.month}/${cm.year}`
      dataPoint[monthLabel] = cm.byRoom.find((r) => r.roomName === roomName)?.totalEnergyWh || 0
    })

    return dataPoint
  })

  const trendData = [
    {
      month: `${selectedMonth.month}/${selectedMonth.year}`,
      energy: selectedMonth.total.totalEnergyWh,
    },
    ...compareMonths.map((cm) => ({
      month: `${cm.month}/${cm.year}`,
      energy: cm.total.totalEnergyWh,
    })),
  ].sort((a, b) => {
    const [ma, ya] = a.month.split("/").map(Number)
    const [mb, yb] = b.month.split("/").map(Number)
    if (ya !== yb) return ya - yb
    return ma - mb
  })

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

  return (
    <div className="space-y-6">
      <div>
        <h5 className="text-sm font-medium text-gray-700 mb-3">So sánh năng lượng theo phòng</h5>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis label={{ value: "Năng lượng (Wh)", angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey={`${selectedMonth.month}/${selectedMonth.year}`}
              fill={colors[0]}
              name={`Tháng ${selectedMonth.month}/${selectedMonth.year}`}
            />
            {compareMonths.map((cm, index) => (
              <Bar
                key={index}
                dataKey={`${cm.month}/${cm.year}`}
                fill={colors[(index + 1) % colors.length]}
                name={`Tháng ${cm.month}/${cm.year}`}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h5 className="text-sm font-medium text-gray-700 mb-3">Xu hướng tổng năng lượng</h5>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis label={{ value: "Năng lượng (Wh)", angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="energy" stroke="#3b82f6" strokeWidth={2} name="Tổng năng lượng (Wh)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
