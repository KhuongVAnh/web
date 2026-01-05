import { useEffect, useState } from "react"
import axios from "axios"
import { toast } from "react-toastify"
import AdminConfigTab from "./admin/AdminConfigTab"
import AdminDesksTab from "./admin/AdminDesksTab"
import AdminOverviewTab from "./admin/AdminOverviewTab"
import AdminReportsTab from "./admin/AdminReportsTab"
import AdminTabs from "./admin/AdminTabs"

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
  const [togglingDesks, setTogglingDesks] = useState(new Set())

  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [compareMode, setCompareMode] = useState(false)
  const [compareMonths, setCompareMonths] = useState([])
  const [monthlyReport, setMonthlyReport] = useState(null)
  const [viewMode, setViewMode] = useState("byRoom")
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
    const interval = setInterval(fetchData, 2000)
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
      const response = await axios.get(`${API_BASE}/rooms`)
      setRooms(response.data)
      setSelectedDesk(null)
      toast.success("Cập nhật thành công!", {
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
        },
      )

      toast.success("Cập nhật cấu hình ESP32 thành công!", {
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
        },
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
      { autoClose: 2000 },
    )
  }

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId)

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

      <AdminTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === "overview" && stats && (
        <AdminOverviewTab stats={stats} rooms={rooms} />
      )}

      {activeTab === "desks" && (
        <AdminDesksTab
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          setSelectedRoomId={setSelectedRoomId}
          selectedRoom={selectedRoom}
          desksByRow={desksByRow}
          getUsageTime={getUsageTime}
          handleToggleLight={handleToggleLight}
          togglingDesks={togglingDesks}
          handlePrefillFromDesk={handlePrefillFromDesk}
          selectedDesk={selectedDesk}
          setSelectedDesk={setSelectedDesk}
          saving={saving}
          handleUpdateDeskConfig={handleUpdateDeskConfig}
        />
      )}

      {activeTab === "config" && (
        <AdminConfigTab
          esp32Config={esp32Config}
          setEsp32Config={setEsp32Config}
          handleUpdateESP32Config={handleUpdateESP32Config}
          saving={saving}
        />
      )}

      {activeTab === "reports" && (
        <AdminReportsTab
          energyReport={energyReport}
          monthlyReport={monthlyReport}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          compareMode={compareMode}
          setCompareMode={setCompareMode}
          compareMonths={compareMonths}
          viewMode={viewMode}
          setViewMode={setViewMode}
          handleMonthChange={handleMonthChange}
          handleAddCompareMonth={handleAddCompareMonth}
          handleRemoveCompareMonth={handleRemoveCompareMonth}
          fetchDeskDailyReport={fetchDeskDailyReport}
          deskDailyLoading={deskDailyLoading}
          deskDailyReport={deskDailyReport}
          selectedDeskReportId={selectedDeskReportId}
        />
      )}
    </div>
  )
}
