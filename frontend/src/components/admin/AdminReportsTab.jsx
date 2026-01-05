import { BarChart3 } from "lucide-react"
import DailyDeskEnergyChart from "./charts/DailyDeskEnergyChart"
import MonthlyComparisonChart from "./charts/MonthlyComparisonChart"

export default function AdminReportsTab({
  energyReport,
  monthlyReport,
  selectedMonth,
  selectedYear,
  compareMode,
  setCompareMode,
  compareMonths,
  viewMode,
  setViewMode,
  handleMonthChange,
  handleAddCompareMonth,
  handleRemoveCompareMonth,
  fetchDeskDailyReport,
  deskDailyLoading,
  deskDailyReport,
  selectedDeskReportId,
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Báo Cáo Điện Năng Tiêu Thụ Theo Tháng
        </h3>

        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Chọn tháng:</label>
              <input
                type="month"
                value={`${selectedYear}-${String(selectedMonth).padStart(2, "0")}`}
                onChange={handleMonthChange}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="compareMode"
                checked={compareMode}
                onChange={(e) => setCompareMode(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="compareMode" className="text-sm font-medium text-gray-700 cursor-pointer">
                So sánh nhiều tháng
              </label>
            </div>

            {compareMode && (
              <button
                onClick={handleAddCompareMonth}
                className="px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                + Thêm tháng so sánh
              </button>
            )}
          </div>

          {compareMode && compareMonths.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {compareMonths.map((cm, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-lg text-sm"
                >
                  <span>
                    {String(cm.month).padStart(2, "0")}/{cm.year}
                  </span>
                  <button
                    onClick={() => handleRemoveCompareMonth(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {monthlyReport?.selectedMonth && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Hiển thị:</span>
              <button
                onClick={() => setViewMode("byRoom")}
                className={`px-3 py-1 text-sm rounded transition ${viewMode === "byRoom"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
              >
                Theo phòng
              </button>
              <button
                onClick={() => setViewMode("total")}
                className={`px-3 py-1 text-sm rounded transition ${viewMode === "total"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
              >
                Tổng hợp
              </button>
            </div>
          )}
        </div>

        {monthlyReport?.selectedMonth ? (
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-bold text-gray-900 mb-2">
                Tháng {String(selectedMonth).padStart(2, "0")}/{selectedYear}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Tổng năng lượng:</span>
                  <span className="ml-2 font-bold text-blue-600">
                    {monthlyReport.selectedMonth.summary.totalEnergyWh} Wh
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Tổng thời gian sử dụng:</span>
                  <span className="ml-2 font-bold text-blue-600">
                    {monthlyReport.selectedMonth.summary.totalUsageMinutes} phút
                  </span>
                </div>
              </div>
            </div>

            {viewMode === "byRoom" ? (
              <div className="space-y-4">
                {monthlyReport.selectedMonth.byRoom.map((room) => (
                  <div key={room.roomId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-gray-900">{room.roomName}</h4>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">{room.totalEnergyWh} Wh</span>
                        <span className="ml-2">({room.totalUsageMinutes} phút)</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      {room.desks.map((desk) => {
                        const isSelectedDesk = selectedDeskReportId === desk.id
                        return (
                          <button
                            key={desk.id}
                            type="button"
                            onClick={() => fetchDeskDailyReport(desk.id)}
                            className={`border rounded p-2 text-sm text-left transition cursor-pointer w-full ${isSelectedDesk ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"}`}
                          >
                            <div className="font-medium">
                              Bàn {desk.row}-{desk.position}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              <div>Năng lượng: {desk.energyWh} Wh</div>
                              <div>Sử dụng: {desk.usageMinutes} phút</div>
                              <div>Công suất: {desk.lampPowerW} W</div>
                            </div>
                            <div className="text-[11px] text-blue-600 mt-2">
                              Nhấn để xem biểu đồ theo ngày
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-4">Tổng hợp toàn bộ</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded p-3">
                    <div className="text-sm text-gray-600">Tổng năng lượng</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {monthlyReport.selectedMonth.total.totalEnergyWh} Wh
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-3">
                    <div className="text-sm text-gray-600">Tổng thời gian</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {monthlyReport.selectedMonth.total.totalUsageMinutes} phút
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(deskDailyLoading || deskDailyReport) && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-gray-900">
                      {deskDailyReport
                        ? `Chi tiết bàn ${deskDailyReport.desk?.row}-${deskDailyReport.desk?.position} (${deskDailyReport.desk?.roomName || "Phòng"})`
                        : "Đang tải biểu đồ bàn..."}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Biểu đồ năng lượng theo ngày trong tháng {String(selectedMonth).padStart(2, "0")}/{selectedYear}
                    </p>
                  </div>
                  {deskDailyReport && (
                    <div className="text-sm text-gray-600 text-right">
                      <div>Tổng năng lượng: {deskDailyReport.summary.totalEnergyWh} Wh</div>
                      <div>Tổng thời gian: {deskDailyReport.summary.totalUsageMinutes} phút</div>
                    </div>
                  )}
                </div>
                {deskDailyLoading && <p className="text-gray-600">Đang tải biểu đồ...</p>}
                {!deskDailyLoading && deskDailyReport ? (
                  deskDailyReport.days.length > 0 ? (
                    <DailyDeskEnergyChart report={deskDailyReport} />
                  ) : (
                    <p className="text-gray-600">Chưa có dữ liệu cho tháng này.</p>
                  )
                ) : null}
              </div>
            )}

            {compareMode && monthlyReport.compareMonths && monthlyReport.compareMonths.length > 0 && (
              <div className="border rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-4">Biểu đồ so sánh</h4>
                <MonthlyComparisonChart
                  selectedMonth={monthlyReport.selectedMonth}
                  compareMonths={monthlyReport.compareMonths}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Báo Cáo Tổng Tích Lũy (Tất cả thời gian)
        </h3>

        {energyReport ? (
          <div className="space-y-6">
            {energyReport.map((room) => (
              <div key={room.roomId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-900">{room.roomName}</h4>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{room.totalEnergyWh.toFixed(2)} Wh</span>
                    <span className="ml-2">({room.totalUsageMinutes} phút)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {room.desks.map((desk) => (
                    <div key={desk.id} className="border rounded p-2 text-sm">
                      <div className="font-medium">Bàn {desk.row}-{desk.position}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        <div>Năng lượng: {desk.energyWh.toFixed(2)} Wh</div>
                        <div>Sử dụng: {desk.usageMinutes} phút</div>
                        <div>Công suất: {desk.lampPowerW} W</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        )}
      </div>
    </div>
  )
}
