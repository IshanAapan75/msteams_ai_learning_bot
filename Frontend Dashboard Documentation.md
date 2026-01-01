# Frontend Dashboard Documentation

This document outlines the architecture, navigation, and purpose of various sections within the AI Transformation Tracker frontend dashboard, located in the `msteams_ai_learning_bot_frontend` directory.

---

## 1. Overview and Tech Stack

The AI Transformation Tracker UI is a React-based single-page application designed to help users track their AI fluency, learning progress, and team performance. It provides personalized dashboards, assessment history, usage logging, leaderboards, and a badge system.

**Key Technologies:**
*   **Framework:** React (with TypeScript)
*   **Build Tool:** Vite
*   **Routing:** React Router DOM
*   **UI Components:** Radix UI (via `shadcn/ui` components), custom UI components.
*   **Styling:** Tailwind CSS (with `class-variance-authority`, `clsx`, `tailwind-merge`)
*   **State Management/Data Fetching:** Custom `useAnalyticsData` hook and `analyticsService` for API interactions.
*   **Charts:** Recharts
*   **Notifications:** Sonner (toast notifications)

---

## 2. Project Structure

The `src` directory organizes the application's source code into logical units:

*   `src/main.tsx`: Application entry point.
*   `src/App.tsx`: Main application component, responsible for routing.
*   `src/pages`: Contains individual page components (e.g., `Home.tsx`, `Dashboard.tsx`, `Assessment.tsx`).
*   `src/components`: Reusable UI components (e.g., `Layout.tsx`, `ui/*` for `shadcn/ui` components).
*   `src/services`: Modules for interacting with backend APIs (e.g., `analytics.ts`, `auth.ts`, `usage.ts`).
*   `src/utils`: Utility functions and configurations (e.g., `routes.tsx`, `api.ts`).
*   `src/types`: TypeScript type definitions for API responses and data structures.
*   `src/hooks`: Custom React hooks (e.g., `useAnalyticsData`).
*   `src/styles`: Global stylesheets.

---

## 3. Application Entry Point & Routing

The application's flow is managed by React Router DOM:

*   **`src/main.tsx`**: This is the application's root. It initializes the React application and renders the `<App />` component.
*   **`src/App.tsx`**: This component sets up the routing using `RouterProvider` from `react-router-dom`. It imports the route configuration from `src/utils/routes.tsx`.
*   **`src/utils/routes.tsx`**: This file defines all the application's routes using `createBrowserRouter`. All main application pages are nested under a root path (`/`) which utilizes the `<Layout />` component for consistent header and main content area.

    ```typescript
    export const router = createBrowserRouter([
      {
        path: "/",
        Component: Layout, // All children routes will be rendered within the Layout
        children: [
          { index: true, Component: Dashboard },      // Default route for "/"
          { path: "home", Component: Home },           // Marketing/Landing page
          { path: "sign-in", Component: SignIn },     // Login page
          { path: "welcome", Component: Welcome },      // Initial welcome/onboarding
          { path: "team-dashboard", Component: TeamDashboard },
          { path: "leaderboard", Component: Leaderboard },
          { path: "assessment", Component: Assessment }, // Quiz attempt history
          { path: "usage-log", Component: UsageLog },   // Log AI usage and view history
          { path: "badges", Component: Badges },         // Badges and levels
        ],
      },
    ]);
    ```

---

## 4. Layout and Navigation (`src/components/Layout.tsx`)

The `<Layout />` component acts as the main shell of the application, providing a consistent header (navbar) and a container for page-specific content.

*   **Header/Navbar:** Contains the application title ("Momentum by AI Champions") and navigation links.
*   **Conditional Navigation:** The navigation links displayed in the navbar are **dynamically rendered based on the user's login status**:
    *   **If not logged in:** Only a "Home" link (to `/home`) is displayed. This directs unauthenticated users to the product's landing page.
    *   **If logged in:** The user sees links to their "Personal Dashboard" (`/`), "Assessment", "Log Usage", "Team Dashboard", "Leaderboard", and "Badges". The explicit "/home" link is not shown to logged-in users.
*   **Main Content Area:** The `<Outlet />` component within the `<main>` tag renders the content of the currently active route (e.g., `Dashboard`, `Home`, `Assessment`).

---

## 5. Page Components & Purpose

Each page component serves a distinct purpose within the application:

### A. `Home` Page (`src/pages/Home.tsx`)
*   **Route:** `/home`
*   **Purpose:** This is the **landing/marketing page** designed for **unauthenticated users**. Its primary goal is to introduce the AI Transformation Tracker, highlight its benefits, showcase key features, and encourage sign-ups.
*   **Content:** Features a hero section with a compelling headline and call-to-actions (CTAs) like "Start today's AI practice" (which redirects to `/sign-in`). It also includes sections explaining the value proposition, how the system works (with mockups), social proof, and team-focused messaging.
*   **Authentication Logic:** If an authenticated user tries to access `/home`, they are automatically redirected to their "Personal Dashboard" (`/`).

