import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCVH_lhhEkf0Lqt2gzOpzPwksFFzGKZfV4",
  authDomain: "gym-tracker-ba091.firebaseapp.com",
  projectId: "gym-tracker-ba091",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let firestoreInstance: Firestore | undefined;

function isNativeAppRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.hostname === "localhost" ||
    Boolean(
      (window as typeof window & {
        Capacitor?: { isNativePlatform?: () => boolean };
      }).Capacitor?.isNativePlatform?.()
    )
  );
}

function createFirestore() {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  if (typeof window === "undefined") {
    firestoreInstance = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
    return firestoreInstance;
  }

  try {
    if (isNativeAppRuntime()) {
      // Capacitor/WebView is more stable with a simple local cache setup.
      firestoreInstance = initializeFirestore(app, {
        localCache: memoryLocalCache(),
      });
      return firestoreInstance;
    }

    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache(),
    });
    return firestoreInstance;
  } catch (error) {
    console.warn("Falling back to a safer Firestore setup on this device.", error);

    try {
      firestoreInstance = initializeFirestore(app, {
        localCache: memoryLocalCache(),
      });
      return firestoreInstance;
    } catch (fallbackError) {
      console.warn("Falling back to default Firestore instance.", fallbackError);

      firestoreInstance = getFirestore(app);
      return firestoreInstance;
    }
  }
}

export const db = createFirestore();
