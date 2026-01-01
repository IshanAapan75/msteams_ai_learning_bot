import { createBrowserRouter } from "react-router-dom";
import { Dashboard } from "../pages/Dashboard";
import { Leaderboard } from "../pages/Leaderboard";
import { Assessment } from "../pages/Assessment";
import { UsageLog } from "../pages/UsageLog";
import { Badges } from "../pages/Badges";
import { Welcome } from "../pages/Welcome";
import { Home } from "../pages/Home";
import { SignIn } from "../pages/SignIn";
import { TeamDashboard } from "../pages/TeamDashboard";
import { Layout } from "../components/Layout";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "home", Component: Home },
      { path: "sign-in", Component: SignIn },
      { path: "welcome", Component: Welcome },
      { path: "team-dashboard", Component: TeamDashboard },
      { path: "leaderboard", Component: Leaderboard },
      { path: "assessment", Component: Assessment },
      { path: "usage-log", Component: UsageLog },
      { path: "badges", Component: Badges },
    ],
  },
]);