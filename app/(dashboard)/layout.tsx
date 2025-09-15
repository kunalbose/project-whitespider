
import '../globals.css';
import DashboardLayout from '@/components/layout/DashboardLayout';


export default function DashboardLayoutLayer({ children }: { children: React.ReactNode }) {

  return (
    <div >
      <DashboardLayout>
            <main style={{ flex: 1 }}>
                {children}
            </main>
      </DashboardLayout>
        </div>
  );
}