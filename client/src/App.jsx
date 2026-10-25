import { Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import JobsPage from './pages/JobsPage';
import JobDetailsPage from './pages/JobDetailsPage';
import ApplicationsPage from './pages/ApplicationsPage';
import RecruiterJobsPage from './pages/RecruiterJobsPage';
import RecruiterApprovalPage from './pages/RecruiterApprovalPage';
import RecruiterApplicantsPage from './pages/RecruiterApplicantsPage';
import StudentProfilePage from './pages/StudentProfilePage';
import AlumniDirectoryPage from './pages/AlumniDirectoryPage';
import AlumniProfilePage from './pages/AlumniProfilePage';
import MentorshipRequestsPage from './pages/MentorshipRequestsPage';
import PlacementAnalyticsPage from './pages/PlacementAnalyticsPage';
import NotificationsPage from './pages/NotificationsPage';
import StudentManagementPage from './pages/StudentManagementPage';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/jobs" element={<JobsPage />} />
      <Route path="/jobs/:jobId" element={<JobDetailsPage />} />
      <Route path="/alumni" element={<AlumniDirectoryPage />} />
      <Route
        path="/alumni/me"
        element={
          <ProtectedRoute allowedRoles={['ALUMNI']}>
            <AlumniProfilePage />
          </ProtectedRoute>
        }
      />
      <Route path="/alumni/:alumniId" element={<AlumniProfilePage />} />
      <Route
        path="/mentorship-requests"
        element={
          <ProtectedRoute allowedRoles={['STUDENT', 'ALUMNI']}>
            <MentorshipRequestsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute allowedRoles={['STUDENT', 'RECRUITER', 'PLACEMENT_OFFICER', 'ALUMNI']}>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/applications"
        element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <ApplicationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <StudentProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruiter/jobs"
        element={
          <ProtectedRoute allowedRoles={['RECRUITER']}>
            <RecruiterJobsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruiter/jobs/:jobId/applications"
        element={
          <ProtectedRoute allowedRoles={['RECRUITER']}>
            <RecruiterApplicantsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/recruiters"
        element={
          <ProtectedRoute allowedRoles={['PLACEMENT_OFFICER']}>
            <RecruiterApprovalPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students"
        element={
          <ProtectedRoute allowedRoles={['PLACEMENT_OFFICER']}>
            <StudentManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute allowedRoles={['PLACEMENT_OFFICER']}>
            <PlacementAnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['STUDENT', 'RECRUITER', 'PLACEMENT_OFFICER', 'ALUMNI']}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<div className="p-6 text-center text-slate-800">Page not found</div>} />
    </Routes>
  );
}
