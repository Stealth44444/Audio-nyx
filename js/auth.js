// Firebase 인증 관련 기능
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  isSignInWithEmailLink
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js';

// firebase.js에서 app 가져오기
import { app } from './firebase.js';
import { db } from './firebase.js';
import { doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';

// DOM 요소
const btnLogin = document.getElementById('btn-login');
const btnSignup = document.getElementById('btn-signup');
const btnLogout = document.getElementById('btn-logout');
const authButtons = document.querySelector('.auth-buttons');
const userProfile = document.getElementById('user-profile');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const dropdownMenu = document.getElementById('dropdown-menu');

// 자체 로그인 모달 관련 요소
const authModal = document.getElementById('auth-modal');
const authModalClose = document.getElementById('auth-modal-close');
const googleAuthBtn = document.getElementById('google-auth-btn');
const kakaoAuthBtn = document.getElementById('kakao-auth-btn');
const naverAuthBtn = document.getElementById('naver-auth-btn');
const emailAuthBtn = document.getElementById('email-auth-btn');
const phoneAuthBtn = document.getElementById('phone-auth-btn');

// Firebase 인증 객체 초기화 (app 객체 전달)
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 카카오 SDK 초기화
function initKakao() {
  if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
    const KAKAO_JS_KEY = 'YOUR_KAKAO_JAVASCRIPT_KEY';
    if (KAKAO_JS_KEY === 'YOUR_KAKAO_JAVASCRIPT_KEY') {
      console.warn('카카오 JavaScript 키가 설정되지 않았습니다. 카카오 개발자 콘솔에서 앱을 등록하고 JavaScript 키를 발급받아 설정해주세요.');
      return;
    }
    Kakao.init(KAKAO_JS_KEY);
    console.log('카카오 SDK 초기화 완료:', Kakao.isInitialized());
  }
}

// 네이버 SDK 초기화
let naver_id_login = null;

function initNaver() {
  if (typeof naver_id_login_js !== 'undefined') {
    const NAVER_CLIENT_ID = 'YOUR_NAVER_CLIENT_ID';
    const NAVER_CALLBACK_URL = window.location.origin + '/auth/naver/callback';
    if (NAVER_CLIENT_ID === 'YOUR_NAVER_CLIENT_ID') {
      console.warn('네이버 클라이언트 ID가 설정되지 않았습니다. 네이버 개발자 센터에서 앱을 등록하고 클라이언트 ID를 발급받아 설정해주세요.');
      return;
    }
    try {
      naver_id_login = new naver_id_login(NAVER_CLIENT_ID, NAVER_CALLBACK_URL);
      naver_id_login.setDomain(window.location.hostname);
      naver_id_login.setPopup();
      naver_id_login.init_naver_id_login();
      console.log('네이버 SDK 초기화 완료');
    } catch (error) {
      console.error('네이버 SDK 초기화 실패:', error);
    }
  }
}

// DOM이 로드된 후 카카오 SDK 초기화
document.addEventListener('DOMContentLoaded', () => {
  // 카카오 SDK가 로드될 때까지 대기
  const checkKakaoSDK = setInterval(() => {
    if (typeof Kakao !== 'undefined') {
      initKakao();
      clearInterval(checkKakaoSDK);
    }
  }, 100);
  
  // 네이버 SDK가 로드될 때까지 대기
  const checkNaverSDK = setInterval(() => {
    if (typeof naver_id_login_js !== 'undefined') {
      initNaver();
      clearInterval(checkNaverSDK);
    }
  }, 100);
  
  // 페이지 로드 시 이메일 링크 로그인 확인
  checkEmailLinkSignIn();
});

// 사용자 상태 변경 감지
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Firebase 로그인 상태
    console.log('로그인된 사용자:', user);
    if (authButtons) {
      authButtons.style.display = 'none';
    }
    if (userProfile) {
      userProfile.style.display = 'flex';
      userAvatar.src = user.photoURL || '../images/default-avatar.png';
      userName.textContent = user.displayName || '사용자';
    }
    // 로그인 시 네비게이션 접근 권한 업데이트
    updateNavigationAccessOnLogin(user);
  } else {
    // Firebase 로그아웃 상태 - 카카오/네이버 로그인 상태 확인
    checkSocialLoginStatus();
  }
});

// 신규 회원 Firestore 저장 함수
async function saveUserToFirestore(user) {
  if (!user || !user.uid) return;
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      // 신규 회원만 저장
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        provider: user.provider || '',
        createdAt: serverTimestamp()
      });
      console.log('신규 회원 Firestore 저장 완료:', user.uid);
    }
  } catch (error) {
    console.error('Firestore 회원 저장 실패:', error);
  }
}

// 구글 로그인 처리
async function handleGoogleLogin() {
  try {
    const result = await signInWithPopup(auth, provider);
    console.log('구글 로그인 성공:', result.user);
    await saveUserToFirestore(result.user);
    showNotification('로그인되었습니다.');
  } catch (error) {
    console.error('구글 로그인 실패:', error);
    showNotification('로그인 중 오류가 발생했습니다.', true);
  }
}

