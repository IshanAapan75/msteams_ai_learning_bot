# AI Champions Learning Bot

## Description

The AI Champions Learning Bot is a Microsoft Teams application designed to enhance AI fluency across our organization. It provides a personalized learning experience through a conversational bot interface, complete with assessments, interactive modules, and progress tracking. The primary goal is to make learning about AI accessible, engaging, and measurable for all employees.

## Features

- **Personalized Learning Plans:** Delivers tailored learning modules based on an initial skill assessment.
- **Interactive Quizzes:** Engages users with interactive quizzes and knowledge checks.
- **Gamification:** Incorporates a rewards system with Experience Points (XP), learning streaks, and fluency scores to motivate users.
- **Progress Tracking:** Users can view their learning progress and achievements.
- **Manager Dashboard:** A web-based dashboard for managers to view team progress and analytics (Protected).
- **On-Demand Learning:** Users can request learning modules at any time using bot commands.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Bot Framework:** Microsoft Bot Framework
- **Frontend (Dashboard):** Next.js, React
- **Database:** Azure Cosmos DB
- **Authentication:** Custom JWT-based authentication for the web dashboard.
- **Deployment:** Azure Web App, with CI/CD via GitHub Actions.

## Prerequisites

Before you begin, ensure you have the following installed and configured:
- Node.js (v20.x or higher)
- npm (v10.x or higher)
- An active Azure Subscription
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- [ngrok](https://ngrok.com/download) for local development and testing with Teams.

## Installation Steps

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd msteams_ai_learning_bot
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Environment Variables

This project uses environment variables to manage configuration. Create a `.env.dev` file in the `/env` directory and populate it with the necessary values.

```env
# /env/.env.dev

# TeamsFX Environment
TEAMSFX_ENV=dev
APP_NAME_SUFFIX=dev
APP_URL=http://localhost:3000

# Azure Configuration
# Find these values in your Azure portal
AZURE_SUBSCRIPTION_ID=<your-subscription-id>
AZURE_RESOURCE_GROUP_NAME=<your-resource-group-name>
RESOURCE_SUFFIX=

# Bot & Teams App Identifiers (Generated during App Registration)
BOT_ID=<your-bot-id>
TEAMS_APP_ID=<your-teams-app-id>
MicrosoftAppId=<your-bot-id>
MicrosoftAppPassword=<your-bot-secret>
MicrosoftAppType=MultiTenant
MicrosoftAppTenantId=<your-azure-tenant-id>

# Azure OpenAI Credentials
AZURE_OPENAI_ENDPOINT=https://your-instance.openai.azure.com/
AZURE_OPENAI_KEY=<your-openai-api-key>
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4

# Cosmos DB Credentials
COSMOS_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_KEY=<your-cosmos-db-primary-key>
COSMOS_DATABASE=AIChampionsDB
```

## How to Run the Project

1.  **Start the development server:**
    The project uses Next.js for the frontend and an Express server for the bot backend. The `dev` script starts both concurrently.
    ```bash
    npm run dev
    ```
    The application will be running at `http://localhost:3000`.

2.  **Expose your local server with ngrok:**
    Microsoft Teams requires a public HTTPS endpoint to communicate with the bot. Use `ngrok` to create a secure tunnel to your local server.
    ```bash
    ngrok http 3000
    ```
    Copy the HTTPS forwarding URL provided by ngrok (e.g., `https://xxxx-xxxx.ngrok.io`).

3.  **Update the Bot Endpoint in Azure:**
    - Go to your Bot resource in the Azure Portal.
    - In the **Configuration** section, update the **Messaging endpoint** with your ngrok HTTPS URL, followed by `/api/messages`.
      Example: `https://xxxx-xxxx.ngrok.io/api/messages`
    - Save the changes.

You can now interact with your bot in Microsoft Teams.

## Project Folder Structure

```
/
├── app/                  # Next.js frontend and API routes
│   ├── api/              # API endpoints for dashboard & bot services
│   └── page.js           # Main dashboard page
├── appPackage/           # Teams application manifest and icons
├── infra/                # Azure Bicep templates for infrastructure as code
├── lib/                  # Core business logic (analytics, learning, users, etc.)
├── scripts/              # Utility and seeding scripts
├── bot.js                # Main bot logic and message handling
├── index.js              # Application entry point (Express server)
├── next.config.js        # Next.js configuration
└── package.json          # Project dependencies and scripts
```

## API Endpoints

The application exposes several API endpoints under `/api/`. These are primarily used by the frontend dashboard.

| Method | Endpoint                      | Description                                           |
|--------|-------------------------------|-------------------------------------------------------|
| `GET`  | `/api/user/profile`           | Fetches the profile of the currently authenticated user.|
| `GET`  | `/api/analytics/overview`     | Retrieves high-level analytics data for the dashboard.|
| `POST` | `/api/auth/login`             | Authenticates a user for the web dashboard.           |
| `POST` | `/api/quiz/submit`            | Submits user responses for a quiz.                    |
| `GET`  | `/api/analytics/leaderboard`  | Fetches the user leaderboard data.                    |

## Testing

No formal, automated testing framework has been configured for this project yet.

When tests are implemented (e.g., using a framework like Jest or Mocha), you will be able to run them using a standardized npm script. A `test` script should be added to `package.json`.

```bash
# Example command to run tests
npm test
```

This command will execute all unit, integration, and end-to-end tests for the project.

## Deployment Overview

Deployment is automated via a GitHub Actions workflow defined in `.github/workflows/main_teamsbot-aichampions-001.yml`.

- **Trigger:** A `push` to the `main` branch.
- **Process:**
    1.  The `build` job installs Node.js, installs dependencies, and creates a production build.
    2.  The build output is uploaded as an artifact.
    3.  The `deploy` job downloads the artifact, logs into Azure using service principal credentials, and deploys the application to the Azure Web App service.

Secrets and credentials for deployment are stored in GitHub repository secrets.

## Common Errors & Troubleshooting

- **Bot not responding in Teams:**
    - Ensure your `ngrok` tunnel is active and correctly configured.
    - Double-check that the **Messaging endpoint** in the Azure portal is updated with the correct `ngrok` URL (`/api/messages`).
    - Verify that all environment variables, especially `MicrosoftAppId` and `MicrosoftAppPassword`, are correct.

- **Dashboard authentication errors:**
    - Confirm that the `COSMOS_*` environment variables are correctly set.
    - Ensure the user exists in the `users` container in Cosmos DB.

- **`npm install` fails:**
    - Ensure you are using a compatible version of Node.js (>=20.x).
    - Try deleting `node_modules` and `package-lock.json`, then run `npm install` again.

## Contributing Guidelines

We welcome contributions to improve the AI Champions Learning Bot. Please follow these steps:

1.  **Fork** the repository.
2.  Create a new feature branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes and commit them with clear, descriptive messages.
4.  Push your changes to your fork (`git push origin feature/your-feature-name`).
5.  Create a **Pull Request** against the `main` branch of the original repository.
6.  Ensure your code passes all existing tests and follows the project's coding conventions.

## License

This project is licensed under the [MIT License](LICENSE.md). Please see the `LICENSE.md` file for details.