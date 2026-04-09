import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './pages/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { RacesPage } from './pages/RacesPage';
import { ManageSeasonPage } from './pages/ManageSeasonPage';
import { RaceEntryPage } from './pages/RaceEntryPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { StatsPage } from './pages/StatsPage';
import { ArchivedSeasonStatsPage } from './pages/ArchivedSeasonStatsPage';
import { TrophyRoomPage } from './pages/TrophyRoomPage';
import { SettingsPage } from './pages/SettingsPage';
import { CreateLeaguePage } from './pages/settings/CreateLeaguePage';
import { JoinLeaguePage } from './pages/settings/JoinLeaguePage';
import { LeagueDetailPage } from './pages/settings/LeagueDetailPage';
import { ScoringEditorPage } from './pages/settings/ScoringEditorPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/app/races" replace />} />
            <Route path="races" element={<RacesPage />} />
            <Route path="races/manage/:seasonId" element={<ManageSeasonPage />} />
            <Route path="races/:raceId" element={<RaceEntryPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="stats/season/:seasonId" element={<ArchivedSeasonStatsPage />} />
            <Route path="trophy-room" element={<TrophyRoomPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/league/create" element={<CreateLeaguePage />} />
            <Route path="settings/league/join" element={<JoinLeaguePage />} />
            <Route path="settings/league/:leagueId" element={<LeagueDetailPage />} />
            <Route path="settings/scoring/:leagueId" element={<ScoringEditorPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/app/races" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
