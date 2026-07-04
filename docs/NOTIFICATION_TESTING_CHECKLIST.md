# IntellMeet — Notification System: Testing Checklist

*Covers: mention, AI summary ready, action item assigned, meeting reminder, deep-link navigation, socket listener, badge*

---

## 1. Server — Unit / Integration Tests

### 1.1 Notification Model
- [ ] `ai_summary_ready` is accepted as a valid `type` enum value
- [ ] `action_item_assigned` is accepted as a valid `type` enum value
- [ ] `AIResult` is accepted as a valid `refModel` enum value
- [ ] Invalid type is rejected with a Mongoose validation error

### 1.2 Notification Service
- [ ] `notifyMeetingReminder` creates a notification with type `meeting_reminder` and `link` containing the meetingId
- [ ] `notifyTaskAssigned` creates a notification with type `task_assigned` for the correct recipient
- [ ] `notifyActionItemAssigned` creates a notification with type `action_item_assigned` and `link` pointing to `?tab=action-items`
- [ ] `notifyAISummaryReady` creates notifications for all participant IDs
- [ ] `notifyChannelMention` creates notifications only for mentioned users (not the sender)
- [ ] `notifyMany` skips silently if a single recipient fails (no throw)
- [ ] `init(io)` sets the internal `_io` reference; subsequent `createNotification` emits `notification:new` to the correct room

### 1.3 Task Controller
- [ ] `POST /tasks` with `assignedTo` ≠ creator fires `notifyTaskAssigned`
- [ ] `POST /tasks` with `assignedTo` === creator does NOT fire notification
- [ ] `POST /tasks` without `assignedTo` does NOT fire notification
- [ ] `PATCH /tasks/:id` changing `assignedTo` to a new user fires `notifyTaskAssigned`
- [ ] `PATCH /tasks/:id` changing `assignedTo` to self does NOT fire notification
- [ ] `PATCH /tasks/:id` changing a non-`assignedTo` field does NOT fire task notification

### 1.4 AI Service
- [ ] `summarize()` calls `notifyAISummaryReady` after successful summary generation
- [ ] `summarize()` does NOT call notification if meeting is not found
- [ ] `runFullPipeline()` calls `notifyAISummaryReady` once after pipeline completes
- [ ] `runFullPipeline()` calls `notifyActionItemAssigned` for each action item that has an `assignee`
- [ ] `runFullPipeline()` does NOT call `notifyActionItemAssigned` for action items without an `assignee`
- [ ] Notification calls do not throw if they fail (fire-and-forget)

### 1.5 Chat Socket — Channel Mentions
- [ ] `channel:message` with non-empty `mentions` array fires `notifyChannelMention`
- [ ] Sender is excluded from mention notifications (self-mention ignored)
- [ ] `channel:message` with empty `mentions` array does NOT fire mention notification
- [ ] `channel:message` with `mentions` containing only the sender does NOT fire notification

### 1.6 Meeting Reminder Scheduler
- [ ] Meetings with `scheduledAt` in [now+15m, now+16m] and `reminderSent: false` receive a reminder notification
- [ ] After reminder is sent, `reminderSent` is set to `true` on the meeting document
- [ ] Meetings with `reminderSent: true` are NOT reminded again
- [ ] Meetings with status other than `scheduled` are NOT reminded
- [ ] Meetings outside the 15-minute window are NOT reminded

---

## 2. Client — Component Tests

### 2.1 NotificationCenter
- [ ] Bell icon renders with correct unread badge count
- [ ] Badge shows `9+` when unread > 9
- [ ] Badge is hidden when unread === 0
- [ ] Clicking bell opens the panel
- [ ] Clicking outside the panel closes it
- [ ] `notification:new` socket event prepends notification to list and increments badge
- [ ] Clicking a notification with a deep link calls `navigate` with the correct path
- [ ] Clicking a notification marks it as read before navigating
- [ ] `ai_summary_ready` notification shows `Sparkles` icon
- [ ] `action_item_assigned` notification shows `CheckSquare` icon
- [ ] `meeting_reminder` notification shows `Video` icon
- [ ] `channel_mention` notification shows `AtSign` icon
- [ ] Mark all read sets all notifications to `isRead: true`
- [ ] Dismiss removes notification from list

