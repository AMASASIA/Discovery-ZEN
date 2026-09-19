import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as fbSignOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer,
  setDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { SpatialNodeData, MemoriaLesson } from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    if (user) {
      // Upsert user profile
      const userRef = doc(db, 'users', user.uid);
      const userPath = `users/${user.uid}`;
      try {
        await setDoc(userRef, {
          userId: user.uid,
          displayName: user.displayName || 'Anonymous User',
          email: user.email || '',
          photoURL: user.photoURL || '',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, userPath);
      }
    }
    return user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

export async function logOut(): Promise<void> {
  await fbSignOut(auth);
}

// -------------------------------------------------------------
// Cloud Firestore Synchronizers (Subcollections under /users/{userId})
// -------------------------------------------------------------

/**
 * 1. Viewed Nodes Tracking
 */
export async function syncViewedNode(userId: string, nodeId: string): Promise<void> {
  if (!userId || !nodeId) return;
  const path = `users/${userId}/viewed_nodes/${nodeId}`;
  try {
    await setDoc(doc(db, 'users', userId, 'viewed_nodes', nodeId), {
      userId,
      nodeId,
      viewedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeViewedNodes(userId: string, onUpdate: (nodeIds: string[]) => void): () => void {
  if (!userId) return () => {};
  const path = `users/${userId}/viewed_nodes`;
  const q = collection(db, 'users', userId, 'viewed_nodes');
  
  return onSnapshot(q, (snapshot) => {
    const ids = snapshot.docs.map(doc => doc.id);
    onUpdate(ids);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

/**
 * 2. Search History Tracking
 */
export async function syncSearchQuery(userId: string, queryText: string): Promise<void> {
  if (!userId || !queryText.trim()) return;
  // Use sanitized query or hash as doc id to prevent infinite duplicates
  const docId = queryText.trim().toLowerCase().replace(/[^a-zA-Z0-9_\-\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g, '_').slice(0, 64) || `query-${Date.now()}`;
  const path = `users/${userId}/search_history/${docId}`;
  try {
    await setDoc(doc(db, 'users', userId, 'search_history', docId), {
      userId,
      query: queryText.slice(0, 480),
      searchedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeSearchHistory(userId: string, onUpdate: (queries: string[]) => void): () => void {
  if (!userId) return () => {};
  const path = `users/${userId}/search_history`;
  const colRef = collection(db, 'users', userId, 'search_history');
  
  return onSnapshot(colRef, (snapshot) => {
    const sorted = snapshot.docs
      .map(d => d.data())
      .sort((a, b) => (b.searchedAt || '').localeCompare(a.searchedAt || ''))
      .map(d => d.query as string)
      .filter(Boolean);
    onUpdate(sorted);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

/**
 * 3. User Spatial Nodes (Spawned & MCP Compiled Nodes)
 */
export async function syncUserSpatialNode(userId: string, node: SpatialNodeData): Promise<void> {
  if (!userId || !node.id) return;
  const path = `users/${userId}/user_nodes/${node.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'user_nodes', node.id), {
      userId,
      nodeId: node.id,
      code: node.code || '',
      title: (node.title || '').slice(0, 190),
      sector: node.sector || '経済',
      category: node.category || node.sector || '経済',
      summary: (node.summary || '').slice(0, 1900),
      details: (node.details || '').slice(0, 9500),
      source: (node.source || '').slice(0, 500),
      status: node.status || 'ACTIVE',
      r: typeof node.radius_r === 'number' ? node.radius_r : 35,
      theta: typeof node.theta === 'number' ? node.theta : 0,
      phi: typeof node.phi === 'number' ? node.phi : 0,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Batch Sync ALL Current Spatial Nodes to Cloud Firestore
 * Allows 1-click cloud synchronization of all AI/MCP generated and workspace nodes
 */
export async function syncAllUserSpatialNodes(userId: string, nodes: SpatialNodeData[]): Promise<number> {
  if (!userId || !nodes || nodes.length === 0) return 0;
  let savedCount = 0;
  const BATCH_SIZE = 400; // Firestore allows up to 500 operations per batch

  try {
    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const chunk = nodes.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const node of chunk) {
        if (!node.id) continue;
        const ref = doc(db, 'users', userId, 'user_nodes', node.id);
        batch.set(ref, {
          userId,
          nodeId: node.id,
          code: node.code || '',
          title: (node.title || '').slice(0, 190),
          sector: node.sector || '経済',
          category: node.category || node.sector || '経済',
          summary: (node.summary || '').slice(0, 1900),
          details: (node.details || '').slice(0, 9500),
          source: (node.source || '').slice(0, 500),
          status: node.status || 'ACTIVE',
          r: typeof node.radius_r === 'number' ? node.radius_r : 35,
          theta: typeof node.theta === 'number' ? node.theta : 0,
          phi: typeof node.phi === 'number' ? node.phi : 0,
          createdAt: new Date().toISOString()
        }, { merge: true });
        savedCount++;
      }

      await batch.commit();
    }
    return savedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/user_nodes`);
    return savedCount;
  }
}

export function subscribeUserSpatialNodes(userId: string, onUpdate: (nodes: SpatialNodeData[]) => void): () => void {
  if (!userId) return () => {};
  const path = `users/${userId}/user_nodes`;
  const colRef = collection(db, 'users', userId, 'user_nodes');

  return onSnapshot(colRef, (snapshot) => {
    const list: SpatialNodeData[] = snapshot.docs.map(d => {
      const data = d.data();
      const r = data.r ?? 35;
      const theta = data.theta ?? 0;
      const phi = data.phi ?? 0;
      const x = r * Math.sin(theta) * Math.cos(phi);
      const y = r * Math.sin(phi);
      const z = r * Math.cos(theta) * Math.cos(phi);

      return {
        id: data.nodeId || d.id,
        code: data.code || 'USER-001',
        title: data.title || 'Untitled Node',
        sector: data.sector || '経済',
        category: data.category || data.sector || '経済',
        summary: data.summary || '',
        details: data.details || '',
        source: data.source || 'User Spatially Saved',
        status: data.status || 'ACTIVE',
        score_s: 0.85,
        radius_r: r,
        theta,
        phi,
        position: [x, y, z],
        density_rho: 0.85,
        variance_sigma2: 0.05,
        topologyLabel: '関連',
        corroborationCount: 2,
        workerId: 'user-synced-cloud',
        generation: 1,
        connections: [],
        accentColor: '#10B981',
        tags: [data.sector || '経済', 'CLOUD_SYNCED'],
        metrics: [
          { label: 'CONFIDENCE', value: '96.0%', trend: 'OPTIMAL', sparkline: [90, 94, 96] }
        ],
        telemetry: {
          latency: '1.2 ms',
          bandwidth: '1 Gbps',
          load: 12,
          securityRating: 'CLASS-A',
          subsystems: 4,
        },
        actions: [
          { id: 'inspect', label: '詳細表示', description: 'ノードの空間トポロジーを検証' }
        ]
      };
    });
    onUpdate(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

/**
 * 4. Memoria Reflection Lessons
 */
export async function syncMemoriaLesson(userId: string, lesson: MemoriaLesson): Promise<void> {
  if (!userId || !lesson.id) return;
  const docId = `lesson-${lesson.id}`;
  const path = `users/${userId}/memoria_logs/${docId}`;
  try {
    await setDoc(doc(db, 'users', userId, 'memoria_logs', docId), {
      userId,
      lessonId: String(lesson.id),
      title: (lesson.lesson || '').slice(0, 190),
      takeaway: (lesson.nextTime || '').slice(0, 1900),
      category: lesson.intent || 'GENERAL',
      actionPlan: (lesson.intent || '').slice(0, 1900),
      loggedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeMemoriaLessons(userId: string, onUpdate: (lessons: MemoriaLesson[]) => void): () => void {
  if (!userId) return () => {};
  const path = `users/${userId}/memoria_logs`;
  const colRef = collection(db, 'users', userId, 'memoria_logs');

  return onSnapshot(colRef, (snapshot) => {
    const list: MemoriaLesson[] = snapshot.docs.map((d, index) => {
      const data = d.data();
      return {
        id: parseInt(data.lessonId, 10) || (9000 + index),
        runId: `run-cloud-${d.id}`,
        intent: data.category || 'ユーザー知見',
        verdict: 'pass',
        lesson: data.title || '',
        nextTime: data.takeaway || '',
        tags: ['CloudFirestore', 'Memoria'],
        sectors: ['経済', '記録'],
        workersCount: 24,
        promptVer: 'v2.4',
        created: data.loggedAt || new Date().toISOString(),
        expires: '2027-12-31',
        n: 1,
        helped: 1,
        misled: 0,
        recalledScore: 0.95
      };
    });
    if (list.length > 0) {
      onUpdate(list);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

/**
 * 5. Saved / Bookmarked Nodes
 */
export async function syncSavedNode(userId: string, node: SpatialNodeData): Promise<void> {
  if (!userId || !node.id) return;
  const path = `users/${userId}/saved_nodes/${node.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'saved_nodes', node.id), {
      userId,
      nodeId: node.id,
      title: (node.title || '').slice(0, 190),
      sector: node.sector || '経済',
      summary: (node.summary || '').slice(0, 1900),
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSavedNode(userId: string, nodeId: string): Promise<void> {
  if (!userId || !nodeId) return;
  const path = `users/${userId}/saved_nodes/${nodeId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'saved_nodes', nodeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeSavedNodes(userId: string, onUpdate: (savedNodeIds: string[]) => void): () => void {
  if (!userId) return () => {};
  const path = `users/${userId}/saved_nodes`;
  const colRef = collection(db, 'users', userId, 'saved_nodes');

  return onSnapshot(colRef, (snapshot) => {
    const ids = snapshot.docs.map(doc => doc.id);
    onUpdate(ids);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export { onAuthStateChanged };
export type { User };
