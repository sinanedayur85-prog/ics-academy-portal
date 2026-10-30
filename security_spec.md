# Security Specification — ICS Academy Firestore Rules

## 1. Data Invariants

1. **Identity & Ownership Invariant**: Every document in `/studyNotes/{noteId}` and `/leaveRecords/{recordId}` must have a `uid` field that strictly equals `request.auth.uid`, and the user must have a verified email (`request.auth.token.email_verified == true`).
2. **Strict Schema & Volumetric Bounds**:
   - `StudyNote`: Must contain exact keys `['uid', 'studentId', 'mode', 'language', 'prompt', 'response', 'createdAt']`. `prompt` length must be $1\dots 2000$, `response` length must be $1\dots 15000$, `mode` in `['kitab', 'qa', 'translation', 'dawa']`, `language` in `['ml', 'en', 'ar']`, and `createdAt == request.time`.
   - `LeaveRecord`: Must contain exact keys `['uid', 'studentId', 'studentName', 'admissionNo', 'recordType', 'dateString', 'timeString', 'reason', 'details', 'status', 'createdAt']`. `recordType` in `['application', 'return']`, `status` in `['pending', 'recorded']`, `details` length $\le 6000$, and `createdAt == request.time`.
   - `DigitalKitab`: Must contain exact keys `['uid', 'studentId', 'title', 'arabicTitle', 'author', 'category', 'classBatch', 'language', 'pages', 'storagePath', 'pdfUrl', 'summary', 'createdAt']`. `category` in `['fiqh', 'hadith', 'tafsir', 'aqeedah', 'nahw', 'history']`, `pages` in $1\dots 5000$, `storagePath` matching `^kitabs/[a-zA-Z0-9_\-/\.]+.pdf$`, and `createdAt == request.time`.
3. **Query Enforcer Invariant**: `list` and `get` operations are strictly restricted to documents where `isAuthorizedStudent(resource.data.uid, resource.data.studentId)` holds. Blanket `isSignedIn()` reads are forbidden.
4. **Immutability & Terminal Integrity**: `uid`, `studentId`, `storagePath`, and `createdAt` cannot be modified after creation.

## 2. The "Dirty Dozen" Payloads

1. **Unauthenticated Write**: `auth = null`, creating a `StudyNote`.
2. **Unverified Email Spoof**: `auth.uid = 'user_1'`, `auth.token.email_verified = false`, creating a `StudyNote`.
3. **Identity Spoofing on Create**: `auth.uid = 'user_1'`, payload `uid: 'user_2'`.
4. **Shadow Field Injection on StudyNote**: Payload includes all required keys plus `"isAdmin": true`.
5. **Invalid Mode Enum**: `StudyNote` payload with `mode: "hacked_mode"`.
6. **Oversized Prompt Payload (Denial of Wallet)**: `StudyNote` payload with `prompt` of length 5000 chars ($> 2000$).
7. **Forged Client Timestamp**: `StudyNote` payload with `createdAt` set to a past/future timestamp instead of `request.time`.
8. **Cross-User Read / PII Leak**: `auth.uid = 'user_2'` attempting `get` or `list` on a document owned by `'user_1'`.
9. **Path ID Poisoning**: Document ID containing invalid characters or length $> 128$.
10. **Owner Hijack on Update**: Updating `uid` from `'user_1'` to `'user_2'`.
11. **Value Poisoning on LeaveRecord**: Setting `recordType` to `'admin_override'` instead of `'application' | 'return'`.
12. **Storage Path Traversal on DigitalKitab**: Setting `storagePath` to `'../secrets/key.pem'` instead of `^kitabs/[a-zA-Z0-9_\-/\.]+.pdf$`.
