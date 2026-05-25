import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Ensures a user's public profile is in sync with their private user document.
 * This is crucial for the ranking system (Real-time & Consistency).
 * 
 * @param userId - The user's UID (preferred for public profiles)
 * @param userEmail - The user's email (used as ID for the private users collection)
 */
export async function syncUserProfile(userId: string, userEmail: string) {
  if (!userId || !userEmail) return;

  try {
    const userDocRef = doc(db, 'users', userEmail);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const profileRef = doc(db, 'public_profiles', userId);

      await setDoc(profileRef, {
        uid: userId,
        displayName: userData.name || 'Maker',
        photoURL: userData.photoURL || null,
        points: userData.points || 0,
        role: userData.role || 'student',
        schoolId: userData.schoolId || null,
        teamId: userData.teamId || null,
        room: userData.room || null
      }, { merge: true });
    }
  } catch (error) {
    console.error(`Failed to sync profile for ${userEmail}:`, error);
  }
}

/**
 * Increment points in both private user doc and public profile (ranking).
 * This ensures the ranking is updated IMMEDIATELY when points are awarded.
 */
export async function awardPoints(userId: string, userEmail: string, points: number) {
  if (!userId || !userEmail || points === 0) return;

  try {
    const userRef = doc(db, 'users', userEmail);
    const profileRef = doc(db, 'public_profiles', userId);

    // Update both in parallel (or consider batch/transaction if absolute atomicity is needed, 
    // but separate set/update is usually fine for points syncing logic)
    await Promise.all([
      setDoc(userRef, { points: increment(points) }, { merge: true }),
      setDoc(profileRef, { points: increment(points) }, { merge: true })
    ]);
  } catch (error) {
    console.error(`Failed to award points for ${userEmail}:`, error);
  }
}
