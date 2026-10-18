# v0.6 — Seva Team Coordination Workspace

## Deployment order
1. Back up Supabase. Review `supabase/migrations/202610180004_team_workspaces.sql` before executing as a database administrator.
2. Apply the migration in Supabase SQL Editor once. It creates team tables, permission-checked RPCs and the default Communication, Programme Coordination and Follow-up teams.
3. Run `npm install && npm run build` on the branch and verify the production build.
4. Test with separate administrator, team-lead, team-member and facilitator accounts.
5. Only after tests, merge the PR to `main` for Railway deployment.

## Permissions
- Existing system roles remain admin / coordinator / facilitator.
- Admins can manage memberships and all tasks; coordinators can assign and manage all tasks.
- Leads can manage tasks in their respective team and see that team's queue.
- Members can only see and update tasks explicitly assigned to them.
- Host phone and email are included in the team workspace only for managers, assigned users and team leads of relevant tasks.
- All team workspace data is retrieved through `team_workspace_data()`, and mutations through role-checked SQL RPCs. Direct table access is revoked for browsers.
- Authentication and staff profiles must already exist. Admins assign existing users to teams.

## Test matrix
- Admin adds user to two different teams; refresh persists membership.
- Lead assigns a Communication task to a member; member can see it and add notes.
- Other member cannot see or modify that task, including with a forged RPC request.
- Unassigned user cannot read host contact details.
- Coordinator assigns Follow-up after a programme; follow-up member records feedback and a next step.
- Comment history records author and timestamp; notes aren't overwritten.
- Facilitator programme reporting still works.
- Verify no other team's task or comments are visible through direct table queries.
- Cross-test public registration, v0.4 scheduling, v0.5 reporting and mobile layouts.

## Scope notes
- This first release manually creates and assigns tasks: no automatic queue population, reminder automation or outbound messaging.
- Follow-up notes are internal records; marketing communications must respect the host's separate `consent_future` choice.
- Existing registration records stay unchanged.
- Times in the task due-date picker are interpreted in the browser's local timezone. Before multi-region usage, standardise display to `Europe/London`.
- Supabase Auth accounts must be created/provisioned separately before they can be added to teams.
