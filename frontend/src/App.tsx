import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { CompaniesList, CompanyDetail } from "./pages/Companies";
import { PeopleList, PersonDetail } from "./pages/People";
import { JobsList, JobDetail } from "./pages/Jobs";
import Pipeline from "./pages/Pipeline";
import Placements from "./pages/Placements";
import Search from "./pages/Search";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/companies" element={<CompaniesList />} />
          <Route path="/companies/:id" element={<CompanyDetail />} />
          <Route path="/people" element={<PeopleList />} />
          <Route path="/people/:id" element={<PersonDetail />} />
          <Route path="/jobs" element={<JobsList />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/placements" element={<Placements />} />
          <Route path="/search" element={<Search />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
