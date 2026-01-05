import { useEffect, useState } from "react"
import axios from "axios"
import UserDeskLayout from "./user/UserDeskLayout"
import UserRoomSelection from "./user/UserRoomSelection"
import UserStatsCards from "./user/UserStatsCards"

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api"

export default function UserDashboard() {
  const [rooms, setRooms] = useState([])
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await axios.get(`${API_BASE}/rooms`)
        setRooms(response.data)
        if (response.data.length > 0 && !selectedRoomId) {
          setSelectedRoomId(response.data[0].id)
        }
      } catch (error) {
        console.error("Lỗi tải phòng:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRooms()
    const interval = setInterval(fetchRooms, 5000)
    return () => clearInterval(interval)
  }, [selectedRoomId])

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    )
  }

  const occupiedCount = selectedRoom?.desks?.filter((d) => d.occupancyStatus).length || 0
  const totalDesks = selectedRoom?.desks?.length || 0

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Tình Trạng Phòng Học</h2>
      </div>

      <UserStatsCards
        selectedRoom={selectedRoom}
        occupiedCount={occupiedCount}
        totalDesks={totalDesks}
      />

      <UserRoomSelection
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        setSelectedRoomId={setSelectedRoomId}
      />

      <UserDeskLayout
        selectedRoom={selectedRoom}
        desksByRow={desksByRow}
        getUsageTime={getUsageTime}
      />
    </div>
  )
}