### 2.2 Notifications Page
- [ ] Page renders all notifications from API
- [ ] Filter `unread` shows only unread notifications
- [ ] Filter `meetings` shows meeting_* and excludes task/mention types
- [ ] Filter `tasks` shows task_assigned, task_due, action_item_assigned
- [ ] Filter `mentions` shows channel_mention, message_reply
- [ ] Clicking a notification row navigates to the deep link
- [ ] Clicking a notification row marks it as read
- [ ] `ai_summary_ready` navigates to `/ai-summary/:id`
- [ ] `action_item_assigned` navigates to `/ai-summary/:id?tab=action-items`
- [ ] `task_assigned` navigates to `/tasks?highlight=:id`
- [ ] `team_invite` navigates to `/teams/:id`
- [ ] Accept team invite button calls `teamService.acceptInvite` and marks notification read
- [ ] Reject team invite button deletes the notification

### 2.3 App.tsx — Global Socket Listener
- [ ] When authenticated and socket is connected, `notification:new` event dispatches `pushNotification` to Redux store
- [ ] `notification:new` event shows a toast with the notification title
- [ ] Listener is removed on cleanup (socket.off called)
- [ ] Listener is NOT registered when `isAuthenticated` is false
- [ ] Listener is NOT registered when `socket` is null

---

## 3. End-to-End (Manual / Playwright)

### 3.1 Task Assignment Notification
1. Log in as User A (creator) and User B (assignee) in two browser tabs
2. User A creates a task and assigns it to User B
3. **Expected:** User B sees a toast notification and bell badge increments in real time
4. User B clicks the notification → navigates to `/tasks?highlight=<taskId>`

### 3.2 AI Summary Ready Notification
1. End a meeting with a transcript
2. Trigger AI summary generation (via API or post-meeting dashboard)
3. **Expected:** All meeting participants receive `ai_summary_ready` notification in real time
4. Clicking notification navigates to `/ai-summary/<meetingId>`

### 3.3 Action Item Assigned Notification
1. Run full AI pipeline on a meeting with action items that have named assignees
2. **Expected:** Matched users receive `action_item_assigned` notification
3. Clicking notification navigates to `/ai-summary/<meetingId>?tab=action-items`

### 3.4 Channel Mention Notification
1. User A sends a message in a channel mentioning User B (`@UserB`)
2. **Expected:** User B receives `channel_mention` notification in real time
3. User A does NOT receive a notification for self-mention
4. Clicking notification navigates to `/teams/<teamId>/channels/<channelId>`

### 3.5 Meeting Reminder Notification
1. Schedule a meeting 15–16 minutes in the future
2. Wait for the scheduler tick (up to 60 seconds)
3. **Expected:** All participants receive `meeting_reminder` notification
4. Verify `reminderSent: true` is set on the meeting document in MongoDB
5. Wait another 60 seconds — confirm no duplicate reminder is sent

### 3.6 Deep-Link Navigation
- [ ] All notification types navigate to the correct route without a full page reload
- [ ] Navigation works from both NotificationCenter panel and Notifications page
- [ ] Notification is marked as read after navigation

### 3.7 Badge Persistence
- [ ] Unread count in bell badge matches the count returned by `GET /notifications`
- [ ] After marking all read, badge disappears
- [ ] After receiving a new socket notification, badge increments by 1

---

## 4. Regression Tests

- [ ] Existing `meeting_invite` and `meeting_started` notifications still work
- [ ] `team_invite` accept/reject flow still works
- [ ] Notification list pagination still works
- [ ] Email notifications still fire for `channels: ['in_app', 'email']` types
- [ ] Notification TTL (90-day auto-expire index) is still present on the model

---

## 5. Performance Checks

- [ ] `notifyMany` with 50 recipients completes in < 2 seconds
- [ ] Reminder scheduler tick with 100 upcoming meetings completes in < 5 seconds
- [ ] Socket emit to `user:<id>` room does not block the event loop
- [ ] Notification list API (`GET /notifications`) responds in < 200 ms with compound index

---

## Sign-off

| Tester | Area | Date | Pass/Fail |
|--------|------|------|-----------|
| | Server unit tests | | |
| | Client component tests | | |
| | E2E manual tests | | |
| | Regression | | |
| | Performance | | |
