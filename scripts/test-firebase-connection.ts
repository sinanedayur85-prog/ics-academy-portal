import { initializeApp, getApps } from 'firebase/app'
import {
  doc,
  getDocFromServer,
  getFirestore,
  collection,
  query,
  where,
  getDocsFromServer,
  setDoc,
  deleteDoc,
  serverTimestamp,
  terminate,
} from 'firebase/firestore'
import firebaseConfig from '../firebase-applet-config.json'

export async function runFirebaseConnectionDiagnostic() {
  const cfg = firebaseConfig as typeof firebaseConfig & { firestoreDatabaseId?: string }
  console.log('--- Firebase Firestore Connection Diagnostic ---')
  console.log('Project ID:', cfg.projectId)
  console.log('Database ID:', cfg.firestoreDatabaseId ?? '(default)')

  let dbInstance: ReturnType<typeof getFirestore> | null = null

  try {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
    dbInstance = cfg.firestoreDatabaseId
      ? getFirestore(app, cfg.firestoreDatabaseId)
      : getFirestore(app)

    console.log('1. Testing getDocFromServer(doc(db, "test", "connection"))...')
    const testSnap = await getDocFromServer(doc(dbInstance, 'test', 'connection'))
    console.log(
      '   Result: Connected to Firestore server successfully. Document exists:',
      testSnap.exists(),
    )

    console.log('2. Testing studyNotes query & write/delete round-trip (portal_st-101)...')
    const testNoteId = `diag_note_st-101_${Date.now()}`
    await setDoc(doc(dbInstance, 'studyNotes', testNoteId), {
      uid: 'portal_st-101',
      studentId: 'st-101',
      mode: 'kitab',
      language: 'ml',
      prompt: 'Diagnostic test prompt',
      response: 'Diagnostic test response',
      createdAt: serverTimestamp(),
    })
    const notesQuery = query(
      collection(dbInstance, 'studyNotes'),
      where('uid', '==', 'portal_st-101'),
      where('studentId', '==', 'st-101'),
    )
    const notesSnap = await getDocsFromServer(notesQuery)
    console.log('   Result: studyNotes query succeeded. Documents returned:', notesSnap.size)
    await deleteDoc(doc(dbInstance, 'studyNotes', testNoteId))
    console.log('   Result: studyNotes test document cleaned up successfully.')

    console.log('3. Testing leaveRecords query & write/delete round-trip (portal_st-101)...')
    const testLeaveId = `diag_leave_st-101_${Date.now()}`
    await setDoc(doc(dbInstance, 'leaveRecords', testLeaveId), {
      uid: 'portal_st-101',
      studentId: 'st-101',
      studentName: 'Diagnostic Student',
      admissionNo: 'ICS-101',
      recordType: 'application',
      dateString: '29 Oct 2026',
      timeString: '10:00 AM',
      reason: 'Medical',
      details: 'Diagnostic verification test',
      status: 'pending',
      createdAt: serverTimestamp(),
    })
    const leavesQuery = query(
      collection(dbInstance, 'leaveRecords'),
      where('uid', '==', 'portal_st-101'),
      where('studentId', '==', 'st-101'),
    )
    const leavesSnap = await getDocsFromServer(leavesQuery)
    console.log('   Result: leaveRecords query succeeded. Documents returned:', leavesSnap.size)
    await deleteDoc(doc(dbInstance, 'leaveRecords', testLeaveId))
    console.log('   Result: leaveRecords test document cleaned up successfully.')

    console.log('--- Diagnostic Complete: ALL FIRESTORE OPERATIONS SUCCEEDED ---')
  } catch (error: unknown) {
    if (error instanceof Error) {
      const firebaseCode = (error as { code?: string }).code ?? 'unknown-code'
      console.error('Firebase Diagnostic Error Code:', firebaseCode)
      console.error('Firebase Diagnostic Error Message:', error.message)
      if (error.message.includes('the client is offline')) {
        console.error('Please check your Firebase configuration.')
      }
    } else {
      console.error('Firebase Diagnostic Unknown Error:', String(error))
    }
    process.exitCode = 1
  } finally {
    if (dbInstance) {
      await terminate(dbInstance)
    }
  }
}

void runFirebaseConnectionDiagnostic()
