import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppStorageBootstrap } from "@/components/app-storage-bootstrap";
import { ViewportMetricsController } from "@/components/viewport-metrics-controller";
import { ThemeController } from "@/components/theme-controller";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { PlanVersionGuard } from "@/components/plan-version-guard";

import HomePage from "@/pages/HomePage";
import WorkoutPage from "@/pages/workout/WorkoutPage";
import WorkoutPushPage from "@/pages/workout/push/WorkoutPushPage";
import WorkoutPullPage from "@/pages/workout/pull/WorkoutPullPage";
import WorkoutLegsPage from "@/pages/workout/legs/WorkoutLegsPage";
import WorkoutSummaryPage from "@/pages/workout/summary/WorkoutSummaryPage";
import ExercisePage from "@/pages/exercise/ExercisePage";
import HistoryPage from "@/pages/history/HistoryPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import ProgressPage from "@/pages/progress/ProgressPage";
import StatisticsPage from "@/pages/statistics/StatisticsPage";
import WeightPage from "@/pages/weight/WeightPage";
import SupportPage from "@/pages/support/SupportPage";

import { appChromeBackground, appPalette } from "@/lib/theme";

const queryClient = new QueryClient();

const bodyStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  minHeight: "var(--app-viewport-height, 100dvh)",
  background: appChromeBackground,
  color: `rgb(var(--app-text-strong-rgb))`,
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
  overflowX: "hidden",
};

const appWrapper: React.CSSProperties = {
  minHeight: "var(--app-viewport-height, 100dvh)",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
  background: appChromeBackground,
  paddingRight: "env(safe-area-inset-right)",
  paddingLeft: "env(safe-area-inset-left)",
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/workout" component={WorkoutPage} />
      <Route path="/workout/push" component={WorkoutPushPage} />
      <Route path="/workout/pull" component={WorkoutPullPage} />
      <Route path="/workout/legs" component={WorkoutLegsPage} />
      <Route path="/workout/summary" component={WorkoutSummaryPage} />
      <Route path="/exercise" component={ExercisePage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/progress" component={ProgressPage} />
      <Route path="/statistics" component={StatisticsPage} />
      <Route path="/weight" component={WeightPage} />
      <Route path="/support" component={SupportPage} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AppStorageBootstrap>
          <div style={bodyStyle}>
            <ViewportMetricsController />
            <ThemeController />
            <ServiceWorkerRegistration />
            <PlanVersionGuard />
            <div style={appWrapper}>
              <Router />
            </div>
          </div>
        </AppStorageBootstrap>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
