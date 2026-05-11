import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import { WorkflowPlaceholders } from '@/components/WorkflowPlaceholders';
import AdminPage from '@/pages/AdminPage';
import IosVersionenPage from '@/pages/IosVersionenPage';
import GeraetePage from '@/pages/GeraetePage';
import FehlerberichtePage from '@/pages/FehlerberichtePage';
import FehlerbehebungPage from '@/pages/FehlerbehebungPage';
import PublicFormIosVersionen from '@/pages/public/PublicForm_IosVersionen';
import PublicFormGeraete from '@/pages/public/PublicForm_Geraete';
import PublicFormFehlerberichte from '@/pages/public/PublicForm_Fehlerberichte';
import PublicFormFehlerbehebung from '@/pages/public/PublicForm_Fehlerbehebung';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a01f2691f0ec566018b68a7" element={<PublicFormIosVersionen />} />
              <Route path="public/6a01f2712fbe920228001854" element={<PublicFormGeraete />} />
              <Route path="public/6a01f27386a0e488786a9877" element={<PublicFormFehlerberichte />} />
              <Route path="public/6a01f275a49057ebfe7b5d5e" element={<PublicFormFehlerbehebung />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<><div className="mb-8"><WorkflowPlaceholders /></div><DashboardOverview /></>} />
                <Route path="ios-versionen" element={<IosVersionenPage />} />
                <Route path="geraete" element={<GeraetePage />} />
                <Route path="fehlerberichte" element={<FehlerberichtePage />} />
                <Route path="fehlerbehebung" element={<FehlerbehebungPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
