import { useState, useEffect } from "react"
import axios from "axios"
import { toast } from "react-toastify"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart } from "recharts"
import { Lightbulb, Settings, Zap, BarChart3, Thermometer, Droplets, Clock, User, Save, Loader2 } from "lucide-react"

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api"

export default function AdminDashboard({ activeTab, setActiveTab }) {
  const [rooms, setRooms] = useState([])
  const [stats, setStats] = useState(null)
  const [energyReport, setEnergyReport] = useState(null)
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [selectedDesk, setSelectedDesk] = useState(null)
  const [esp32Config, setEsp32Config] = useState({
    fs1: 3,
    fs2: 2,
    fs3: 1,
    distanceCm: 30,
    duration: 4000,
    room: null,
    row: null,
    table: null,
    deviceId: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingDesks, setTogglingDesks] = useState(new Set()) // Track which desks are being toggled

  // Monthly report states
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [compareMode, setCompareMode] = useState(false)
  const [compareMonths, setCompareMonths] = useState([])
  const [monthlyReport, setMonthlyReport] = useState(null)
  const [viewMode, setViewMode] = useState("byRoom") // "byRoom" or "total"
  const [deskDailyReport, setDeskDailyReport] = useState(null)
  const [deskDailyLoading, setDeskDailyLoading] = useState(false)
  const [selectedDeskReportId, setSelectedDeskReportId] = useState(null)

  const token = localStorage.getItem("token")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roomsRes, statsRes] = await Promise.all([
          axios.get(`${API_BASE}/rooms`),
          axios.get(`${API_BASE}/admin/stats`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])
        setRooms(roomsRes.data)
        setStats(statsRes.data)
        if (roomsRes.data.length > 0 && !selectedRoomId) {
          setSelectedRoomId(roomsRes.data[0].id)
        }
      } catch (error) {
        console.error("Lỗi tải dữ liệu:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [selectedRoomId, token])

  useEffect(() => {
    if (activeTab === "reports") {
      fetchEnergyReport()
      fetchMonthlyEnergyReport()
    }
  }, [activeTab, token, selectedMonth, selectedYear, compareMode, compareMonths])

  useEffect(() => {
    setDeskDailyReport(null)
    setSelectedDeskReportId(null)
  }, [selectedMonth, selectedYear])

  const fetchEnergyReport = async () => {
    try {
      const response = await axios.get(`${API_BASE}/admin/energy-report`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setEnergyReport(response.data)
    } catch (error) {
      console.error("Lỗi tải báo cáo:", error)
    }
  }

  const handleToggleLight = async (deskId) => {
    setTogglingDesks((prev) => new Set(prev).add(deskId))

    try {
      const response = await axios.patch(
        `${API_BASE}/desks/${deskId}/toggle-light`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )

      const roomsResponse = await axios.get(`${API_BASE}/rooms`)
      setRooms(roomsResponse.data)

      const desk = roomsResponse.data
        .flatMap((r) => r.desks || [])
        .find((d) => d.id === deskId)

      if (desk) {
        if (desk.disabled) {
          toast.info("Bàn đã bị vô hiệu hóa", { autoClose: 2500 })
        } else {
          toast.success("Bàn đã được kích hoạt", { autoClose: 2500 })
        }
      }

      return response.data
    } catch (error) {
      console.error("Lỗi bật/tắt bàn:", error)
      toast.error("Lỗi: " + (error.response?.data?.message || error.message), {
        position: "top-right",
        autoClose: 4000,
      })
    } finally {
      setTogglingDesks((prev) => {
        const newSet = new Set(prev)
        newSet.delete(deskId)
        return newSet
      })
    }
  }

  const fetchMonthlyEnergyReport = async () => {
    try {
      const params = new URLSearchParams({
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
      })

      if (compareMode && compareMonths.length > 0) {
        params.append("compareMonths", JSON.stringify(compareMonths))
      }

      const response = await axios.get(`${API_BASE}/admin/energy-report/monthly?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setMonthlyReport(response.data)
    } catch (error) {
      console.error("Lỗi tải báo cáo theo tháng:", error)
      toast.error("Lỗi tải báo cáo theo tháng: " + (error.response?.data?.message || error.message))
    }
  }


  const fetchDeskDailyReport = async (deskId) => {
    try {
      setDeskDailyLoading(true)
      setSelectedDeskReportId(deskId)
      setDeskDailyReport(null)

      const response = await axios.get(`${API_BASE}/admin/energy-report/daily`, {
        params: {
          deskId,
          month: selectedMonth,
          year: selectedYear,
        },
        headers: { Authorization: `Bearer ${token}` },
      })

      setDeskDailyReport(response.data)
    } catch (error) {
      console.error("Lỗi tải biểu đồ theo ngày:", error)
      toast.error("Lỗi tải biểu đồ theo ngày: " + (error.response?.data?.message || error.message))
    } finally {
      setDeskDailyLoading(false)
    }
  }

  const handleMonthChange = (e) => {
    const [year, month] = e.target.value.split("-")
    setSelectedYear(Number.parseInt(year))
    setSelectedMonth(Number.parseInt(month))
  }

  const handleAddCompareMonth = () => {
    const newMonth = prompt("Nhập tháng (MM/YYYY), ví dụ: 12/2024")
    if (newMonth) {
      const [month, year] = newMonth.split("/")
      if (month && year) {
        const m = Number.parseInt(month)
        const y = Number.parseInt(year)
        if (m >= 1 && m <= 12 && y >= 2020 && y <= 2100) {
          setCompareMonths([...compareMonths, { month: m, year: y }])
        } else {
          toast.error("Tháng/năm không hợp lệ")
        }
      }
    }
  }

  const handleRemoveCompareMonth = (index) => {
    setCompareMonths(compareMonths.filter((_, i) => i !== index))
  }

  const handleUpdateDeskConfig = async (deskId, config) => {
    try {
      setSaving(true)
      await axios.patch(
        `${API_BASE}/desks/${deskId}/config`,
        config,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      // Refresh rooms
      const response = await axios.get(`${API_BASE}/rooms`)
      setRooms(response.data)
      setSelectedDesk(null)
      toast.success("✅ Cập nhật thành công!", {
        position: "top-right",
        autoClose: 2000,
      })
    } catch (error) {
      console.error("Lỗi cập nhật cấu hình:", error)
      toast.error("Lỗi: " + (error.response?.data?.message || error.message), {
        position: "top-right",
        autoClose: 4000,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateESP32Config = async () => {
    if (!esp32Config.room || !esp32Config.row || !esp32Config.table) {
      toast.error("Cần nhập đủ phòng / dãy / bàn để gửi cấu hình", {
        autoClose: 3000,
      })
      return
    }

    try {
      setSaving(true)

      await axios.post(
        `${API_BASE}/admin/esp32/config`,
        esp32Config,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success("✅ Cập nhật cấu hình ESP32 thành công!", {
        position: "top-right",
        autoClose: 3000,
      })
    } catch (error) {
      console.error("Lỗi cập nhật ESP32:", error)

      toast.error(
        "Lỗi: " + (error.response?.data?.message || error.message),
        {
          position: "top-right",
          autoClose: 4000,
        }
      )
    } finally {
      setSaving(false)
    }
  }
  const handlePrefillFromDesk = (desk, roomNumber) => {
    setEsp32Config((prev) => ({
      ...prev,
      room: roomNumber,
      row: desk.row,
      table: desk.position,
      deviceId: desk.esp32DeviceId || prev.deviceId || null,
    }))

    setActiveTab("config")

    toast.info(
      `Chọn bàn ${desk.row}-${desk.position} (phòng ${roomNumber}) để gửi cấu hình`,
      { autoClose: 2000 }
    )
  }

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId)

  // Organize desks by row
  const organizeDesksByRow = (desks) => {
    const rows = {}
    desks?.forEach((desk) => {
      if (!rows[desk.row]) {
        rows[desk.row] = []
      }
      rows[desk.row].push(desk)
    })
    Object.keys(rows).forEach((row) => {
      rows[row].sort((a, b) => a.position - b.position)
    })
    return rows
  }

  const desksByRow = organizeDesksByRow(selectedRoom?.desks || [])

  const getUsageTime = (desk) => {
    if (!desk.occupancyStatus || !desk.occupancyStartTime) return 0
    const startTime = new Date(desk.occupancyStartTime)
    const now = new Date()
    return Math.floor((now - startTime) / 60000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải bảng điều khiển...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">Bảng Điều Khiển Quản Trị</h2>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 font-medium border-b-2 transition whitespace-nowrap ${activeTab === "overview"
            ? "border-blue-600 text-blue-600"
            : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
        >
          Tổng Quan
        </button>
        <button
          onClick={() => setActiveTab("desks")}
          className={`px-4 py-2 font-medium border-b-2 transition whitespace-nowrap ${activeTab === "desks"
            ? "border-blue-600 text-blue-600"
            : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
        >
          Quản Lý Bàn
        </button>
        <button
          onClick={() => setActiveTab("config")}
          className={`px-4 py-2 font-medium border-b-2 transition whitespace-nowrap ${activeTab === "config"
            ? "border-blue-600 text-blue-600"
            : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
        >
          Cấu Hình
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-4 py-2 font-medium border-b-2 transition whitespace-nowrap ${activeTab === "reports"
            ? "border-blue-600 text-blue-600"
            : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
        >
          Báo Cáo Năng Lượng
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Tổng Số Bàn</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalDesks}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Bàn Đã Dùng</p>
              <p className="text-3xl font-bold text-red-600">{stats.occupiedDesks}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Tỷ Lệ Chiếm Dụng</p>
              <p className="text-3xl font-bold text-blue-600">{stats.occupancyRate}%</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Tổng Điện Năng</p>
              <p className="text-3xl font-bold text-green-600">{stats.totalEnergyWh} Wh</p>
            </div>
          </div>

          {/* Room Overview */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Tổng Quan Phòng Học</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {rooms.map((room) => {
                const occupied = room.desks?.filter((d) => d.occupancyStatus).length || 0
                const total = room.desks?.length || 0
                const energy = room.desks?.reduce((sum, d) => sum + d.energyConsumedWh, 0) || 0
                return (
                  <div
                    key={room.id}
                    className="border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition"
                  >
                    {/* Room title */}
                    <h4 className="font-semibold text-gray-900 mb-3">
                      {room.name}
                    </h4>

                    {/* Usage & Energy */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Sử dụng</span>
                        <span className="font-semibold text-gray-900">
                          {occupied}/{total}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Năng lượng</span>
                        <span className="font-semibold text-gray-900">
                          {energy.toFixed(1)} Wh
                        </span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gray-100 my-3" />

                    {/* Environment */}
                    <div className="flex gap-3">
                      {/* Temperature */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm">
                        <Thermometer className="w-4 h-4" />
                        <span className="font-medium">
                          {room.currentTemperature != null
                            ? `${room.currentTemperature.toFixed(1)}°C`
                            : '--'}
                        </span>
                      </div>

                      {/* Humidity */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm">
                        <Droplets className="w-4 h-4" />
                        <span className="font-medium">
                          {room.currentHumidity != null
                            ? `${room.currentHumidity.toFixed(1)}%`
                            : '--'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Desks Tab */}
      {activeTab === "desks" && (
        <div className="space-y-6">
          {/* Room Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Chọn Phòng</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {rooms.map((room) => {
                const roomOccupied = room.desks?.filter((d) => d.occupancyStatus).length || 0
                const roomTotal = room.desks?.length || 0
                return (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`text-left p-4 rounded-xl border transition flex flex-col gap-2 ${selectedRoomId === room.id
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-gray-900">{room.name}</div>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${selectedRoomId === room.id ? "bg-white text-blue-700" : "bg-gray-200 text-gray-700"
                          }`}
                      >
                        {roomOccupied}/{roomTotal} bàn
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Thermometer className="w-4 h-4 text-red-500" />
                        <span>{room.currentTemperature != null ? `${room.currentTemperature.toFixed(1)}°C` : "--°C"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <span>{room.currentHumidity != null ? `${room.currentHumidity.toFixed(1)}%` : "--%"}</span>
                      </div>
                    </div>

                    <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 via-amber-400 to-red-500"
                        style={{ width: `${Math.min(Math.max((room.currentTemperature ?? 0) * 2, 0), 100)}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedRoom && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                {/* Title */}
                <h3 className="text-lg font-semibold text-gray-900">
                  Điều Khiển Bàn
                  <span className="ml-1 text-gray-500 font-medium">
                    – {selectedRoom.name}
                  </span>
                </h3>

                {/* Environment */}
                <div className="flex gap-2">
                  {/* Temperature */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm">
                    <Thermometer className="w-4 h-4" />
                    <span className="font-medium">
                      {selectedRoom.currentTemperature != null
                        ? `${selectedRoom.currentTemperature.toFixed(1)}°C`
                        : '--'}
                    </span>
                  </div>

                  {/* Humidity */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm">
                    <Droplets className="w-4 h-4" />
                    <span className="font-medium">
                      {selectedRoom.currentHumidity != null
                        ? `${selectedRoom.currentHumidity.toFixed(1)}%`
                        : '--'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((rowNum) => (
                  <div key={rowNum} className="bg-gray-50 border rounded-lg p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-700">Dãy {rowNum}</div>
                      <div className="text-xs text-gray-500">
                        {desksByRow[rowNum]?.length || 0} bàn
                      </div>
                    </div>

                    <div className="space-y-2">
                      {desksByRow[rowNum]?.length ? (
                        desksByRow[rowNum].map((desk) => {
                          const usageTime = getUsageTime(desk)
                          return (
                            <div
                              key={desk.id}
                              className={`p-3 rounded-lg border-2 transition ${desk.occupancyStatus
                                  ? "bg-red-50 border-red-300"
                                  : "bg-green-50 border-green-300"
                                }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-gray-700">
                                  Bàn {desk.row}-{desk.position}
                                </span>
                                {desk.lightStatus && (
                                  <Lightbulb className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                )}
                              </div>

                              {desk.occupancyStatus && (
                                <div className="flex items-center gap-1 text-xs text-red-700 mb-1">
                                  <User className="w-3 h-3" />
                                  <span>Đang dùng</span>
                                </div>
                              )}

                              {usageTime > 0 && (
                                <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                                  <Clock className="w-3 h-3" />
                                  <span>{usageTime} phút</span>
                                </div>
                              )}
                              {desk.disabled && (
                                <div className="text-xs text-amber-700 mb-2 font-semibold">
                                  Đang vô hiệu hóa
                                </div>
                              )}

                              <div className="flex flex-wrap gap-1">
                                <button
                                  onClick={() => handleToggleLight(desk.id)}
                                  disabled={togglingDesks.has(desk.id)}
                                  className={`flex-1 px-2 py-1 text-xs rounded transition flex items-center justify-center gap-1 ${togglingDesks.has(desk.id)
                                      ? "bg-gray-400 text-gray-600 cursor-not-allowed opacity-75"
                                      : desk.disabled
                                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                                        : "bg-red-100 text-red-800 hover:bg-red-200"
                                    }`}
                                  title={desk.disabled ? "Kích hoạt bàn" : "Vô hiệu hóa bàn"}
                                >
                                  {togglingDesks.has(desk.id) ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      <span>Đang xử lý...</span>
                                    </>
                                  ) : (
                                    <span>{desk.disabled ? "Kích hoạt" : "Vô hiệu hóa"}</span>
                                  )}
                                </button>
                                <button
                                  onClick={() => handlePrefillFromDesk(desk, selectedRoom.roomNumber)}
                                  className="px-2 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 transition"
                                  title="Chọn bàn này để gửi cấu hình ESP32"
                                >
                                  ESP32
                                </button>
                                <button
                                  onClick={() => setSelectedDesk(desk)}
                                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                                  title="Cấu hình bàn"
                                >
                                  <Settings className="w-3 h-3" />
                                </button>
                              </div>
                              {desk.esp32DeviceId && (
                                <div className="text-xs text-blue-600 mt-1 font-semibold"></div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <div className="text-xs text-gray-500 border rounded-md px-3 py-2 bg-white">
                          Chưa có bàn trong dãy này
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Desk Config Modal */}
          {selectedDesk && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Cấu Hình Bàn {selectedDesk.row}-{selectedDesk.position}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Công suất đèn (W)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={selectedDesk.lampPowerW}
                      className="w-full px-3 py-2 border rounded-lg"
                      id="lampPowerW"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Độ nhạy cảm biến (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={selectedDesk.distanceSensitivity}
                      className="w-full px-3 py-2 border rounded-lg"
                      id="distanceSensitivity"
                    />
                  </div>

                  <div className="text-sm text-gray-600">
                    <p>Năng lượng tiêu thụ: {selectedDesk.energyConsumedWh.toFixed(2)} Wh</p>
                    <p>Thời gian sử dụng: {selectedDesk.totalUsageMinutes} phút</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => setSelectedDesk(null)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      const lampPowerW = parseFloat(document.getElementById("lampPowerW").value)
                      const distanceSensitivity = parseFloat(document.getElementById("distanceSensitivity").value)
                      handleUpdateDeskConfig(selectedDesk.id, { lampPowerW, distanceSensitivity })
                    }}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {saving ? "Đang lưu..." : "Lưu"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Config Tab */}
      {activeTab === "config" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Cấu Hình ESP32
            </h3>

            <div className="space-y-4">
              {/* Location Configuration */}
              <div className="border-t pt-4">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Vị trí ESP32</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phòng (Room)</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={esp32Config.room || ""}
                      onChange={(e) => setEsp32Config({ ...esp32Config, room: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="1-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dãy (Row)</label>
                    <input
                      type="number"
                      min="1"
                      max="4"
                      value={esp32Config.row || ""}
                      onChange={(e) => setEsp32Config({ ...esp32Config, row: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="1-4"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bàn (Table)</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={esp32Config.table || ""}
                      onChange={(e) => setEsp32Config({ ...esp32Config, table: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="1-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Device ID (tùy chọn)</label>
                    <input
                      type="text"
                      value={esp32Config.deviceId || ""}
                      onChange={(e) => setEsp32Config({ ...esp32Config, deviceId: e.target.value || null })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="ESP32-xxx"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Cấu hình vị trí hiện tại của ESP32 (topic: esp32/abc/config). Có thể để trống nếu chỉ cập nhật thông số khác.
                </p>
              </div>
              {/* Device Configuration */}
              <div className="border-t pt-4">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Cấu Hình Thiết Bị</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tần số lấy mẫu HC-SR04 (fs1)
                  </label>
                  <input
                    type="number"
                    value={esp32Config.fs1}
                    onChange={(e) => setEsp32Config({ ...esp32Config, fs1: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tần số lấy mẫu BH1750 (fs2)
                  </label>
                  <input
                    type="number"
                    value={esp32Config.fs2}
                    onChange={(e) => setEsp32Config({ ...esp32Config, fs2: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tần số lấy mẫu DHT (fs3)
                  </label>
                  <input
                    type="number"
                    value={esp32Config.fs3}
                    onChange={(e) => setEsp32Config({ ...esp32Config, fs3: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ngưỡng phát hiện người (cm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={esp32Config.distanceCm}
                    onChange={(e) => setEsp32Config({ ...esp32Config, distanceCm: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Bật đèn: &gt; 2000, Tắt đèn: 0
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chu kỳ gửi dữ liệu (ms)
                  </label>
                  <input
                    type="number"
                    value={esp32Config.duration}
                    onChange={(e) => setEsp32Config({ ...esp32Config, duration: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <button
                onClick={handleUpdateESP32Config}
                disabled={saving}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? "Đang lưu..." : "Lưu Cấu Hình"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          {/* Monthly Report Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Báo Cáo Điện Năng Tiêu Thụ Theo Tháng
            </h3>

            {/* Month Selector and Controls */}
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
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* View Mode Toggle */}
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

            {/* Monthly Report Data */}
            {monthlyReport?.selectedMonth ? (
              <div className="space-y-6">
                {/* Summary */}
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

                {/* By Room or Total View */}
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

                {/* Desk Daily Detail */}
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

                {/* Compare Chart */}
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

          {/* Legacy Total Report (keep for backward compatibility) */}
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
      )}
    </div>
  )
}

// Daily desk chart component
function DailyDeskEnergyChart({ report }) {
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

// Monthly Comparison Chart Component
function MonthlyComparisonChart({ selectedMonth, compareMonths }) {
  // Prepare data for bar chart (by room comparison)
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

  // Prepare data for line chart (total energy trend)
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
      {/* Bar Chart - By Room */}
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

      {/* Line Chart - Total Trend */}
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