// 로그아웃 처리
async function handleLogout() {
  try {
    // 카카오 로그인 상태 확인 및 로그아웃
    const kakaoUser = localStorage.getItem('kakaoUser');
    if (kakaoUser) {
      await handleKakaoLogout();
    }
    
    // 네이버 로그인 상태 확인 및 로그아웃
    const naverUser = localStorage.getItem('naverUser');
    if (naverUser) {
      await handleNaverLogout();
    }
    
    // Firebase 로그아웃
    await signOut(auth);
    
    // UI 초기화
    if (authButtons) {
      authButtons.style.display = 'flex';
    }
    if (userProfile) {
      userProfile.style.display = 'none';
    }
    
    // 로그아웃 시 네비게이션 접근 권한 재설정
    updateNavigationAccess(null);
    
    console.log('로그아웃 성공');
    showNotification('로그아웃되었습니다.');
  } catch (error) {
    console.error('로그아웃 실패:', error);
    showNotification('로그아웃 중 오류가 발생했습니다.', true);
  }
}

// 소셜 로그인 상태 확인 (카카오, 네이버)
function checkSocialLoginStatus() {
  // 카카오 로그인 상태 확인
  const kakaoUser = localStorage.getItem('kakaoUser');
  if (kakaoUser) {
    try {
      const user = JSON.parse(kakaoUser);
      updateUIForKakaoUser(user);
      console.log('카카오 로그인 상태 복원:', user);
      return;
    } catch (error) {
      console.error('카카오 사용자 정보 파싱 실패:', error);
      localStorage.removeItem('kakaoUser');
    }
  }
  
  // 네이버 로그인 상태 확인
  const naverUser = localStorage.getItem('naverUser');
  if (naverUser) {
    try {
      const user = JSON.parse(naverUser);
      updateUIForNaverUser(user);
      console.log('네이버 로그인 상태 복원:', user);
      return;
    } catch (error) {
      console.error('네이버 사용자 정보 파싱 실패:', error);
      localStorage.removeItem('naverUser');
    }
  }
  
  // 모든 소셜 로그인이 없는 경우 - 로그아웃 상태
  if (authButtons) {
    authButtons.style.display = 'flex';
  }
  if (userProfile) {
    userProfile.style.display = 'none';
  }
}

// 자체 로그인 모달 열기
function openAuthModal() {
  if (authModal) {
    authModal.style.display = 'flex';
    setTimeout(() => {
      authModal.classList.add('show');
    }, 10);
    document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
  }
}

// 자체 로그인 모달 닫기
function closeAuthModal() {
  if (authModal) {
    authModal.classList.remove('show');
    setTimeout(() => {
      authModal.style.display = 'none';
      document.body.style.overflow = ''; // 배경 스크롤 복원
    }, 300);
  }
}

// 구글 로그인 처리 (기존 함수 재사용)
async function handleGoogleLoginFromModal() {
  try {
    closeAuthModal(); // 모달 먼저 닫기
    const result = await signInWithPopup(auth, provider);
    console.log('구글 로그인 성공:', result.user);
    await saveUserToFirestore(result.user);
    showNotification('로그인되었습니다.');
  } catch (error) {
    console.error('구글 로그인 실패:', error);
    showNotification('로그인 중 오류가 발생했습니다.', true);
  }
}

// 카카오 로그인
async function handleKakaoLogin() {
  try {
    if (!Kakao.isInitialized()) {
      console.warn('카카오 SDK가 초기화되지 않았습니다.');
      return;
    }
    closeAuthModal();
    // ...
  } catch (error) {
    console.error('카카오 로그인 실패:', error);
  }
}

// 카카오 로그인과 Firebase 인증 연동
async function handleKakaoFirebaseAuth(accessToken, userInfo) {
  try {
    // 임시로 카카오 사용자 정보를 로컬에서 처리
    // 실제 운영 환경에서는 백엔드 서버에서 Custom Token을 생성해야 합니다
    
    // 카카오 사용자 정보를 기반으로 Firebase 사용자 상태 업데이트
    const kakaoUser = {
      uid: `kakao_${userInfo.id}`,
      displayName: userInfo.properties?.nickname || '카카오 사용자',
      photoURL: userInfo.properties?.profile_image || null,
      email: userInfo.kakao_account?.email || null,
      provider: 'kakao'
    };
    
    // 사용자 정보를 로컬 스토리지에 저장 (임시)
    localStorage.setItem('kakaoUser', JSON.stringify(kakaoUser));
    
    // UI 업데이트
    updateUIForKakaoUser(kakaoUser);
    
    await saveUserToFirestore(kakaoUser);
    
    console.log('카카오 Firebase 연동 완료:', kakaoUser);
    
  } catch (error) {
    console.error('카카오 Firebase 연동 실패:', error);
    throw error;
  }
}

