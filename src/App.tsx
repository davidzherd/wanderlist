import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LocationProvider } from './context/LocationContext'
import { SettingsProvider } from './context/SettingsContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LandingView } from './views/Landing'
import { AuthView } from './views/Auth'
import { HomeMapView } from './views/HomeMap'
import { TripBuilderView } from './views/TripBuilder'
import { SettingsView } from './views/Settings'

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <LocationProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingView />} />
              <Route path="/auth" element={<AuthView />} />
              <Route
                path="/map"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <HomeMapView />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/trips"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <TripBuilderView />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SettingsView />
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </LocationProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}