### B. `Dashboard` Page (`src/pages/Dashboard.tsx`)
*   **Route:** `/` (This is the default index route when logged in)
*   **Purpose:** This is the **personalized home page for logged-in users**. It provides a dynamic, comprehensive overview of the individual user's AI learning progress, statistics, and recent activity. It serves as the central hub for tracking individual growth.
*   **Content:** Displays:
    *   Welcome message with user's name.
    *   XP progress, current level, XP needed for the next level.
    *   AI Fluency Score and its contributing habits.
    *   Current streak, daily average XP, total lifetime XP.
    *   Summary of recent learning wins (not started, in progress, completed modules).
    *   Quiz activity summary (attempts, passed, pass rate, average score).
    *   Recent AI usage logs/wins.
    *   A prominent "Log AI Usage" button linking to `/usage-log`.
*   **Authentication Logic:** If an unauthenticated user tries to access `/`, they are automatically redirected to `/sign-in`.

### C. `Assessment` Page (`src/pages/Assessment.tsx`)
*   **Route:** `/assessment`
*   **Purpose:** **Displays a history of the user's past quiz attempts.** (This page was refactored from an interactive quiz to a historical log).
*   **Content:**
    *   Lists all quiz attempts made by the user.
    *   For each attempt, it displays:
        *   AI Learning Name (currently a placeholder derived from `quizId`, as full name/topic data needs to be provided by the backend).
        *   Topic (currently a placeholder derived from `quizId`).
        *   Date of the attempt.
        *   Result (e.g., "Passed", "Failed").
        *   Score (e.g., "X / Y").
    *   Includes loading and error states for data fetching.
*   **Authentication Logic:** Redirects to `/sign-in` if the user is not logged in.

### D. `UsageLog` Page (`src/pages/UsageLog.tsx`)
*   **Route:** `/usage-log`
*   **Purpose:** Allows logged-in users to log their recent AI usage (via a form) and review their previous logged usage entries.
*   **Content:**
    *   **Log Usage Form:** A form with fields for "What did you use AI for?", "How much time did you save?", "Confidence in output quality", and an optional "Brief description".
    *   **Conditional Form Visibility:** The form is **only visible** if specific criteria are met for the user's *current* active learning module:
        1.  The current module's learning must be `completed`.
        2.  The quiz for that module must be `passed`.
        3.  At least 1 hour must have passed since the quiz was passed.
        *   If these conditions are not met, a **locked screen** with a lock icon and a descriptive message (`formMessage`) is displayed, indicating what action is required (e.g., "Pass the quiz first", "Wait for cooldown").
    *   **Previous Usage Logs:** A dynamic list displaying past usage logs. For each log:
        *   AI Learning Topic.
        *   Date it was logged.
        *   XP earned (calculated dynamically from `timeSaved` field).
*   **Authentication Logic:** Redirects to `/sign-in` if the user is not logged in.

### E. `TeamDashboard` Page (`src/pages/TeamDashboard.tsx`)
*   **Route:** `/team-dashboard`
*   **Purpose:** Provides an overview of AI transformation progress and analytics at a team level.
*   **Content:** Displays team momentum score, participant count, total team XP, average streak, last team activity, XP by member charts, team activity trends, and fluency component breakdowns. Includes a team selector for managers to view different teams.
*   **Authentication Logic:** Redirects to `/sign-in` if the user is not logged in.

### F. `Leaderboard` Page (`src/pages/Leaderboard.tsx`)
*   **Route:** `/leaderboard`
*   **Purpose:** Displays rankings of teams and individual users based on their AI transformation progress and accumulated XP/momentum.
*   **Content:** Shows an "Org Momentum Score", with a toggle to switch between "Team Rankings" and "Individual Rankings". Displays ranked lists with XP, streaks, and visual progress bars.
*   **Authentication Logic:** Redirects to `/sign-in` if the user is not logged in.

### G. `Badges` Page (`src/pages/Badges.tsx`)
*   **Route:** `/badges`
*   **Purpose:** Showcases a user's earned badges and their progress towards unearned ones, along with their current level and XP progression.
*   **Content:**
    *   **Current Level:** Displays the user's current AI fluency level (e.g., "AI Explorer") and progress towards the next level (XP earned / XP to next level).
    *   **Level Journey:** A list of all defined levels, indicating which are unlocked and the XP required for each.
    *   **Skill Badges, Streak Badges, Productivity Badges:** Separate sections displaying each type of badge. For each badge:
        *   Shows its `name`, `description`, and `icon`.
        *   Indicates if it's `Earned` or `Locked`.
        *   For `Locked` badges, it displays `progressDetail` to show the user's current progress towards earning it (e.g., "Logged 3/5 uses").
    *   Includes loading and error states for data fetching.
*   **Authentication Logic:** Redirects to `/sign-in` if the user is not logged in.

---

## 6. Authentication

*   **`src/services/auth.ts`**: Provides `authService` for managing user sessions (login, logout, getting session status).
*   **`src/pages/SignIn.tsx`**: This is the dedicated login page where users authenticate. Most protected pages will redirect here if an unauthenticated user attempts to access them.

---
