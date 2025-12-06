import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB982avVGou8xjPr0Pe7-nIm6SEJWUX0nU',
  authDomain: 'big3project.firebaseapp.com',
  projectId: 'big3project',
  storageBucket: 'big3project.firebasestorage.app',
  messagingSenderId: '403829088777',
  appId: '1:403829088777:web:4dc7e151f4fbdc94bd0ed8',
  measurementId: 'G-WZT97WSZ18',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export default app;
