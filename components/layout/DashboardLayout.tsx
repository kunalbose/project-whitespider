import Topbar from "./Topbar";
import Sidebar from "./Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col bg-black text-white">
        <Topbar />
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}
