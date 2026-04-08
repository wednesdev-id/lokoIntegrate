import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Routes, Route } from "react-router-dom"
import axios from "axios"
import { SessionProvider } from "./contexts/SessionContext"
import { ContactsProvider } from "./contexts/ContactsContext"
import WhatsAppLayout from "./components/layout/WhatsAppLayout"
import Dashboard from "./pages/Dashboard"
import WhatsApp from "./pages/WhatsApp"
import Settings from "./pages/Settings"
import Profile from "./pages/Profile"
import Login from "./pages/Login"
import Register from "./pages/Register"
import LandingPage from "./pages/LandingPage"
import ProtectedRoute from "./components/layout/ProtectedRoute"
import UserManagement from "./pages/UserManagement"
import UserDetail from "./pages/UserDetail"
import SubscriptionPackages from "./pages/SubscriptionPackages"
import LicenseGenerator from "./pages/LicenseGenerator"
import SubscriptionReports from "./pages/SubscriptionReports"
import Revenue from "./pages/Revenue"
import PaymentHistory from "./pages/PaymentHistory"
import ProductList from "./pages/inventory/ProductList"
import OrderList from "./pages/inventory/OrderList"
import PaymentList from "./pages/sales/PaymentList"
import RevenueDashboard from "./pages/sales/RevenueDashboard"
import MasterDataContact from "./pages/MasterDataContact"
import Transactions from "./pages/sales/Transactions"
import SubscriptionTransactions from "./pages/SubscriptionTransactions";
import Invoices from "./pages/Invoices";
import About from "./pages/About";



import { UserProvider } from "./contexts/UserContext"
import { SubscriptionGuard } from "./components/common/SubscriptionGuard"
import { ToastProvider } from "./components/common/ToastProvider"

// Global axios interceptor: inject JWT auth token into all API requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <UserProvider>
          <SessionProvider>
            <ContactsProvider>
              <Routes>
              {/* Landing Page (Public) */}
               <Route path="/" element={<LandingPage />} />
               <Route path="/about" element={<About />} />
               <Route path="/login" element={<Login />} />
               <Route path="/register" element={<Register />} />

              {/* Main App Routes wrapped in Layout */}
              <Route element={<ProtectedRoute />}>
                <Route element={
                  <SubscriptionGuard>
                    <WhatsAppLayout />
                  </SubscriptionGuard>
                }>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/whatsapp/*" element={<WhatsApp />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/users" element={<UserManagement />} />
                  <Route path="/users/:id" element={<UserDetail />} />
                  <Route path="/subscriptions" element={<SubscriptionPackages />} />
                  <Route path="/licenses" element={<LicenseGenerator />} />
                  <Route path="/reports" element={<SubscriptionReports />} />
                  <Route path="/revenue" element={<Revenue />} />
                  <Route path="/payment-history" element={<PaymentHistory />} />
                  <Route path="/inventory/products" element={<ProductList />} />
                  <Route path="/inventory/orders" element={<OrderList />} />
                  <Route path="/sales/revenue" element={<RevenueDashboard />} />
                  <Route path="/sales/payments" element={<PaymentList />} />
                  <Route path="/sales/transactions" element={<Transactions />} />
                  <Route path="/master-data/contacts" element={<MasterDataContact />} />
                  <Route path="/super-admin/transactions" element={<SubscriptionTransactions />} />
                  <Route path="/super-admin/invoices" element={<Invoices />} />
                </Route>

              </Route>
            </Routes>
          </ContactsProvider>
        </SessionProvider>
      </UserProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App