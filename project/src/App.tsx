import HomeDashboard from '@/views/HomeDashboard';
import { useState } from 'react';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SystemUserProvider } from '@/context/SystemUserContext';
import { UnitScopeProvider } from '@/context/UnitScopeContext';
import Layout, { type TabId } from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoginScreen from '@/views/LoginScreen';
import OrgTree from '@/views/OrgTree';
import BattalionView1 from '@/views/BattalionView1'; // עמוד מטה גדוד
import BattalionView2 from '@/views/BattalionView2'; // עמוד מטה גדוד
import Roster from '@/views/Roster';
import Positions from '@/views/Positions';
import ReadinessDashboard from '@/views/ReadinessDashboard';
import QualificationsManagement from '@/views/QualificationsManagement';
import MedicalDashboard from '@/views/MedicalDashboard';
import DriverDashboard from '@/views/DriverDashboard';
import Reports from '@/views/Reports';
import SystemUsersManagement from '@/views/SystemUsersManagement';
import CompanyStructureView from '@/views/CompanyStructureView';
import PositionsOrderManagerView from '@/views/PositionsOrderManagerView';
import PlatoonStructureView from '@/views/PlatoonStructureView';
import PositionQualificationsMatrixView from '@/views/PositionQualificationsMatrixView';
import UnitSummaryView from '@/views/UnitSummaryView';
import UnitPositionsSummaryView from '@/views/UnitPositionsSummaryView';
import UnitQualificationsSummaryView from '@/views/UnitQualificationsSummaryView';
import BulkPositionQualificationsMatrixView from '@/views/BulkPositionQualificationsMatrixView';
import WeaponDashboard from '@/views/WeaponDashboard';
import DavidDashboard from '@/views/DavidDashboard';
import CommandDashboard from '@/views/CommandDashboard';



function AppContent() {
  const auth = useAuth();
 const [activeTab, setActiveTab] = useState<TabId>('home');

  const isAuthenticated = auth.isAuthenticated;
  const loading = auth.loading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-800 animate-pulse" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <SystemUserProvider>
      <UnitScopeProvider>
        <Layout activeTab={activeTab} onTabChange={setActiveTab}>
          {activeTab === 'home' && <HomeDashboard onNavigate={setActiveTab} />}
          {activeTab === 'org-tree' && <OrgTree />}
          {activeTab === 'BattalionView1' && <BattalionView1 />} {/* תואם בדיוק ל-Layout */}
          {activeTab === 'BattalionView2' && <BattalionView2/>}
          {activeTab === 'roster' && <Roster />}
          {activeTab === 'positions' && <Positions />}
          {activeTab === 'readiness' && <ReadinessDashboard />}
          {activeTab === 'qualifications' && <QualificationsManagement />}
          {activeTab === 'medical' && <MedicalDashboard />}
          {activeTab === 'driving' && <DriverDashboard />}
          {activeTab === 'reports' && <Reports />}
          {activeTab === 'system-users' && <SystemUsersManagement />}
          {activeTab === 'company-structure' && <CompanyStructureView />}
          {activeTab === 'positions-order' && <PositionsOrderManagerView />}
          {activeTab === 'qualifications-matrix' && <PositionQualificationsMatrixView />}
          {(activeTab === 'platoon-structure' || activeTab === 'PlatoonStructureView' || activeTab === 'tactical' || activeTab === 'tactical-layout') && <PlatoonStructureView />}  
          {activeTab === 'unit_summary' && <UnitSummaryView />}
          {activeTab === 'unit_Position_summary' && <UnitPositionsSummaryView />}
          {activeTab === 'BulkPositionQualificationsMatrixView' && <BulkPositionQualificationsMatrixView />}
          {activeTab === 'unit_Qualifications_summary' && <UnitQualificationsSummaryView />}
          {activeTab === 'WeaponDashboard' && <WeaponDashboard />}
          {activeTab === 'DavidDashboard' && <DavidDashboard />}
          {activeTab === 'CommandDashboard' && <CommandDashboard />}
        </Layout>
      </UnitScopeProvider>
    </SystemUserProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
