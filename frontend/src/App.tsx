import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAdmin } from './components/RequireAdmin';
import { RequireAuth } from './components/RequireAuth';
import { AdminBenefits } from './pages/admin/AdminBenefits';
import { AdminForms } from './pages/admin/AdminForms';
import { AdminJikkoPoints } from './pages/admin/AdminJikkoPoints';
import { AdminApprovals } from './pages/admin/AdminApprovals';
import { AdminUsers } from './pages/admin/AdminUsers';
import { FormEditor } from './pages/admin/FormEditor';
import { FormResponses } from './pages/admin/FormResponses';
import { Benefits } from './pages/Benefits';
import { ChangePassword } from './pages/ChangePassword';
import { FormRespond } from './pages/FormRespond';
import { FormsList } from './pages/FormsList';
import { Home } from './pages/Home';
import { JikkoPoints } from './pages/JikkoPoints';
import { MyRequests } from './pages/MyRequests';
import { ForgotPassword } from './pages/ForgotPassword';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { Profile } from './pages/Profile';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/recuperar-clave" element={<ForgotPassword />} />
      <Route path="/restablecer-clave" element={<ResetPassword />} />
      <Route path="/forms/:token" element={<FormRespond />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/cambiar-clave" element={<ChangePassword />} />
          <Route path="/" element={<Home />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/jikkopuntos" element={<JikkoPoints />} />
          <Route path="/mis-solicitudes" element={<MyRequests />} />
          <Route path="/beneficios" element={<Benefits />} />
          <Route path="/formularios" element={<FormsList />} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin/usuarios" element={<AdminUsers />} />
            <Route path="/admin/formularios" element={<AdminForms />} />
            <Route path="/admin/formularios/nuevo" element={<FormEditor />} />
            <Route path="/admin/formularios/:id/respuestas" element={<FormResponses />} />
            <Route path="/admin/formularios/:id" element={<FormEditor />} />
            <Route path="/admin/jikkopuntos" element={<AdminJikkoPoints />} />
            <Route path="/admin/aprobaciones" element={<AdminApprovals />} />
            <Route path="/admin/canje-aprobaciones" element={<Navigate to="/admin/aprobaciones" replace />} />
            <Route path="/admin/beneficios" element={<AdminBenefits />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
