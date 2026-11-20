/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilPage } from './pages/ProfilPage';
import { AdministrasiPlaceholderPage } from './pages/AdministrasiPlaceholderPage';

function ProtectedShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedShell>
                  <DashboardPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/profil"
              element={
                <ProtectedShell>
                  <ProfilPage />
                </ProtectedShell>
              }
            />

            <Route
              path="/administrasi/modul-ajar"
              element={
                <ProtectedShell>
                  <AdministrasiPlaceholderPage name="Modul Ajar/RPM" />
                </ProtectedShell>
              }
            />
            <Route
              path="/administrasi/analisis-cp"
              element={
                <ProtectedShell>
                  <AdministrasiPlaceholderPage name="Analisis CP, TP dan ATP" />
                </ProtectedShell>
              }
            />
            <Route
              path="/administrasi/lkpd"
              element={
                <ProtectedShell>
                  <AdministrasiPlaceholderPage name="Generator LKPD" />
                </ProtectedShell>
              }
            />
            <Route
              path="/administrasi/kokurikuler"
              element={
                <ProtectedShell>
                  <AdministrasiPlaceholderPage name="Modul Kokurikuler" />
                </ProtectedShell>
              }
            />
            <Route
              path="/administrasi/generator-soal"
              element={
                <ProtectedShell>
                  <AdministrasiPlaceholderPage name="Generator Soal" />
                </ProtectedShell>
              }
            />
            <Route
              path="/administrasi/bank-soal"
              element={
                <ProtectedShell>
                  <AdministrasiPlaceholderPage name="Bank Soal" />
                </ProtectedShell>
              }
            />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
