# msteams_ai_learning_bot

This repository contains a Microsoft Teams AI Learning Bot built using the
Microsoft 365 Agents Toolkit (Teams SDK v2).

---

## Overview of the Basic Bot template

Examples of Microsoft Teams bots in everyday use include:

- Bots that notify about build failures.
- Bots that provide information about the weather or bus schedules.
- Bots that provide travel information.

A bot interaction can be a quick question and answer, or it can be a complex conversation.
Being a cloud application, a bot can provide valuable and secure access to cloud services
and corporate resources.

This app template is built on top of the
[Microsoft Teams SDK](https://aka.ms/teams-ai-library-v2).

---

## Get started with the Basic Bot template

### Prerequisites

To run the Basic Bot template in your local dev machine, you will need:

- Node.js (supported versions: 20, 22)
- Microsoft 365 Agents Toolkit VS Code Extension (v5.0.0+)  
  or Microsoft 365 Agents Toolkit CLI

> For local debugging using Microsoft 365 Agents Toolkit CLI, follow:
> https://aka.ms/teamsfx-cli-debugging

### Run locally

1. Open the project in VS Code.
2. Select the **Microsoft 365 Agents Toolkit** icon from the left sidebar.
3. Press **F5** → choose **Debug in Microsoft 365 Agents Playground**.
4. The browser will open Microsoft 365 Agents Playground.
5. Send a message to the bot and receive an echoed response.

---

## Project structure

| Folder / File | Description |
|--------------|------------|
| `.vscode` | VS Code debug configuration |
| `appPackage` | Teams app manifest templates |
| `env` | Environment configurations |
| `infra` | Azure provisioning templates |
| `app.js` | Bot business logic |
| `index.js` | Bot setup & configuration |

---

## Extending the bot

Useful documentation:

- Environment management  
  https://learn.microsoft.com/microsoftteams/platform/toolkit/teamsfx-multi-env
- Add capabilities  
  https://learn.microsoft.com/microsoftteams/platform/toolkit/add-capability
- Single Sign-On  
  https://learn.microsoft.com/microsoftteams/platform/toolkit/add-single-sign-on
- Microsoft Graph integration  
  https://learn.microsoft.com/microsoftteams/platform/toolkit/teamsfx-sdk#microsoft-graph-scenarios
- Azure provisioning & deployment  
  https://learn.microsoft.com/microsoftteams/platform/toolkit/deploy
