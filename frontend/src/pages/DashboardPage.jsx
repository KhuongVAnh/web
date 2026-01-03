import { useState } from "react"
import { useNavigate } from "react-router-dom"
import UserDashboard from "../components/UserDashboard"
import AdminDashboard from "../components/AdminDashboard"
import { LogOut, Menu } from "lucide-react"

export default function DashboardPage({ userRole, onLogout }) {
  const [activeTab, setActiveTab] = useState(userRole === "admin" ? "overview" : "rooms")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = () => {
    onLogout()
    navigate("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <div>
                <h1 className="text-xl font-bold text-gray-900">quản lý bàn học thư viện</h1>
                <p className="text-xs text-gray-500">
                  {userRole === "admin" ? "👨‍💼 Quản Trị Viên" : "👤 Sinh Viên"}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              Đăng Xuất
            </button>

            <button
              className="sm:hidden p-2 hover:bg-gray-100 rounded"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="sm:hidden pb-4 border-t">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded"
              >
                Đăng Xuất
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {userRole === "admin" ? (
          <AdminDashboard activeTab={activeTab} setActiveTab={setActiveTab} />
        ) : (
          <UserDashboard />
        )}
      </div>

      <footer className="border-t bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-600">
          {/* <p>Hệ Thống quản lý bàn học thư viện Thư Viện v1.0 | Theo dõi số lượng và năng lượng real-time</p> */}
        </div>
      </footer>
    </div>
  )
}

