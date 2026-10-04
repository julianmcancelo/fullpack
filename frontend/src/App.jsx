import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ConnectionBanner from './components/ConnectionBanner';
import CommandPalette from './components/CommandPalette';
import MobileBottomNav from './components/MobileBottomNav';
import BarcodeScannerModal from './components/BarcodeScannerModal';
import Dashboard from './pages/Dashboard';
import StockManager from './pages/StockManager';
import OrdersManager from './pages/OrdersManager';
import ShipmentsManager from './pages/ShipmentsManager';
import QuestionsManager from './pages/QuestionsManager';
import FeeCalculator from './pages/FeeCalculator';
import MobileTerminal from './pages/MobileTerminal';
import Settings from './pages/Settings';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [connection, setConnection] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_success')) {
      setActiveTab('settings');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loadConnectionStatus = async () => {
    try {
      const status = await api.getStatus();
      setConnection(status);
    } catch (err) {
      console.error('Error fetching connection status:', err);
      setConnection({ connected: false });
    }
  };

  const loadDashboardStats = async () => {
    try {
      setLoadingStats(true);
      const [data, shipRes] = await Promise.all([
        api.getDashboardStats().catch(() => null),
        api.getShipments().catch(() => ({ results: [] })),
      ]);
      if (data) setStats(data);
      if (shipRes?.results) setShipments(shipRes.results);
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const refreshAll = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        loadConnectionStatus(),
        loadDashboardStats(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-yellow-400 selection:text-slate-950">
      
      {/* Universal Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={commandOpen}
        onClose={setCommandOpen}
        onNavigate={setActiveTab}
        connection={connection}
      />

      {/* Floating Global Barcode/QR Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        shipments={shipments}
        onShipmentPacked={() => loadDashboardStats()}
      />

      {/* Top Header */}
      <Navbar
        connection={connection}
        onRefresh={refreshAll}
        refreshing={refreshing}
        onNavigate={setActiveTab}
        onOpenCommand={setCommandOpen}
      />

      {/* Main App Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row pb-16 md:pb-0">
        
        {/* Desktop Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          connection={connection}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 min-w-0">
          
          {/* Show connection warning if not connected and not on settings page */}
          {!connection?.connected && activeTab !== 'settings' && (
            <ConnectionBanner onGoToSettings={() => setActiveTab('settings')} />
          )}

          {activeTab === 'dashboard' && (
            <Dashboard
              stats={stats}
              loading={loadingStats}
              onNavigate={setActiveTab}
              onRefresh={loadDashboardStats}
              connection={connection}
            />
          )}

          {activeTab === 'stock' && (
            <StockManager
              connection={connection}
              onRefreshData={loadDashboardStats}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersManager connection={connection} />
          )}

          {activeTab === 'shipments' && (
            <ShipmentsManager connection={connection} />
          )}

          {activeTab === 'mobile_terminal' && (
            <MobileTerminal connection={connection} />
          )}

          {activeTab === 'questions' && (
            <QuestionsManager connection={connection} />
          )}

          {activeTab === 'calculator' && (
            <FeeCalculator />
          )}

          {activeTab === 'settings' && (
            <Settings
              connection={connection}
              onRefreshStatus={loadConnectionStatus}
              onRefreshAllData={refreshAll}
            />
          )}

        </main>

      </div>

      {/* Dedicated Native-style Bottom Mobile Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScanner={() => setScannerOpen(true)}
      />

    </div>
  );
}