// 카카오 사용자를 위한 UI 업데이트
function updateUIForKakaoUser(user) {
  if (authButtons) {
    authButtons.style.display = 'none';
  }
  if (userProfile) {
    userProfile.style.display = 'flex';
    userAvatar.src = user.photoURL || '../images/default-avatar.png';
    userName.textContent = user.displayName || '카카오 사용자';
  }
  // 카카오 로그인 시 네비게이션 접근 권한 업데이트
  updateNavigationAccessOnLogin(user);
}

// 카카오 로그아웃
async function handleKakaoLogout() {
  try {
    if (Kakao.Auth.getAccessToken()) {
      await new Promise((resolve, reject) => {
        Kakao.Auth.logout({
          success: resolve,
          fail: reject
        });
      });
    }
    
    // 로컬 스토리지에서 카카오 사용자 정보 제거
    localStorage.removeItem('kakaoUser');
    
    console.log('카카오 로그아웃 완료');
  } catch (error) {
    console.error('카카오 로그아웃 실패:', error);
  }
}

// 네이버 로그인
async function handleNaverLogin() {
  try {
    if (!naver_id_login) {
      console.warn('네이버 SDK가 초기화되지 않았습니다.');
      return;
    }
    closeAuthModal();
    // ...
  } catch (error) {
    console.error('네이버 로그인 실패:', error);
  }
}

// 네이버 로그인 결과 확인
function checkNaverLoginResult() {
  try {
    // 네이버 로그인 상태 확인
    if (naver_id_login.getAccessToken()) {
      console.log('네이버 로그인 성공');
      
      // 사용자 정보 가져오기
      naver_id_login.get_naver_userprofile('handleNaverUserProfile');
    } else {
      console.log('네이버 로그인 실패 또는 취소');
    }
  } catch (error) {
    console.error('네이버 로그인 결과 확인 실패:', error);
  }
}

// 네이버 사용자 프로필 처리 (전역 함수로 선언)
window.handleNaverUserProfile = async function() {
  try {
    const userInfo = {
      id: naver_id_login.getProfileData('id'),
      email: naver_id_login.getProfileData('email'),
      nickname: naver_id_login.getProfileData('nickname'),
      name: naver_id_login.getProfileData('name'),
      profile_image: naver_id_login.getProfileData('profile_image'),
      age: naver_id_login.getProfileData('age'),
      gender: naver_id_login.getProfileData('gender'),
      birthday: naver_id_login.getProfileData('birthday')
    };
    
    console.log('네이버 사용자 정보:', userInfo);
    
    // Firebase 연동
    await handleNaverFirebaseAuth(naver_id_login.getAccessToken(), userInfo);
    
    console.log('네이버 로그인이 완료되었습니다.');
    
  } catch (error) {
    console.error('네이버 사용자 정보 처리 실패:', error);
    showNotification('사용자 정보를 가져오는 중 오류가 발생했습니다.', true);
  }
};

// 네이버 로그인과 Firebase 인증 연동
async function handleNaverFirebaseAuth(accessToken, userInfo) {
  try {
    // 임시로 네이버 사용자 정보를 로컬에서 처리
    // 실제 운영 환경에서는 백엔드 서버에서 Custom Token을 생성해야 합니다
    
    // 네이버 사용자 정보를 기반으로 Firebase 사용자 상태 업데이트
    const naverUser = {
      uid: `naver_${userInfo.id}`,
      displayName: userInfo.nickname || userInfo.name || '네이버 사용자',
      photoURL: userInfo.profile_image || null,
      email: userInfo.email || null,
      provider: 'naver',
      age: userInfo.age,
      gender: userInfo.gender,
      birthday: userInfo.birthday
    };
    
    // 사용자 정보를 로컬 스토리지에 저장 (임시)
    localStorage.setItem('naverUser', JSON.stringify(naverUser));
    
    // UI 업데이트
    updateUIForNaverUser(naverUser);
    
    await saveUserToFirestore(naverUser);
    
    console.log('네이버 Firebase 연동 완료:', naverUser);
    
  } catch (error) {
    console.error('네이버 Firebase 연동 실패:', error);
    throw error;
  }
}

// 네이버 사용자를 위한 UI 업데이트
function updateUIForNaverUser(user) {
    if (authButtons) {
    authButtons.style.display = 'none';
    }
    if (userProfile) {
    userProfile.style.display = 'flex';
    userAvatar.src = user.photoURL || '../images/default-avatar.png';
    userName.textContent = user.displayName || '네이버 사용자';
    }
    // 네이버 로그인 시 네비게이션 접근 권한 업데이트
    updateNavigationAccessOnLogin(user);
  }

