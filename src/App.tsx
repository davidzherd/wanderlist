import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LocationProvider } from './context/LocationContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LandingView } from './views/Landing'
import { AuthView } from './views/Auth'
import { HomeMapView } from './views/HomeMap'
import { TripBuilderView } from './views/TripBuilder'

export default function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
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
          </Routes>
        </BrowserRouter>
      </LocationProvider>
    </AuthProvider>
  )
}
