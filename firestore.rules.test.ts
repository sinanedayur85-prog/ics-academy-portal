/**
 * Security Rules Verification Suite for ICS Academy Firestore Rules
 * Verifies that all "Dirty Dozen" adversarial payloads are rejected with PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number
  name: string
  collection:
    | 'studyNotes'
    | 'leaveRecords'
    | 'digitalKitabs'
    | 'campusChatMessages'
    | 'campusNotifications'
  operation: 'create' | 'read' | 'update' | 'delete'
  auth: { uid: string; email_verified: boolean } | null
  docId: string
  payload?: Record<string, unknown>
  expectedResult: 'PERMISSION_DENIED'
}

export const dirtyDozenTestCases: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    collection: 'studyNotes',
    operation: 'create',
    auth: null,
    docId: 'note_1',
    payload: {
      uid: 'user_1',
      studentId: 'st-101',
      mode: 'kitab',
      language: 'ml',
      prompt: 'Explain Fathul Mueen',
      response: 'Explanation text',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Spoof',
    collection: 'studyNotes',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: false },
    docId: 'note_2',
    payload: {
      uid: 'user_1',
      studentId: 'st-101',
      mode: 'kitab',
      language: 'ml',
      prompt: 'Explain Fathul Mueen',
      response: 'Explanation text',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Create',
    collection: 'studyNotes',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'note_3',
    payload: {
      uid: 'user_2',
      studentId: 'st-101',
      mode: 'kitab',
      language: 'ml',
      prompt: 'Explain Fathul Mueen',
      response: 'Explanation text',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on StudyNote',
    collection: 'studyNotes',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'note_4',
    payload: {
      uid: 'user_1',
      studentId: 'st-101',
      mode: 'kitab',
      language: 'ml',
      prompt: 'Explain Fathul Mueen',
      response: 'Explanation text',
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Invalid Mode Enum',
    collection: 'studyNotes',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'note_5',
    payload: {
      uid: 'user_1',
      studentId: 'st-101',
      mode: 'hacked_mode',
      language: 'ml',
      prompt: 'Explain Fathul Mueen',
      response: 'Explanation text',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Oversized Prompt Payload',
    collection: 'studyNotes',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'note_6',
    payload: {
      uid: 'user_1',
      studentId: 'st-101',
      mode: 'kitab',
      language: 'ml',
      prompt: 'A'.repeat(2500),
      response: 'Explanation text',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Forged Client Timestamp on CampusChatMessage',
    collection: 'campusChatMessages',
    operation: 'create',
    auth: null,
    docId: 'msg_7',
    payload: {
      id: 'msg_7',
      campusId: 'ics-academy',
      roomId: 'direct__std-101__usthad-06',
      senderId: 'usthad-06',
      senderName: 'Usthad Razaq Saqafi',
      senderRole: 'usthad',
      text: 'Assalamu Alaikum',
      mediaType: 'none',
      reactions: {},
      deliveredTo: ['usthad-06'],
      readBy: ['usthad-06'],
      deletedFor: [],
      isDeleted: false,
      createdAt: '1999-01-01T00:00:00Z',
      createdAtMs: 1793980600000,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Cross-User Read / PII Leak',
    collection: 'studyNotes',
    operation: 'read',
    auth: { uid: 'user_2', email_verified: true },
    docId: 'note_owned_by_user_1',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Path ID Poisoning',
    collection: 'studyNotes',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'invalid/id$with*special!chars',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Sender Hijack on Chat Update',
    collection: 'campusChatMessages',
    operation: 'update',
    auth: null,
    docId: 'msg_10',
    payload: {
      senderId: 'usthad-07',
      text: 'Tampered text',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Value Poisoning on LeaveRecord',
    collection: 'leaveRecords',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'leave_1',
    payload: {
      uid: 'user_1',
      studentId: 'st-101',
      studentName: 'Muhammed Sinan E',
      admissionNo: 'ICS2024018',
      recordType: 'admin_override',
      dateString: '29 Oct 2026',
      timeString: '09:00 AM',
      reason: 'Medical',
      details: '',
      status: 'pending',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Shadow Field Injection on CampusNotification',
    collection: 'campusNotifications',
    operation: 'create',
    auth: null,
    docId: 'notif_12',
    payload: {
      id: 'notif_12',
      campusId: 'ics-academy',
      type: 'chat',
      title: 'Test',
      message: 'Message',
      href: '#campus-chat',
      createdAtMs: 1793980600000,
      ghostAdminOverride: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
]