// 네이버 로그아웃
async function handleNaverLogout() {
  try {
    if (naver_id_login && naver_id_login.getAccessToken()) {
      naver_id_login.logout();
    }
    
    // 로컬 스토리지에서 네이버 사용자 정보 제거
    localStorage.removeItem('naverUser');
    
    console.log('네이버 로그아웃 완료');
  } catch (error) {
    console.error('네이버 로그아웃 실패:', error);
  }
}

// 이메일 로그인
function handleEmailLogin() {
  console.log('이메일 로그인 버튼 클릭됨');
  showEmailLoginModal();
}

// 전화번호 로그인 (추후 연결)
function handlePhoneLogin() {
  console.log('전화번호 로그인 - 추후 연결 예정');
  showNotification('전화번호 로그인은 준비 중입니다.', true);
}

// reCAPTCHA 인증기 설정
function setupRecaptcha() {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
      'size': 'invisible',
      'callback': (response) => {
        console.log('reCAPTCHA 완료');
      },
      'expired-callback': () => {
        console.log('reCAPTCHA 만료');
        showNotification('인증이 만료되었습니다. 다시 시도해주세요.', true);
      }
    }, auth);
  }
  return recaptchaVerifier;
}

// 전화번호로 인증 코드 전송
async function sendVerificationCode(phoneNumber) {
  try {
    const appVerifier = setupRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    console.log('인증 코드 전송 성공');
    showNotification('인증 코드가 전송되었습니다.');
    return true;
  } catch (error) {
    console.error('인증 코드 전송 실패:', error);
    
    // reCAPTCHA 재설정
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
    
    let errorMessage = '인증 코드 전송에 실패했습니다.';
    if (error.code === 'auth/invalid-phone-number') {
      errorMessage = '올바른 전화번호를 입력해주세요.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';
    }
    
    showNotification(errorMessage, true);
    return false;
  }
}

// 인증 코드로 로그인 확인
async function verifyCode(code) {
  try {
    if (!confirmationResult) {
      throw new Error('인증 코드 전송이 완료되지 않았습니다.');
    }
    
    const result = await confirmationResult.confirm(code);
    console.log('전화번호 로그인 성공:', result.user);
    showNotification('로그인되었습니다.');
    return true;
  } catch (error) {
    console.error('인증 코드 확인 실패:', error);
    
    let errorMessage = '인증 코드가 올바르지 않습니다.';
    if (error.code === 'auth/invalid-verification-code') {
      errorMessage = '인증 코드가 올바르지 않습니다.';
    } else if (error.code === 'auth/code-expired') {
      errorMessage = '인증 코드가 만료되었습니다. 다시 요청해주세요.';
    }
    
    showNotification(errorMessage, true);
    return false;
  }
}

// 전화번호 로그인 모달 표시
function showPhoneLoginModal() {
  // 기존 로그인 모달 닫기
  closeAuthModal();
  
  // 전화번호 로그인 모달 표시
  const phoneModal = createPhoneLoginModal();
  document.body.appendChild(phoneModal);
  
  setTimeout(() => {
    phoneModal.classList.add('show');
  }, 10);
  
  document.body.style.overflow = 'hidden';
}

// 전화번호 로그인 모달 생성
function createPhoneLoginModal() {
  const modal = document.createElement('div');
  modal.id = 'phone-auth-modal';
  modal.className = 'auth-modal';
  
  modal.innerHTML = `
    <div class="auth-modal-content">
      <button class="auth-modal-close" id="phone-modal-close">&times;</button>
      
      <div class="auth-modal-header">
        <h2 class="auth-modal-title">전화번호 로그인</h2>
        <p class="auth-modal-subtitle">전화번호를 입력하시면 인증 코드를<br>SMS로 전송해 드립니다</p>
      </div>
      
      <div class="phone-auth-steps">
        <!-- 1단계: 전화번호 입력 -->
        <div class="phone-step" id="phone-step-1">
          <div class="form-group">
            <label for="phone-number">전화번호</label>
            <div class="phone-input-group">
              <select id="country-code" class="country-select">
                <option value="+82">🇰🇷 +82</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+81">🇯🇵 +81</option>
                <option value="+86">🇨🇳 +86</option>
              </select>
              <input type="tel" id="phone-number" placeholder="010-1234-5678" class="phone-input">
            </div>
            <p class="phone-notice">SMS 인증 메시지가 발송되며, 일반 요금이 부과될 수 있습니다.</p>
          </div>
          <button class="btn-primary" id="send-code-btn">인증 코드 전송</button>
        </div>
        
        <!-- 2단계: 인증 코드 입력 -->
        <div class="phone-step" id="phone-step-2" style="display: none;">
          <div class="form-group">
            <label for="verification-code">인증 코드</label>
            <input type="text" id="verification-code" placeholder="6자리 인증 코드" class="verification-input" maxlength="6">
            <p class="phone-notice">SMS로 전송된 6자리 인증 코드를 입력해주세요.</p>
          </div>
          <div class="phone-step-actions">
            <button class="btn-secondary" id="back-to-phone-btn">다시 입력</button>
            <button class="btn-primary" id="verify-code-btn">로그인</button>
          </div>
        </div>
      </div>
      
      <!-- reCAPTCHA 컨테이너 -->
      <div id="recaptcha-container"></div>
    </div>
  `;
  
  // 이벤트 리스너 추가
  setupPhoneModalEvents(modal);
  
  return modal;
}

