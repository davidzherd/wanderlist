import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LocationProvider } from './context/LocationContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthView } from './views/Auth'
import { HomeMapView } from './views/HomeMap'
import { TripBuilderView } from './views/TripBuilder'

export default function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/auth" element={<AuthView />} />
            <Route
              path="/"
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
