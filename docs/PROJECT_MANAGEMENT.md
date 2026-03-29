# Project Management Section

Unified project dashboards with dependencies, critical path, AI progress predictions, and back-office automation—differentiating from generic PM tools by linking to reports and workflows.

## Features

### Unified dashboard
- **Projects list** — All PM projects with status, progress %, and milestone count.
- **Project dashboard** — Per-project view with:
  - **Status dropdown** — Change project status (planning / active / on_hold / completed / archived) and see start/target dates.
  - Progress bar and **Update AI prediction**.
  - **Critical path** — Longest path through milestone dependencies (in days); milestones on the critical path are highlighted.
  - **List / Gantt toggle** — List view with completion toggle, due date, automation label, **View task** / **Content** links, and **Edit** (pencil). Gantt view shows milestones as horizontal bars by earliest start/finish (critical path in amber).
  - **Add milestone** — Title, estimated days, and **Depends on** (checkboxes for existing milestones).
  - **Edit milestone** — Title, due date, estimated days, and **Depends on** (dependencies). Saving updates the critical path.
  - **Links** — Milestones with `linkedTaskId` show “View task” (opens Tasks with that task); `linkedContentId` shows “Content” (opens Library).

### Dependencies and critical path
- Each milestone can have **dependencyMilestoneIds** (other milestones that must complete first).
- **Critical path** is computed as the longest path through the dependency graph using **estimatedDays**.
- Critical path total (in days) is shown; milestones on the path are marked so you can focus on what drives the timeline.

### AI progress prediction
- **Update AI prediction** runs a velocity-based forecast:
  - Uses completed milestones vs. elapsed time to estimate completion rate.
  - Predicts completion date and stores **aiPredictedCompletionDate** and **aiPredictionConfidence**.
- Addresses “Smartsheet-style” intuitiveness by automating progress insight instead of manual tracking.

### Back-office automation (differentiator)
- When a milestone is **completed**, optional automation runs:
  - **generate_report** — Uses `automation.config.reportTemplateId`; calls `reportBuilderService.generateReport` for the current period (e.g. auto-generate reports from milestones).
  - **run_workflow** — Uses `automation.config.workflowId`; calls `workflowService.executeWorkflow` with trigger context (projectId, milestoneId, milestoneTitle).
- Configured per milestone in the **PmProject** model (`milestone.automation.onComplete` and `milestone.automation.config`).
- Links projects to existing reports and workflows so milestones drive back-office actions.

### Links to other sections
- Milestones can reference:
  - **linkedTaskId** — Task (e.g. from Tasks section).
  - **linkedContentId** — Content item.
  - **linkedWorkflowId** — Workflow.
- **workspaceId** on the project ties to Workspace for agency/client context.

## API

- `GET /api/pm/projects` — List projects (query: `status`).
- `GET /api/pm/projects/:id` — Get project.
- `GET /api/pm/projects/:id/dashboard` — Dashboard with critical path and prediction.
- `POST /api/pm/projects` — Create project (body: name, description, status, startDate, targetEndDate, workspaceId, milestones).
- `PUT /api/pm/projects/:id` — Update project.
- `DELETE /api/pm/projects/:id` — Delete project.
- `POST /api/pm/projects/:id/milestones` — Add milestone (body: title, description, dueDate, dependencyMilestoneIds, estimatedDays, linkedTaskId, linkedContentId, linkedWorkflowId, automation).
- `PUT /api/pm/projects/:projectId/milestones/:milestoneId` — Update milestone.
- `POST /api/pm/projects/:projectId/milestones/:milestoneId/complete` — Complete milestone (runs automation).
- `DELETE /api/pm/projects/:projectId/milestones/:milestoneId` — Delete milestone.
- `POST /api/pm/projects/:id/predict` — Run AI prediction and update stored prediction.

## Models

- **PmProject** — userId, name, description, status (planning | active | on_hold | completed | archived), startDate, targetEndDate, milestones[], progress, aiPredictedCompletionDate, aiPredictionConfidence, lastPredictionAt, workspaceId.
- **Milestone** (embedded) — title, description, dueDate, completedAt, dependencyMilestoneIds[], estimatedDays, order, linkedTaskId, linkedContentId, linkedWorkflowId, automation: { onComplete, config }.

## Files

- **Server:** `server/models/PmProject.js`, `server/services/pmProjectService.js`, `server/routes/pm.js`; mounted at `/api/pm`.
- **Client:** `client/app/dashboard/projects/page.tsx` (list, dashboard, add project/milestone, complete milestone, run prediction); nav: “Projects” (desktop + mobile).
- **i18n:** `nav.projects` in `client/public/i18n/locales/en.json`.

## Smooth flow across sections

- Use **linkedTaskId** / **linkedContentId** / **linkedWorkflowId** to jump from a milestone to the corresponding Task, Content, or Workflow.
- Use **workspaceId** to scope projects to a workspace (e.g. client) and align with Teams/Collaboration.
- Automations (report + workflow) keep back-office in sync with project progress without manual steps.