// 전화번호 로그인 모달 이벤트 설정
function setupPhoneModalEvents(modal) {
  const closeBtn = modal.querySelector('#phone-modal-close');
  const sendCodeBtn = modal.querySelector('#send-code-btn');
  const verifyCodeBtn = modal.querySelector('#verify-code-btn');
  const backToPhoneBtn = modal.querySelector('#back-to-phone-btn');
  const phoneInput = modal.querySelector('#phone-number');
  const codeInput = modal.querySelector('#verification-code');
  
  // 모달 닫기
  closeBtn.addEventListener('click', () => closePhoneModal(modal));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePhoneModal(modal);
  });
  
  // 인증 코드 전송
  sendCodeBtn.addEventListener('click', async () => {
    const countryCode = modal.querySelector('#country-code').value;
    const phoneNumber = phoneInput.value.trim();
    
    if (!phoneNumber) {
      showNotification('전화번호를 입력해주세요.', true);
      return;
    }
    
    // 전화번호 포맷팅 (한국 번호의 경우)
    let formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (countryCode === '+82' && formattedPhone.startsWith('0')) {
      formattedPhone = formattedPhone.substring(1);
    }
    const fullPhoneNumber = countryCode + formattedPhone;
    
    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = '전송 중...';
    
    const success = await sendVerificationCode(fullPhoneNumber);
    
    if (success) {
      // 2단계로 이동
      modal.querySelector('#phone-step-1').style.display = 'none';
      modal.querySelector('#phone-step-2').style.display = 'block';
      codeInput.focus();
    }
    
    sendCodeBtn.disabled = false;
    sendCodeBtn.textContent = '인증 코드 전송';
  });
  
  // 인증 코드 확인
  verifyCodeBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    
    if (!code || code.length !== 6) {
      showNotification('6자리 인증 코드를 입력해주세요.', true);
      return;
    }
    
    verifyCodeBtn.disabled = true;
    verifyCodeBtn.textContent = '확인 중...';
    
    const success = await verifyCode(code);
    
    if (success) {
      closePhoneModal(modal);
    }
    
    verifyCodeBtn.disabled = false;
    verifyCodeBtn.textContent = '로그인';
  });
  
  // 다시 입력
  backToPhoneBtn.addEventListener('click', () => {
    modal.querySelector('#phone-step-2').style.display = 'none';
    modal.querySelector('#phone-step-1').style.display = 'block';
    phoneInput.focus();
  });
  
  // Enter 키 처리
  phoneInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendCodeBtn.click();
  });
  
  codeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyCodeBtn.click();
  });
  
  // 숫자만 입력 허용 (인증 코드)
  codeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });
}

// 전화번호 로그인 모달 닫기
function closePhoneModal(modal) {
  modal.classList.remove('show');
  setTimeout(() => {
    if (modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
    document.body.style.overflow = '';
  }, 300);
  
  // reCAPTCHA 정리
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}

// 기존 로그인/회원가입 버튼을 자체 모달로 연결
if (btnLogin) {
  btnLogin.addEventListener('click', openAuthModal);
}

if (btnSignup) {
  btnSignup.addEventListener('click', openAuthModal);
}

// 모달 닫기 이벤트
if (authModalClose) {
  authModalClose.addEventListener('click', closeAuthModal);
}

// 모달 외부 클릭 시 닫기
if (authModal) {
  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
      closeAuthModal();
    }
  });
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && authModal && authModal.classList.contains('show')) {
    closeAuthModal();
  }
});

// 각 로그인 방식 버튼 이벤트 리스너
if (googleAuthBtn) {
  googleAuthBtn.addEventListener('click', handleGoogleLoginFromModal);
}

if (kakaoAuthBtn) {
  kakaoAuthBtn.addEventListener('click', handleKakaoLogin);
}

if (naverAuthBtn) {
  naverAuthBtn.addEventListener('click', handleNaverLogin);
}

if (emailAuthBtn) {
  emailAuthBtn.addEventListener('click', handleEmailLogin);
}

if (phoneAuthBtn) {
  phoneAuthBtn.addEventListener('click', () => {
    console.log('전화번호 로그인 버튼 클릭됨');
    showPhoneLoginModal();
  });
}

// 로그아웃 버튼 이벤트
if (btnLogout) {
  btnLogout.addEventListener('click', function(e) {
    e.preventDefault(); // 기본 동작 방지
    handleLogout(); // 로그아웃 함수 호출
    if (dropdownMenu) {
      dropdownMenu.classList.remove('show'); // 드롭다운 메뉴 닫기
    }
  });
}

