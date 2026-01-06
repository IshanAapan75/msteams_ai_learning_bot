# Implementation Guide: Microsoft Graph Integration for Hierarchy

## Context
To enable the hierarchical Team Dashboard (Reporter View), the application needs to know the `managerId` and `teamId` (Department) for each user. This information is available in Microsoft Entra ID (formerly Azure AD) but requires querying the Microsoft Graph API.

## Pre-requisites
1.  **Azure App Registration:** The existing bot registration must be updated.
2.  **API Permissions:** Add `User.Read.All` and `User.ReadBasic.All` (Delegated or Application permissions) to the App Registration in Azure Portal.

## Implementation Steps

### 1. Token Acquisition (On-Behalf-Of Flow)
The Bot or Tab frontend must acquire an access token for the user.
*   **Bot:** Use `TeamsInfo.getMember` (limited) or implement an OAuth Prompt card to get a Graph Token.
*   **Tab:** Use `microsoftTeams.authentication.getAuthToken()` to get an ID token, then exchange it server-side for a Graph Access Token.

### 2. Backend Graph Service
Create a service `lib/graph.js` to handle calls.

```javascript
// Example: Fetch Manager
async function getManager(accessToken) {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/manager", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    return await response.json();
}

// Example: Fetch Department (Team)
async function getProfile(accessToken) {
    const response = await fetch("https://graph.microsoft.com/v1.0/me?$select=department,jobTitle", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    return await response.json();
}
```

### 3. User Profile Sync
Update the `POST /api/auth/login` or the Bot's `ensureUserExists` flow.
*   **Trigger:** When a user first logs in or interacts with the bot.
*   **Action:** Call Graph API to fetch `manager.id` and `department`.
*   **Storage:** Save these values into the `users` container in Cosmos DB.

```javascript
// user record update
{
    id: "user-123",
    // ... existing fields
    managerId: "manager-456", // From Graph 'id' of manager
    teamId: "Marketing"       // From Graph 'department'
}
```

### 4. Direct Reports Sync (Optional but Recommended)
To accurately build the "Downline" without waiting for every single employee to log in:
*   Run a nightly job (using a Logic App or Azure Function).
*   Fetch `GET /users/{managerId}/directReports`.
*   Pre-populate the `users` database with these relationships.

## Immediate Workaround (MVP Pilot)
For the pilot phase without Graph integration:
1.  **CSV Import:** Admin uploads a CSV mapping `Email` -> `ManagerEmail` -> `Team`.
2.  **Script:** A Node.js script iterates this CSV and updates the Cosmos DB `users` container.
