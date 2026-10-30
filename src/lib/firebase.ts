import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  initializeAuth,
  browserPopupRedirectResolver,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth'
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import firebaseConfig from '../../firebase-applet-config.json'

export const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
]

// Purge any stale cached Firebase Auth tokens in browser storage that could trigger
// securetoken.googleapis.com token-refresh failures when Token Service API is disabled.
if (typeof window !== 'undefined') {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith('firebase:')) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Ignore localStorage access errors
  }

  try {
    if ('indexedDB' in window && typeof window.indexedDB?.deleteDatabase === 'function') {
      window.indexedDB.deleteDatabase('firebaseLocalStorageDb')
    }
  } catch {
    // Ignore indexedDB access errors
  }
}

const configWithOptionalDb = firebaseConfig as typeof firebaseConfig & {
  firestoreDatabaseId?: string
}

// Primary Firebase app dedicated to Firestore and Storage
export const app = getApps().some((a) => a.name === '[DEFAULT]')
  ? getApp()
  : initializeApp(firebaseConfig)

export const db = configWithOptionalDb.firestoreDatabaseId
  ? getFirestore(app, configWithOptionalDb.firestoreDatabaseId)
  : getFirestore(app)
export const storage = getStorage(app, firebaseConfig.storageBucket)

// Isolated Firebase app for Auth with inMemoryPersistence so stale IndexedDB sessions
// are never restored on boot.
const AUTH_APP_NAME = 'ics-auth-client'
const authApp = getApps().some((a) => a.name === AUTH_APP_NAME)
  ? getApp(AUTH_APP_NAME)
  : initializeApp(firebaseConfig, AUTH_APP_NAME)

function createIsolatedAuth(): Auth {
  try {
    return initializeAuth(authApp, {
      persistence: inMemoryPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    return getAuth(authApp)
  }
}

export const auth = createIsolatedAuth()

const provider = new GoogleAuthProvider()
for (const scope of SCOPES) {
  provider.addScope(scope)
}
provider.setCustomParameters({ prompt: 'select_account' })

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false
// Cache the access token strictly in memory (never in localStorage/sessionStorage).
let cachedAccessToken: string | null = null

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken)
      } else if (!isSigningIn) {
        cachedAccessToken = null
        if (onAuthFailure) onAuthFailure()
      }
    } else {
      cachedAccessToken = null
      if (onAuthFailure) onAuthFailure()
    }
  })
}

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true
    let result
    try {
      result = await signInWithPopup(auth, provider, browserPopupRedirectResolver)
    } catch (popupErr: unknown) {
      const errCode = (popupErr as { code?: string })?.code
      if (errCode === 'auth/argument-error') {
        result = await signInWithPopup(auth, provider)
      } else {
        throw popupErr
      }
    }
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth')
    }

    cachedAccessToken = credential.accessToken
    return { user: result.user, accessToken: cachedAccessToken }
  } catch (error: unknown) {
    const errCode = (error as { code?: string })?.code
    if (errCode === 'auth/popup-closed-by-user' || errCode === 'auth/cancelled-popup-request') {
      // User simply closed the popup window; this is expected user cancellation, not a system failure
      console.info('Firebase Auth: Sign in popup closed by user.')
      return null
    }
    if (errCode === 'auth/unauthorized-domain') {
      console.warn('Firebase Auth notice: Domain not yet whitelisted in Firebase Console authorized domains.')
    } else {
      console.warn('Sign in notice:', error)
    }
    throw error
  } finally {
    isSigningIn = false
  }
}

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken
}

export const logout = async () => {
  await firebaseSignOut(auth)
  cachedAccessToken = null
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'))
  } catch (error) {
    if (error instanceof Error) {
      const code = (error as { code?: string }).code ?? 'unknown'
      // Only log unexpected errors, ignoring transient offline states during initial boot
      if (!error.message.includes('the client is offline')) {
        console.warn(`Firebase connection check notice [${code}]: ${error.message}`)
      }
    }
  }
}

if (typeof window !== 'undefined') {
  void testConnection()
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string
  operationType: OperationType
  path: string | null
  authInfo: {
    userId?: string | null
    email?: string | null
    emailVerified?: boolean | null
    isAnonymous?: boolean | null
    tenantId?: boolean | string | null
    providerInfo?: {
      providerId?: string | null
      email?: string | null
    }[]
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo))
  throw new Error(JSON.stringify(errInfo))
}

export async function signInWithGoogle() {
  return googleSignIn()
}

export async function signOutFirebase() {
  return logout()
}