// 프로필 드롭다운 메뉴 토글 - 요소가 존재할 때만 이벤트 등록
if (userProfile) {
  userProfile.addEventListener('click', function(e) {
    // 드롭다운 메뉴 내의 링크나 버튼을 클릭한 경우 토글하지 않음
    if (e.target.closest('.dropdown-item')) {
      return; // 링크 클릭은 그대로 진행
    }
    
    e.stopPropagation(); // 이벤트 버블링 방지
    e.preventDefault(); // 기본 동작 방지
    
    if (dropdownMenu) {
      console.log('프로필 메뉴 클릭: 드롭다운 토글');
      // 강제로 클래스 추가/제거
      const isVisible = dropdownMenu.classList.contains('show');
      if (isVisible) {
        dropdownMenu.classList.remove('show');
        userProfile.setAttribute('aria-expanded', 'false');
        console.log('드롭다운 메뉴 숨김');
      } else {
        dropdownMenu.classList.add('show');
        userProfile.setAttribute('aria-expanded', 'true');
        console.log('드롭다운 메뉴 표시');
      }
    }
  });
}

// 드롭다운 메뉴 내 FAQ 링크 클릭 이벤트 처리
if (dropdownMenu) {
  // 모든 드롭다운 아이템에 대해 이벤트 처리
  const dropdownItems = dropdownMenu.querySelectorAll('.dropdown-item');
  dropdownItems.forEach(item => {
    item.addEventListener('click', function(e) {
      console.log('드롭다운 아이템 클릭됨:', this.textContent.trim());
      
      // 로그아웃 버튼이 아닌 경우 (링크인 경우)
      if (!this.id || this.id !== 'btn-logout') {
        // 드롭다운 메뉴 닫기
        dropdownMenu.classList.remove('show');
        if (userProfile) {
          userProfile.setAttribute('aria-expanded', 'false');
        }
        // 링크는 정상적으로 작동하도록 함 (preventDefault 호출하지 않음)
      }
    });
  });
}

// 드롭다운 메뉴 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
  if (userProfile && dropdownMenu && !userProfile.contains(e.target)) {
    console.log('문서 클릭: 드롭다운 메뉴 닫기');
    dropdownMenu.classList.remove('show');
    if (userProfile) {
      userProfile.setAttribute('aria-expanded', 'false');
    }
  }
});

// 알림 표시 함수
function showNotification(message, isError = false) {
  const notification = document.createElement('div');
  notification.className = `notification ${isError ? 'error' : ''}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// 이메일 로그인 모달 표시
function showEmailLoginModal() {
  // 기존 로그인 모달 닫기
  closeAuthModal();
  
  // 이메일 로그인 모달 표시
  const emailModal = createEmailLoginModal();
  document.body.appendChild(emailModal);
  
  setTimeout(() => {
    emailModal.classList.add('show');
  }, 10);
  
  document.body.style.overflow = 'hidden';
}

// 이메일 로그인 모달 생성
function createEmailLoginModal() {
  const modal = document.createElement('div');
  modal.id = 'email-auth-modal';
  modal.className = 'auth-modal';
  
  modal.innerHTML = `
    <div class="auth-modal-content">
      <button class="auth-modal-close" id="email-modal-close">&times;</button>
      
      <div class="auth-modal-header">
        <h2 class="auth-modal-title">이메일 로그인</h2>
        <p class="auth-modal-subtitle">이메일 주소를 입력하시면 로그인 링크를<br>이메일로 전송해 드립니다</p>
      </div>
      
      <div class="email-auth-steps">
        <!-- 1단계: 이메일 입력 -->
        <div class="email-step" id="email-step-1">
          <div class="form-group">
            <label for="email-address">이메일 주소</label>
            <input type="email" id="email-address" placeholder="example@email.com" class="email-input">
            <p class="email-notice">입력하신 이메일로 로그인 링크가 전송됩니다. 스팸 폴더도 확인해 주세요.</p>
          </div>
          <button class="btn-primary" id="send-email-btn">로그인 링크 전송</button>
        </div>
        
        <!-- 2단계: 이메일 전송 완료 -->
        <div class="email-step" id="email-step-2" style="display: none;">
          <div class="email-sent-message">
            <div class="email-icon">📧</div>
            <h3>이메일을 확인해 주세요</h3>
            <p id="sent-email-address"></p>
            <p class="email-instruction">위 이메일 주소로 로그인 링크를 전송했습니다.<br>이메일의 링크를 클릭하여 로그인을 완료해 주세요.</p>
            <div class="email-step-actions">
              <button class="btn-secondary" id="back-to-email-btn">다른 이메일 사용</button>
              <button class="btn-primary" id="resend-email-btn">다시 전송</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // 이벤트 리스너 추가
  setupEmailModalEvents(modal);
  
  return modal;
}

