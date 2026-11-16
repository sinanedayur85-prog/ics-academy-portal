# Security Specification — ICS Academy Firestore Rules

## 1. Data Invariants

1. **Identity & Ownership Invariant**: Every document in `/studyNotes/{noteId}` and `/leaveRecords/{recordId}` must have a `uid` field that strictly equals `request.auth.uid` (verified user) or validated portal session `'portal_' + studentId`.
2. **Campus Actor Integrity Invariant**: Every real-time document in `/campusChatMessages/{messageId}`, `/campusChatMeta/{roomDocId}`, `/campusChatPresence/{actorId}`, and `/campusNotifications/{notifId}` must enforce `campusId == 'ics-academy'`, canonical portal actor ID regex (`^(st[d]?|usthad|principal)-[a-zA-Z0-9_\-]+$`), and server timestamp `createdAt == request.time` on creation.
3. **Strict Schema & Volumetric Bounds**:
   - `StudyNote`: Exact keys `['uid', 'studentId', 'mode', 'language', 'prompt', 'response', 'createdAt']`.
   - `LeaveRecord`: Exact keys `['uid', 'studentId', 'studentName', 'admissionNo', 'recordType', 'dateString', 'timeString', 'reason', 'details', 'status', 'createdAt']`.
   - `DigitalKitab`: Exact keys `['uid', 'studentId', 'title', 'arabicTitle', 'author', 'category', 'classBatch', 'language', 'pages', 'storagePath', 'pdfUrl', 'summary', 'createdAt']`.
   - `CampusChatMessage`: `id`, `campusId`, `roomId`, `senderId`, `senderName`, `senderRole`, `text <= 8000`, `mediaType`, `reactions <= 20`, `deliveredTo <= 200`, `readBy <= 200`, `deletedFor <= 200`, `isDeleted`, `createdAt == request.time`, `createdAtMs`. Action-based updates strictly constrained via `affectedKeys().hasOnly(...)`.
   - `CampusChatRoomMeta`: Exact keys `['campusId', 'roomId', 'onlyAdminsCanPost', 'pinnedMessageId', 'updatedByActorId', 'createdAt', 'updatedAtMs']`.
   - `CampusChatPresence`: Exact keys `['campusId', 'actorId', 'actorName', 'actorRole', 'lastSeenMs', 'isOnline', 'hideOnline', 'typingRoomId', 'typingMode', 'typingUpdatedAtMs', 'createdAt']`.
   - `CampusNotification`: Append-only (`update`/`delete` forbidden), strict key & size checks, `createdAt == request.time`.
4. **Query Enforcer Invariant**: No blanket `if true;` or `isSignedIn();` reads; every `allow list` validates `resource.data`.
5. **Immutability & Terminal Integrity**: `id`, `uid`, `campusId`, `roomId`, `senderId`, `createdAt`, `createdAtMs` cannot be modified after creation. Tombstoned messages (`isDeleted == true`) cannot be resurrected.

## 2. The "Dirty Dozen" Payloads

1. **Unauthenticated Write**: `auth = null`, creating a `StudyNote`.
2. **Unverified Email Spoof**: `auth.uid = 'user_1'`, `auth.token.email_verified = false`, creating a `StudyNote`.
3. **Identity Spoofing on Create**: `auth.uid = 'user_1'`, payload `uid: 'user_2'`.
4. **Shadow Field Injection on StudyNote**: Payload includes all required keys plus `"isAdmin": true`.
5. **Invalid Mode Enum**: `StudyNote` payload with `mode: "hacked_mode"`.
6. **Oversized Prompt Payload (Denial of Wallet)**: `StudyNote` payload with `prompt` of length 5000 chars ($> 2000$).
7. **Forged Client Timestamp**: `CampusChatMessage` payload with `createdAt` set to a past timestamp instead of `request.time`.
8. **Cross-User Read / PII Leak**: `auth.uid = 'user_2'` attempting `get` or `list` on a `StudyNote` owned by `'user_1'`.
9. **Path ID Poisoning**: Document ID containing invalid characters or length $> 128$.
10. **Sender / Immutable Field Hijack on Chat Update**: Updating `senderId` or `text` on `/campusChatMessages/{id}`.
11. **Value Poisoning on LeaveRecord**: Setting `recordType` to `'admin_override'` instead of `'application' | 'return'`.
12. **Shadow Field / Oversized Array on CampusChatMessage**: Injecting `deliveredTo` $> 200$ items or `ghostField: true` on `/campusChatMessages/{id}`.
