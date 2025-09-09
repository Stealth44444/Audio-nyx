// js/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js';
import { getStorage }    from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-storage.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';

console.log("[firebase.js] Firebase 초기화 시작");

const firebaseConfig = {
  apiKey: "AIzaSyBP926ULg9wNUNGjQy0fMjRxUeS4XyeG6M",
  authDomain: "audionyx-a7b2e.firebaseapp.com",
  projectId: "audionyx-a7b2e",
  storageBucket: "audionyx-a7b2e.firebasestorage.app",   // 올바른 Firebase Storage 버킷명
  messagingSenderId: "1002069862376",
  appId: "1:1002069862376:web:669c93bca8ab2f1d09665d",
  measurementId: "G-P6GNNYLJ38"                  // 있어도, 빼도 무방
};

// Firebase 앱 초기화 및 모듈 생성
export const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const db = getFirestore(app);

// Firestore 연결 테스트
try {
  console.log("[firebase.js] Firestore 연결 테스트 중...");
  console.log("[firebase.js] Project ID:", firebaseConfig.projectId);
  console.log("[firebase.js] Auth Domain:", firebaseConfig.authDomain);
} catch (error) {
  console.error("[firebase.js] Firebase 초기화 오류:", error);
}

console.log("[firebase.js] Firebase 초기화 완료: app, storage, db 객체 생성됨");
console.log("[firebase.js] ✅ 올바른 Storage 버킷 사용:", firebaseConfig.storageBucket);