// 이메일 로그인 모달 이벤트 설정
function setupEmailModalEvents(modal) {
  const closeBtn = modal.querySelector('#email-modal-close');
  const sendEmailBtn = modal.querySelector('#send-email-btn');
  const resendEmailBtn = modal.querySelector('#resend-email-btn');
  const backToEmailBtn = modal.querySelector('#back-to-email-btn');
  const emailInput = modal.querySelector('#email-address');
  
  let currentEmail = '';
  
  // 모달 닫기
  closeBtn.addEventListener('click', () => closeEmailModal(modal));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeEmailModal(modal);
  });
  
  // 이메일 링크 전송
  sendEmailBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    
    if (!email) {
      showNotification('이메일 주소를 입력해주세요.', true);
      return;
    }
    
    if (!isValidEmail(email)) {
      showNotification('올바른 이메일 주소를 입력해주세요.', true);
      return;
    }
    
    sendEmailBtn.disabled = true;
    sendEmailBtn.textContent = '전송 중...';
    
    const success = await sendEmailSignInLink(email);
    
    if (success) {
      currentEmail = email;
      // 2단계로 이동
      modal.querySelector('#email-step-1').style.display = 'none';
      modal.querySelector('#email-step-2').style.display = 'block';
      modal.querySelector('#sent-email-address').textContent = email;
    }
    
    sendEmailBtn.disabled = false;
    sendEmailBtn.textContent = '로그인 링크 전송';
  });
  
  // 이메일 다시 전송
  resendEmailBtn.addEventListener('click', async () => {
    if (!currentEmail) return;
    
    resendEmailBtn.disabled = true;
    resendEmailBtn.textContent = '전송 중...';
    
    await sendEmailSignInLink(currentEmail);
    
    resendEmailBtn.disabled = false;
    resendEmailBtn.textContent = '다시 전송';
  });
  
  // 다른 이메일 사용
  backToEmailBtn.addEventListener('click', () => {
    modal.querySelector('#email-step-2').style.display = 'none';
    modal.querySelector('#email-step-1').style.display = 'block';
    emailInput.focus();
  });
  
  // Enter 키 처리
  emailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendEmailBtn.click();
  });
}

// 이메일 유효성 검사
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 이메일 로그인 링크 전송
async function sendEmailSignInLink(email) {
  try {
    const actionCodeSettings = {
      // 로그인 완료 후 리다이렉트될 URL
      url: window.location.origin + '/auth/email/callback',
      // 앱에서 링크를 처리하도록 설정
      handleCodeInApp: true,
    };
    
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    
    // 이메일을 로컬 스토리지에 저장 (로그인 완료 시 필요)
    localStorage.setItem('emailForSignIn', email);
    
    console.log('이메일 로그인 링크 전송 성공');
    showNotification('로그인 링크가 이메일로 전송되었습니다.');
    return true;
    
  } catch (error) {
    console.error('이메일 로그인 링크 전송 실패:', error);
    
    let errorMessage = '이메일 전송에 실패했습니다.';
    if (error.code === 'auth/invalid-email') {
      errorMessage = '올바른 이메일 주소를 입력해주세요.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';
    }
    
    showNotification(errorMessage, true);
    return false;
  }
}

// 이메일 로그인 모달 닫기
function closeEmailModal(modal) {
  modal.classList.remove('show');
  setTimeout(() => {
    if (modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
    document.body.style.overflow = '';
  }, 300);
}

// 페이지 로드 시 이메일 링크 로그인 확인
function checkEmailLinkSignIn() {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    // 이메일 링크로 접근한 경우
    let email = localStorage.getItem('emailForSignIn');
    
    if (!email) {
      // 이메일이 저장되지 않은 경우 사용자에게 입력 요청
      email = window.prompt('로그인을 완료하려면 이메일 주소를 입력해주세요:');
    }
    
    if (email) {
      completeEmailSignIn(email, window.location.href);
    }
  }
}

// 이메일 링크 로그인 완료
async function completeEmailSignIn(email, emailLink) {
  try {
    const result = await signInWithEmailLink(auth, email, emailLink);
    
    // 로컬 스토리지에서 이메일 제거
    localStorage.removeItem('emailForSignIn');
    
    console.log('이메일 로그인 성공:', result.user);
    await saveUserToFirestore(result.user);
    showNotification('이메일 로그인이 완료되었습니다.');
    
    // URL에서 쿼리 파라미터 제거
    window.history.replaceState({}, document.title, window.location.pathname);
    
  } catch (error) {
    console.error('이메일 로그인 완료 실패:', error);
    
    let errorMessage = '이메일 로그인에 실패했습니다.';
    if (error.code === 'auth/invalid-action-code') {
      errorMessage = '로그인 링크가 유효하지 않거나 만료되었습니다.';
    } else if (error.code === 'auth/expired-action-code') {
      errorMessage = '로그인 링크가 만료되었습니다. 새로운 링크를 요청해주세요.';
    }
    
    showNotification(errorMessage, true);
  }
}

