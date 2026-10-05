import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

const firebaseConfig = {
  projectId: "grana3d-50f06",
  appId: "1:1058476077888:web:38ca66cbadbe96ba8480a5",
  storageBucket: "grana3d-50f06.firebasestorage.app",
  apiKey: "AIzaSyCxTmw1jeRQ2vi4Q5wYxWBmNPomkuIea5A",
  authDomain: "grana3d-50f06.firebaseapp.com",
  messagingSenderId: "1058476077888",
  measurementId: "G-XTHM4G73Y5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function loginWithFirebaseGoogle() {
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logoutFirebase() {
  await signOut(auth);
}

export { onAuthStateChanged };
