import { Routes, Route } from "react-router-dom";
import { WalletProvider } from "./components/wallet/WalletProvider";
import { ToastProvider } from "./context/ToastContext";
import { StablecoinProvider } from "./context/StablecoinContext";
import { Layout } from "./components/layout/Layout";
import { ToastContainer } from "./components/shared/Toast";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { Dashboard } from "./components/dashboard/Dashboard";
import { CreateForm } from "./components/create/CreateForm";
import { LoadForm } from "./components/load/LoadForm";
import { OperationsPage } from "./pages/Operations";
import { RolesPage } from "./pages/Roles";
import { CompliancePage } from "./pages/Compliance";
import { useNetwork } from "./hooks/useNetwork";

export default function App() {
  const { network, setNetwork, endpoint } = useNetwork();

  return (
    <WalletProvider endpoint={endpoint}>
      <ToastProvider network={network}>
        <StablecoinProvider>
          <Layout network={network} onNetworkChange={setNetwork}>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/create" element={<CreateForm />} />
                <Route path="/load" element={<LoadForm />} />
                <Route path="/operations" element={<OperationsPage />} />
                <Route path="/roles" element={<RolesPage />} />
                <Route path="/compliance" element={<CompliancePage />} />
              </Routes>
            </ErrorBoundary>
          </Layout>
          <ToastContainer />
        </StablecoinProvider>
      </ToastProvider>
    </WalletProvider>
  );
}