// 페이지별 접근 권한 설정
const PAGE_ACCESS_CONFIG = {
  // 로그인 없이 접근 가능한 페이지
  publicPages: [
    '/',
    '/index.html',
    '/pages/brand.html',
    '/pages/find-music.html',
    '/pages/faq.html'
  ],
  // 로그인이 필요한 페이지
  protectedPages: [
    '/pages/channel-management.html',
    '/pages/track-production.html',
    '/pages/withdraw.html'
  ],
  // 페이지별 설명
  pageDescriptions: {
    '/pages/channel-management.html': '채널 관리',
    '/pages/track-production.html': '트랙 제작 요청',
    '/pages/withdraw.html': '계좌 등록 및 정산'
  }
};

// 접근 제한 유틸 함수 개선
function requireAuthPage() {
  const path = window.location.pathname;
  
  // 로그인 상태 확인 후 네비게이션 메뉴 업데이트
  onAuthStateChanged(auth, (user) => {
    updateNavigationAccess(user);
    
    // 보호된 페이지이고 로그인하지 않은 경우 홈으로 이동
    if (PAGE_ACCESS_CONFIG.protectedPages.includes(path) && !user) {
      // 카카오/네이버 로그인 상태도 확인
      const kakaoUser = localStorage.getItem('kakaoUser');
      const naverUser = localStorage.getItem('naverUser');
      
      if (!kakaoUser && !naverUser) {
        const pageName = PAGE_ACCESS_CONFIG.pageDescriptions[path] || '이 페이지';
        showNotification(`${pageName}는 로그인이 필요합니다.`, true);
        setTimeout(() => {
          window.location.href = '/index.html';
        }, 1500);
      }
    }
  });
}

// 네비게이션 접근 권한 업데이트 개선
function updateNavigationAccess(user) {
  const menuItems = document.querySelectorAll('.menu-area ul li a, .mobile-nav-list .mobile-nav-link');
  
  menuItems.forEach(item => {
    const itemPath = item.getAttribute('href');
    let fullPath = itemPath;
    
    // 상대 경로를 절대 경로로 변환
    if (itemPath && !itemPath.startsWith('/') && !itemPath.startsWith('http')) {
      if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        fullPath = '/' + itemPath;
      } else {
        fullPath = '/' + itemPath;
      }
    }
    
    // 로그인 상태 확인 (Firebase + 소셜 로그인)
    const kakaoUser = localStorage.getItem('kakaoUser');
    const naverUser = localStorage.getItem('naverUser');
    const isLoggedIn = user || kakaoUser || naverUser;
    
    // 보호된 페이지인지 확인
    const isProtectedPage = PAGE_ACCESS_CONFIG.protectedPages.some(protectedPath => 
      fullPath.includes(protectedPath.replace('/pages/', '')) || 
      fullPath === protectedPath
    );
    
    if (isProtectedPage && !isLoggedIn) {
      // 로그인이 필요한 페이지
      item.setAttribute('data-requires-auth', 'true');
      item.addEventListener('click', handleRestrictedNavClick);
      
      // 시각적 표시 추가
      if (!item.querySelector('.auth-required-badge')) {
        const badge = document.createElement('span');
        badge.className = 'auth-required-badge';
        badge.textContent = '🔒';
        badge.title = '로그인 필요';
        item.appendChild(badge);
      }
    } else {
      // 접근 가능한 페이지
      item.removeAttribute('data-requires-auth');
      item.removeEventListener('click', handleRestrictedNavClick);
      
      // 인증 뱃지 제거
      const badge = item.querySelector('.auth-required-badge');
      if (badge) {
        badge.remove();
      }
    }
  });
}

// 제한된 네비게이션 클릭 처리 개선
function handleRestrictedNavClick(e) {
  e.preventDefault();
  const href = e.currentTarget.getAttribute('href');
  let fullPath = href;
  
  if (href && !href.startsWith('/') && !href.startsWith('http')) {
    fullPath = '/' + href;
  }
  
  const pageName = PAGE_ACCESS_CONFIG.pageDescriptions[fullPath] || '해당 페이지';
  showNotification(`${pageName}는 로그인이 필요합니다.`, true);
  
  setTimeout(() => {
    openAuthModal();
  }, 800);
}

// 로그인 시 네비게이션 접근 권한 업데이트
function updateNavigationAccessOnLogin(user) {
  const menuItems = document.querySelectorAll('.menu-area ul li a, .mobile-nav-list .mobile-nav-link');
  menuItems.forEach(item => {
    // 로그인 후에는 모든 메뉴 접근 가능
    item.removeAttribute('data-requires-auth');
    item.removeEventListener('click', handleRestrictedNavClick);
    
    // 인증 뱃지 제거
    const badge = item.querySelector('.auth-required-badge');
    if (badge) {
      badge.remove();
    }
  });
}

// 페이지 로드 시 접근 제한 적용
if (typeof window !== 'undefined') {
  requireAuthPage();
} 