export default function AdminTabs({ activeTab, setActiveTab }) {
  return (
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
  )
}
