// Firebase 인증 관련 기능
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js';

// firebase.js에서 app 가져오기
import { app } from './firebase.js';
import { db } from './firebase.js';
import { doc, setDoc, getDoc, serverTimestamp, query, collection, where, getDocs
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';

// 유틸리티 함수: 에러, 성공 메시지 표시/숨김
function showError(element, message) {
  console.log('[showError] 호출됨 - 요소:', element, '메시지:', message);
  if (element) {
    element.textContent = message;
    element.style.display = 'block';
    element.style.visibility = 'visible'; // CSS visibility 설정
    element.style.opacity = '1'; // CSS opacity 설정
    element.classList.add('show'); // show 클래스 추가
    element.style.color = '#ff6b6b'; // CSS와 일치하는 에러 색상
    console.log('[showError] 에러 메시지 표시 완료:', message);
  } else {
    console.error('[showError] DOM 요소가 존재하지 않음:', element);
  }
}

function hideError(element) {
  if (element) {
    element.textContent = '';
    element.style.display = 'none';
    element.style.visibility = 'hidden'; // CSS visibility 설정
    element.style.opacity = '0'; // CSS opacity 설정
    element.classList.remove('show'); // show 클래스 제거
  }
}

function showSuccess(element, message) {
  if (element) {
    element.textContent = message;
    element.style.display = 'block';
    element.style.visibility = 'visible'; // CSS visibility 설정
    element.style.opacity = '1'; // CSS opacity 설정
    element.classList.add('show'); // show 클래스 추가
    element.style.color = '#28a745'; // 성공 메시지 색상
  }
}

function hideSuccess(element) {
  if (element) {
    element.textContent = '';
    element.style.display = 'none';
    element.style.visibility = 'hidden'; // CSS visibility 설정
    element.style.opacity = '0'; // CSS opacity 설정
    element.classList.remove('show'); // show 클래스 제거
  }
}

// DOM 요소
const btnLogin = document.getElementById('btn-login');
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
const emailLoginForm = document.getElementById('email-login-form');
const loginEmailIdInput = document.getElementById('login-email-id');
const loginPasswordInput = document.getElementById('login-password');
const loginEmailIdError = document.getElementById('login-email-id-error');
const loginPasswordError = document.getElementById('login-password-error');
const showSignupModalLink = document.getElementById('show-signup-modal-link');

// 자체 회원가입 모달 관련 요소
const signupModal = document.getElementById('signup-modal');
const signupModalClose = document.getElementById('signup-modal-close');
const signupForm = document.getElementById('signup-form');
const signupNicknameInput = document.getElementById('signup-nickname');
const signupPhoneInput = document.getElementById('signup-phone');
const signupEmailInput = document.getElementById('signup-email');
const signupUsernameInput = document.getElementById('signup-username');
const signupPasswordInput = document.getElementById('signup-password');
const signupPasswordConfirmInput = document.getElementById('signup-password-confirm');
const termsAgreeRequiredCheckbox = document.getElementById('terms-agree-required');
const marketingAgreeOptionalCheckbox = document.getElementById('marketing-agree-optional');
const signupNicknameError = document.getElementById('signup-nickname-error');
const signupPhoneError = document.getElementById('signup-phone-error');
const signupEmailError = document.getElementById('signup-email-error');
const signupUsernameError = document.getElementById('signup-username-error');
const signupPasswordError = document.getElementById('signup-password-error');
const signupPasswordConfirmError = document.getElementById('signup-password-confirm-error');
const checkUsernameDuplicateBtn = document.getElementById('check-username-duplicate');
const showLoginModalLink = document.getElementById('show-login-modal-link');
const signupUsernameSuccess = document.getElementById('signup-username-success');

// 온보딩 모달 관련 요소
const onboardingModal = document.getElementById('onboarding-modal');
const onboardingForm = document.getElementById('onboarding-form');
const onboardingNicknameInput = document.getElementById('onboarding-nickname');
const onboardingPhoneInput = document.getElementById('onboarding-phone');
const onboardingUsernameInput = document.getElementById('onboarding-username');
const checkOnboardingUsernameDuplicateBtn = document.getElementById('check-onboarding-username-duplicate');
const onboardingNicknameError = document.getElementById('onboarding-nickname-error');
const onboardingPhoneError = document.getElementById('onboarding-phone-error');
const onboardingUsernameError = document.getElementById('onboarding-username-error');
const onboardingUsernameSuccess = document.getElementById('onboarding-username-success');
const onboardingTermsAgreeRequiredCheckbox = document.getElementById('onboarding-terms-agree-required');
const onboardingMarketingAgreeOptionalCheckbox = document.getElementById('onboarding-marketing-agree-optional');

// Firebase 인증 객체 초기화 (app 객체 전달)
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 토큰 검증 함수 추가
async function verifyUserToken() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('[토큰 검증] 사용자가 로그인되지 않음');
      return { valid: false, error: 'not_authenticated' };
    }
    
    const token = await user.getIdToken(true); // true = force refresh
    console.log('[토큰 검증] 토큰 갱신 성공');
    
    // 토큰 만료 확인
    const tokenResult = await user.getIdTokenResult();
    const expirationTime = new Date(tokenResult.expirationTime);
    const currentTime = new Date();
    
    console.log('[토큰 검증] 토큰 만료 시간:', expirationTime);
    console.log('[토큰 검증] 현재 시간:', currentTime);
    console.log('[토큰 검증] 토큰 유효:', expirationTime > currentTime);
    
    if (expirationTime <= currentTime) {
      console.error('[토큰 검증] 토큰이 만료됨');
      return { valid: false, error: 'token_expired' };
    }
    
    return { valid: true, token, user };
  } catch (error) {
    console.error('[토큰 검증] 토큰 갱신 실패:', error);
    return { valid: false, error: error.code || 'token_refresh_failed' };
  }
}

// 인증 상태 로딩 표시 함수
function showAuthLoading() {
  // 화면 크기 확인
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    // 모바일에서는 모바일 로딩만 표시
    const mobileAuthButtons = document.getElementById('mobile-auth-buttons');
    const mobileUserProfile = document.getElementById('mobile-user-profile');
    
    if (mobileAuthButtons) {
      mobileAuthButtons.classList.remove('auth-ready');
    }
    if (mobileUserProfile) {
      mobileUserProfile.classList.remove('auth-ready');
    }
    
    // 모바일 로딩 요소 생성 및 표시
    let mobileAuthLoadingElement = document.querySelector('.mobile-auth-loading');
    if (!mobileAuthLoadingElement && mobileAuthButtons) {
      mobileAuthLoadingElement = document.createElement('div');
      mobileAuthLoadingElement.className = 'mobile-auth-loading';
      mobileAuthLoadingElement.innerHTML = '<div class="auth-loading-spinner"></div>';
      mobileAuthButtons.parentNode.insertBefore(mobileAuthLoadingElement, mobileAuthButtons);
    }
  } else {
    // 데스크톱에서는 데스크톱 로딩만 표시
    if (authButtons) {
      authButtons.classList.remove('auth-ready');
    }
    if (userProfile) {
      userProfile.classList.remove('auth-ready');
    }
    
    // 로딩 요소 생성 및 표시
    let authLoadingElement = document.querySelector('.auth-loading');
    if (!authLoadingElement && authButtons) {
      authLoadingElement = document.createElement('div');
      authLoadingElement.className = 'auth-loading';
      authLoadingElement.innerHTML = '<div class="auth-loading-spinner"></div>';
      authButtons.parentNode.insertBefore(authLoadingElement, authButtons);
    }
  }
}

// 인증 상태 로딩 숨김 함수
function hideAuthLoading() {
  // 데스크톱 로딩 숨김
  const authLoadingElement = document.querySelector('.auth-loading');
  if (authLoadingElement) {
    authLoadingElement.remove();
  }
  
  // 모바일 로딩 숨김
  const mobileAuthLoadingElement = document.querySelector('.mobile-auth-loading');
  if (mobileAuthLoadingElement) {
    mobileAuthLoadingElement.remove();
  }
}

// DOM이 로드된 후 초기화 및 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', () => {
  // 자동완성 방지 강화
  preventAutocompleteInterference();
  
  // 인증 상태 확인 중임을 표시
  showAuthLoading();
  
  // DOM 요소 존재 여부 확인
  console.log('[DOM 초기화] signupEmailError 요소:', signupEmailError);
  console.log('[DOM 초기화] signupEmailInput 요소:', signupEmailInput);
  console.log('[DOM 초기화] signupForm 요소:', signupForm);
  
  // 모바일 프로필 DOM 요소들
  const mobileUserProfile = document.getElementById('mobile-user-profile');
  const mobileUserAvatar = document.getElementById('mobile-user-avatar');
  const mobileUserName = document.getElementById('mobile-user-name');
  const mobileDropdownMenu = document.getElementById('mobile-dropdown-menu');
  const mobileBtnLogin = document.getElementById('mobile-btn-login');
  const mobileBtnLogout = document.getElementById('mobile-btn-logout');
  
  // 로그인 버튼 클릭 시 모달 열기
  if (btnLogin) {
    btnLogin.addEventListener('click', openAuthModal);
  }

  // 모달 닫기 버튼
  if (authModalClose) {
    authModalClose.addEventListener('click', closeAuthModal);
  }

  // 회원가입 모달 닫기 버튼
  if (signupModalClose) {
    signupModalClose.addEventListener('click', closeSignupModal);
  }

  // Google 로그인 버튼 (유지)
  if (googleAuthBtn) {
    googleAuthBtn.addEventListener('click', handleGoogleLogin);
  }

  // '회원가입 하기' 링크 클릭 시 회원가입 모달 열기
  if (showSignupModalLink) {
    showSignupModalLink.addEventListener('click', (e) => {
      e.preventDefault();
      closeAuthModal();
      openSignupModal();
    });
  }

  // '로그인 하기' 링크 클릭 시 로그인 모달 열기
  if (showLoginModalLink) {
    showLoginModalLink.addEventListener('click', (e) => {
      e.preventDefault();
      closeSignupModal();
      openAuthModal();
    });
  }

  // 자체 로그인 폼 제출 처리
  if (emailLoginForm) {
    emailLoginForm.addEventListener('submit', handleEmailPasswordLogin);
  }

  // 로그인 입력 필드 실시간 유효성 검사
  if (loginEmailIdInput) {
    loginEmailIdInput.addEventListener('blur', () => {
      const value = loginEmailIdInput.value.trim();
      if (value && !isValidEmail(value) && value.length < 4) {
        showError(loginEmailIdError, '유효한 이메일 또는 아이디를 입력해 주세요.');
      } else {
        hideError(loginEmailIdError);
      }
    });
    
    loginEmailIdInput.addEventListener('input', () => {
      if (loginEmailIdError.style.display === 'block') {
        hideError(loginEmailIdError);
      }
    });
  }

  if (loginPasswordInput) {
    loginPasswordInput.addEventListener('blur', () => {
      const value = loginPasswordInput.value.trim();
      if (value && value.length < 6) {
        showError(loginPasswordError, '비밀번호는 6자 이상이어야 합니다.');
      } else {
        hideError(loginPasswordError);
      }
    });
    
    loginPasswordInput.addEventListener('input', () => {
      if (loginPasswordError.style.display === 'block') {
        hideError(loginPasswordError);
      }
    });
  }

  // 자체 회원가입 폼 제출 처리
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
  }

  // 온보딩 폼 제출 처리
  if (onboardingForm) {
    onboardingForm.addEventListener('submit', handleOnboarding);
  }

  // 전화번호 자동 포맷팅 이벤트 리스너
  if (signupPhoneInput) {
    signupPhoneInput.addEventListener('input', (e) => {
      const formatted = formatPhoneNumber(e.target.value);
      if (formatted !== e.target.value) {
        e.target.value = formatted;
      }
    });
  }

  if (onboardingPhoneInput) {
    onboardingPhoneInput.addEventListener('input', (e) => {
      const formatted = formatPhoneNumber(e.target.value);
      if (formatted !== e.target.value) {
        e.target.value = formatted;
      }
    });
  }

  // 아이디 중복 확인 버튼 (회원가입 모달)
  if (checkUsernameDuplicateBtn) {
    checkUsernameDuplicateBtn.addEventListener('click', async () => {
      await checkUsernameAndShowResult(signupUsernameInput, signupUsernameError, signupUsernameSuccess);
    });
  }

  // 아이디 중복 확인 버튼 (온보딩 모달)
  if (checkOnboardingUsernameDuplicateBtn) {
    checkOnboardingUsernameDuplicateBtn.addEventListener('click', async () => {
      await checkUsernameAndShowResult(onboardingUsernameInput, onboardingUsernameError, onboardingUsernameSuccess);
    });
  }

  // 이메일 중복 확인 (onBlur 이벤트)
  if (signupEmailInput) {
    signupEmailInput.addEventListener('blur', async () => {
      const email = signupEmailInput.value.trim();
      if (email && isValidEmail(email)) {
        hideError(signupEmailError);
        const isUnique = await checkEmailDuplicate(email);
        if (!isUnique) {
          showError(signupEmailError, '이미 사용 중인 이메일입니다.');
        }
      }
    });
  }

  // 닉네임 중복 확인 (onBlur 이벤트)
  if (signupNicknameInput) {
    signupNicknameInput.addEventListener('blur', async () => {
      const nickname = signupNicknameInput.value.trim();
      if (nickname && nickname.length >= 2 && nickname.length <= 16) {
        hideError(signupNicknameError);
        const isUnique = await checkNicknameDuplicate(nickname);
        if (!isUnique) {
          showError(signupNicknameError, '이미 사용 중인 닉네임입니다.');
        }
      }
    });
  }

  // 전화번호 중복 확인 (onBlur 이벤트)
  if (signupPhoneInput) {
    signupPhoneInput.addEventListener('blur', async () => {
      const phone = signupPhoneInput.value.trim();
      if (phone && isValidPhoneNumber(phone)) {
        hideError(signupPhoneError);
        const isUnique = await checkPhoneDuplicate(phone);
        if (!isUnique) {
          showError(signupPhoneError, '이미 등록된 전화번호입니다.');
        }
      }
    });
  }

  // 로그인 시 이메일/아이디 존재 여부 확인 (onBlur 이벤트)
  if (loginEmailIdInput) {
    loginEmailIdInput.addEventListener('blur', async () => {
      const emailOrId = loginEmailIdInput.value.trim();
      if (emailOrId) {
        hideError(loginEmailIdError);
        const userExists = await checkUserExists(emailOrId);
        if (!userExists) {
          showError(loginEmailIdError, '존재하지 않는 계정입니다.');
        }
      }
    });
  }

  // 온보딩 모달 - 닉네임 중복 확인 (onBlur 이벤트)
  if (onboardingNicknameInput) {
    onboardingNicknameInput.addEventListener('blur', async () => {
      const nickname = onboardingNicknameInput.value.trim();
      if (nickname && nickname.length >= 2 && nickname.length <= 16) {
        hideError(onboardingNicknameError);
        const isUnique = await checkNicknameDuplicate(nickname);
        if (!isUnique) {
          showError(onboardingNicknameError, '이미 사용 중인 닉네임입니다.');
        }
      }
    });
  }

  // 온보딩 모달 - 전화번호 중복 확인 (onBlur 이벤트)
  if (onboardingPhoneInput) {
    onboardingPhoneInput.addEventListener('blur', async () => {
      const phone = onboardingPhoneInput.value.trim();
      if (phone && isValidPhoneNumber(phone)) {
        hideError(onboardingPhoneError);
        const isUnique = await checkPhoneDuplicate(phone);
        if (!isUnique) {
          showError(onboardingPhoneError, '이미 등록된 전화번호입니다.');
        }
      }
    });
  }

  // 모달 외부 클릭 시 닫기
  window.addEventListener('click', (e) => {
    if (e.target === authModal) {
      closeAuthModal();
    }
    if (e.target === signupModal) {
      closeSignupModal();
    }
    // 온보딩 모달은 배경 클릭으로 닫히지 않도록 제거
    // 추가정보 입력이 완료되어야만 닫힐 수 있음
    // if (e.target === onboardingModal) {
    //   closeOnboardingModal();
    // }
  });

  // 드롭다운 메뉴 토글
  if (userProfile) {
    userProfile.addEventListener('click', () => {
      dropdownMenu.classList.toggle('show');
      userProfile.setAttribute('aria-expanded', dropdownMenu.classList.contains('show'));
    });
  }

  // 모바일 프로필 드롭다운 토글
  if (mobileUserProfile) {
    mobileUserProfile.addEventListener('click', (e) => {
      e.stopPropagation(); // 이벤트 버블링 방지
      mobileDropdownMenu.classList.toggle('show');
      mobileUserProfile.classList.toggle('active');
    });
  }

  // 모바일 로그인 버튼
  if (mobileBtnLogin) {
    mobileBtnLogin.addEventListener('click', (e) => {
      e.preventDefault();
      mobileDropdownMenu.classList.remove('show');
      mobileUserProfile.classList.remove('active');
      openAuthModal();
    });
  }

  // 모바일 로그아웃 버튼
  if (mobileBtnLogout) {
    mobileBtnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      mobileDropdownMenu.classList.remove('show');
      mobileUserProfile.classList.remove('active');
      handleLogout();
    });
  }

  // 로그아웃 버튼
  if (btnLogout) {
    btnLogout.addEventListener('click', handleLogout);
  }

  // 드롭다운 외부 클릭 시 닫기
  document.addEventListener('click', (e) => {
    if (userProfile && dropdownMenu && !userProfile.contains(e.target)) {
      dropdownMenu.classList.remove('show');
      userProfile.setAttribute('aria-expanded', 'false');
    }
    if (mobileUserProfile && mobileDropdownMenu && !mobileUserProfile.contains(e.target)) {
      mobileDropdownMenu.classList.remove('show');
      mobileUserProfile.classList.remove('active');
    }
  });

  // 초기 로드 시 언어별 입력 규칙 반영
  try { updatePhoneFieldPattern(); } catch (_) {}
});

// 사용자 상태 변경 감지
onAuthStateChanged(auth, async (user) => {
  // 모바일 프로필 DOM 요소들 다시 가져오기 (이벤트 리스너 내부에서는 접근 불가)
  const mobileUserProfile = document.getElementById('mobile-user-profile');
  const mobileUserAvatar = document.getElementById('mobile-user-avatar');
  const mobileUserName = document.getElementById('mobile-user-name');
  const mobileDropdownMenu = document.getElementById('mobile-dropdown-menu');
  const mobileBtnLogin = document.getElementById('mobile-btn-login');
  const mobileBtnLogout = document.getElementById('mobile-btn-logout');
  const mobileAuthButtons = document.getElementById('mobile-auth-buttons');
  
  if (user) {
    // Firebase 로그인 상태
    console.log('로그인된 사용자:', user);
    
    // 로딩 상태 숨기기
    hideAuthLoading();
    
    // 데스크톱 UI 업데이트
    if (authButtons) {
      authButtons.style.display = 'none';
    }
    if (userProfile) {
      userProfile.style.display = 'flex';
      userProfile.classList.add('auth-ready');
    }
    
    // Firestore에서 사용자 정보 가져오기
    let displayedName = '사용자';
    let shouldShowProfileImage = false;
    let profileImageUrl = '../images/default-avatar.svg';
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        
        // 닉네임 설정
        if (userData.nickname) {
          displayedName = userData.nickname;
          console.log('[onAuthStateChanged] Firestore 닉네임 로드 성공:', displayedName);
        } else {
          console.log('[onAuthStateChanged] Firestore에 닉네임 없음. Firebase displayName 사용 시도.');
          displayedName = user.displayName || '사용자';
        }
        
        // 프로필 이미지 설정 - Firebase Auth photoURL 우선 사용
        const isGoogleLogin = user.providerData && user.providerData.some(provider => provider.providerId === 'google.com');
        
        if ((isGoogleLogin && user.photoURL) || (userData.provider === 'google' && userData.photoURL)) {
          shouldShowProfileImage = true;
          // Firebase Auth의 photoURL을 우선 사용, 없으면 Firestore의 photoURL 사용
          profileImageUrl = user.photoURL || userData.photoURL;
          console.log('[onAuthStateChanged] 구글 로그인 사용자 - 프로필 이미지 표시:', profileImageUrl);
        } else {
          // 이메일/비밀번호 로그인 사용자 - 기본 프로필 이미지 사용
          shouldShowProfileImage = true;
          const isInSubDir = window.location.pathname.includes('/pages/');
          profileImageUrl = isInSubDir ? '../images/default-avatar.svg' : 'images/default-avatar.svg';
          console.log('[onAuthStateChanged] 이메일/비밀번호 로그인 사용자 - 기본 프로필 이미지 사용:', profileImageUrl);
        }
      } else {
        console.log('[onAuthStateChanged] Firestore에 사용자 문서 없음. Firebase displayName 사용.');
        
        // 자동 생성하지 않음 - 회원가입/온보딩에서만 생성
        
        displayedName = user.displayName || '사용자';
        
        // Firebase Auth의 providerData로 구글 로그인 확인
        const isGoogleLogin = user.providerData && user.providerData.some(provider => provider.providerId === 'google.com');
        if (isGoogleLogin && user.photoURL) {
          shouldShowProfileImage = true;
          profileImageUrl = user.photoURL;
          console.log('[onAuthStateChanged] 구글 로그인 사용자 (Firestore 문서 없음) - Firebase Auth 프로필 이미지 사용:', user.photoURL);
        } else {
          // 이메일/비밀번호 로그인 사용자 - 기본 프로필 이미지 사용
          shouldShowProfileImage = true;
          const isInSubDir = window.location.pathname.includes('/pages/');
          profileImageUrl = isInSubDir ? '../images/default-avatar.svg' : 'images/default-avatar.svg';
          console.log('[onAuthStateChanged] 이메일/비밀번호 로그인 사용자 (Firestore 문서 없음) - 기본 프로필 이미지 사용');
        }
      }
    } catch (error) {
      console.error('[onAuthStateChanged] Firestore 사용자 정보 로드 실패:', error);
      
      // 권한 오류인 경우 사용자 문서 자동 생성 시도
      if (error.code === 'permission-denied') {
        try {
          console.log('[onAuthStateChanged] 권한 오류 - 사용자 문서 자동 생성 시도');
          await saveUserToFirestore(user, {
            provider: user.providerData && user.providerData.some(provider => provider.providerId === 'google.com') ? 'google' : 'emailpassword'
          });
        } catch (saveError) {
          console.error('[onAuthStateChanged] 사용자 문서 자동 생성 실패:', saveError);
        }
      }
      
      displayedName = user.displayName || '사용자';
      
      // 에러 발생 시에도 프로필 이미지 설정 - Firebase Auth photoURL 우선 확인
      shouldShowProfileImage = true;
      const isGoogleLogin = user.providerData && user.providerData.some(provider => provider.providerId === 'google.com');
      
      if (isGoogleLogin && user.photoURL) {
        profileImageUrl = user.photoURL;
        console.log('[onAuthStateChanged] 에러 발생 - Firebase Auth 프로필 이미지 사용:', user.photoURL);
      } else {
        const isInSubDir = window.location.pathname.includes('/pages/');
        profileImageUrl = isInSubDir ? '../images/default-avatar.svg' : 'images/default-avatar.svg';
        console.log('[onAuthStateChanged] 에러 발생 - 기본 프로필 이미지 사용:', profileImageUrl);
      }
    }
    
    // 데스크톱 프로필 업데이트
    if (userAvatar) {
      userAvatar.src = profileImageUrl || (window.location.pathname.includes('/pages/') ? '../images/default-avatar.svg' : 'images/default-avatar.svg');
      
      // 이미지 로드 실패 시 기본 이미지로 fallback
      userAvatar.onerror = function() {
        const isInSubDir = window.location.pathname.includes('/pages/');
        this.src = isInSubDir ? '../images/default-avatar.svg' : 'images/default-avatar.svg';
        console.log('[userAvatar] 프로필 이미지 로드 실패 - 기본 이미지로 대체');
        this.onerror = null; // 무한 루프 방지
      };
    }
    if (userName) {
      userName.textContent = displayedName;
    }
    
    // 모바일 프로필 업데이트
    if (mobileUserAvatar) {
      mobileUserAvatar.src = profileImageUrl || (window.location.pathname.includes('/pages/') ? '../images/default-avatar.svg' : 'images/default-avatar.svg');
      
      // 이미지 로드 실패 시 기본 이미지로 fallback
      mobileUserAvatar.onerror = function() {
        const isInSubDir = window.location.pathname.includes('/pages/');
        this.src = isInSubDir ? '../images/default-avatar.svg' : 'images/default-avatar.svg';
        console.log('[mobileUserAvatar] 프로필 이미지 로드 실패 - 기본 이미지로 대체');
        this.onerror = null; // 무한 루프 방지
      };
    }
    if (mobileUserName) {
      mobileUserName.textContent = displayedName;
    }
    
    // 모바일 UI 상태 변경 - 로그인 상태
    if (mobileUserProfile) {
      mobileUserProfile.classList.remove('guest-mode');
      mobileUserProfile.classList.add('authenticated', 'auth-ready');
    }
    if (mobileAuthButtons) {
      mobileAuthButtons.classList.remove('guest-mode');
      mobileAuthButtons.classList.add('authenticated');
    }
    
    // 모바일 드롭다운 메뉴 로그인/로그아웃 버튼 상태 변경
    if (mobileBtnLogin) {
      mobileBtnLogin.style.display = 'none';
    }
    if (mobileBtnLogout) {
      mobileBtnLogout.style.display = 'flex';
    }
    
    // 로그인 시 네비게이션 접근 권한 업데이트
    updateNavigationAccessOnLogin(user);
    closeAuthModal(); // 로그인 성공 시 모달 닫기
    // 회원가입 플로우에서 로그인된 경우 자동 이동 처리
    try {
      if (sessionStorage.getItem('redirectToChannelAfterLogin') === '1') {
        sessionStorage.removeItem('redirectToChannelAfterLogin');
        window.location.href = '/index.html';
      }
    } catch (_) {}

    // 배너 노출: 채널 미등록 배너 또는 계좌 미등록 배너
    try { maybeShowChannelBanner(user.uid); } catch (_) {}
    try { maybeShowPayoutBanner(user.uid); } catch (_) {}
  } else {
    // Firebase 로그아웃 상태 - UI 초기화
    
    // 로딩 상태 숨기기
    hideAuthLoading();
    
    // 데스크톱 UI 업데이트
    if (authButtons) {
      authButtons.style.display = 'flex';
      authButtons.classList.add('auth-ready');
    }
    if (userProfile) {
      userProfile.style.display = 'none';
      userProfile.classList.remove('auth-ready');
      const dropdownMenu = document.getElementById('dropdown-menu');
      if (dropdownMenu) {
        dropdownMenu.classList.remove('show');
      }
    }
    
    // 모바일 프로필 로그아웃 상태로 복원
    if (mobileUserAvatar) {
      // 페이지 경로에 따라 기본 아바타 경로 설정
      const isInSubDir = window.location.pathname.includes('/pages/');
      mobileUserAvatar.src = isInSubDir ? '../images/default-avatar.svg' : 'images/default-avatar.svg';
    }
    if (mobileUserName) {
      mobileUserName.textContent = '게스트';
    }
    
    // 모바일 UI 상태 변경 - 로그아웃 상태
    if (mobileUserProfile) {
      mobileUserProfile.classList.remove('authenticated', 'auth-ready');
      mobileUserProfile.classList.add('guest-mode');
    }
    if (mobileAuthButtons) {
      mobileAuthButtons.classList.remove('authenticated');
      mobileAuthButtons.classList.add('guest-mode', 'auth-ready');
    }
    
    // 모바일 드롭다운 메뉴 로그인/로그아웃 버튼 상태 변경
    if (mobileBtnLogin) {
      mobileBtnLogin.style.display = 'flex';
    }
    if (mobileBtnLogout) {
      mobileBtnLogout.style.display = 'none';
    }
    
    // 모바일 드롭다운 닫기
    if (mobileDropdownMenu) {
      mobileDropdownMenu.classList.remove('show');
    }
    if (mobileUserProfile) {
      mobileUserProfile.classList.remove('active');
    }
    
    // 로그아웃 시 네비게이션 접근 권한 재설정
    updateNavigationAccess(null);

    // 로그아웃 시 배너 제거
    const existing = document.querySelector('.post-signup-banner');
    if (existing) existing.remove();
  }
});

// 신규 회원 Firestore 저장 함수
async function saveUserToFirestore(user, userData = {}) {
  console.log('[saveUserToFirestore] 함수 시작');
  console.log('[saveUserToFirestore] user:', user);
  console.log('[saveUserToFirestore] userData:', userData);
  
  if (!user || !user.uid) {
    console.error('[saveUserToFirestore] user 또는 user.uid가 없습니다:', user);
    return;
  }
  
  try {
    console.log('[saveUserToFirestore] Firestore 연결 확인 - db:', db);
    console.log('[saveUserToFirestore] 사용자 문서 참조 생성 중... uid:', user.uid);
    
    const userRef = doc(db, 'users', user.uid);
    console.log('[saveUserToFirestore] userRef 생성 완료:', userRef);
    
    console.log('[saveUserToFirestore] 기존 문서 존재 여부 확인 중...');
    const userSnap = await getDoc(userRef);
    console.log('[saveUserToFirestore] getDoc 완료. exists:', userSnap.exists());
    
    if (!userSnap.exists()) {
      console.log('[saveUserToFirestore] 신규 사용자 - 문서 생성 시작');
      
      // 로그인 방식 확인 (구글 로그인인지 확인)
      const isGoogleLogin = user.providerData && user.providerData.some(provider => provider.providerId === 'google.com');
      console.log('[saveUserToFirestore] 구글 로그인 여부:', isGoogleLogin);
      
      // 신규 회원만 저장
      const userDataToSave = {
        uid: user.uid,
        displayName: user.displayName || userData.nickname || '',
        email: user.email || userData.email || '',
        provider: isGoogleLogin ? 'google' : (userData.provider || 'emailpassword'),
        nickname: userData.nickname || '',
        phone: userData.phone || '',
        username: userData.username || '',
        createdAt: serverTimestamp()
      };
      
      console.log('[saveUserToFirestore] 입력받은 userData:', userData);
      console.log('[saveUserToFirestore] userData.nickname:', userData.nickname);
      console.log('[saveUserToFirestore] userData.phone:', userData.phone);
      console.log('[saveUserToFirestore] userData.email:', userData.email);
      console.log('[saveUserToFirestore] userData.username:', userData.username);
      console.log('[saveUserToFirestore] Firebase user 정보:', {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      });

      // photoURL 저장 - 구글 로그인이거나 기존에 photoURL이 있는 경우
      if ((isGoogleLogin && user.photoURL) || userData.photoURL) {
        userDataToSave.photoURL = user.photoURL || userData.photoURL;
        console.log('[saveUserToFirestore] photoURL 저장:', userDataToSave.photoURL);
      } else {
        console.log('[saveUserToFirestore] photoURL 없음 - 저장하지 않음');
      }

      console.log('[saveUserToFirestore] 저장할 데이터:', userDataToSave);
      console.log('[saveUserToFirestore] 저장할 데이터 상세:');
      console.log('  - uid:', userDataToSave.uid);
      console.log('  - displayName:', userDataToSave.displayName);
      console.log('  - email:', userDataToSave.email);
      console.log('  - provider:', userDataToSave.provider);
      console.log('  - nickname:', userDataToSave.nickname);
      console.log('  - phone:', userDataToSave.phone);
      console.log('  - username:', userDataToSave.username);
      console.log('[saveUserToFirestore] 현재 인증 상태 확인...');
      console.log('[saveUserToFirestore] user.uid:', user.uid);
      console.log('[saveUserToFirestore] user.email:', user.email);
      console.log('[saveUserToFirestore] user.emailVerified:', user.emailVerified);
      console.log('[saveUserToFirestore] setDoc 실행 중...');
      
      await setDoc(userRef, userDataToSave);
      console.log('[saveUserToFirestore] ✅ Firestore 저장 성공!');
      console.log('[saveUserToFirestore] 저장된 UID:', user.uid);
      console.log('[saveUserToFirestore] 저장된 프로바이더:', userDataToSave.provider);
    } else {
      console.log('[saveUserToFirestore] 기존 사용자 - 문서가 이미 존재함');
      console.log('[saveUserToFirestore] 기존 문서 유지 - 업데이트하지 않음');
      return;
    }
  } catch (error) {
    console.error('[saveUserToFirestore] ❌ Firestore 회원 저장 실패:');
    console.error('[saveUserToFirestore] 에러 코드:', error.code);
    console.error('[saveUserToFirestore] 에러 메시지:', error.message);
    console.error('[saveUserToFirestore] 전체 에러 객체:', error);
    
    // 권한 관련 에러인지 확인
    if (error.code === 'permission-denied') {
      console.error('[saveUserToFirestore] 🚫 권한 거부 오류 - Firestore 규칙을 확인하세요');
    }
    
    // 에러를 다시 throw하여 상위에서 처리할 수 있도록 함
    throw error;
  }
}

// 구글 로그인 처리
async function handleGoogleLogin() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log('구글 로그인 성공:', user);
    
    // Firestore에서 사용자 문서 확인
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      // 신규 사용자 → 온보딩 모달 열기
      console.log('신규 구글 사용자 - 온보딩 모달 열기');
      closeAuthModal(); // 로그인 모달 닫기
      openOnboardingModal();
      
      // 온보딩 모달의 이메일 필드에 구글 이메일 미리 채우기 (이메일은 온보딩에서 수정 불가능하므로 숨김처리 가능)
      // 이 경우 구글 이메일을 자동으로 사용
      showNotification('추가 정보를 입력해 주세요.');
    } else {
      // 기존 사용자 → 메인으로 이동 (현재는 로그인 처리만)
      console.log('기존 구글 사용자 - 로그인 완료');
      showNotification('로그인되었습니다.');
      closeAuthModal();
      
      // 여기에 메인 페이지로 이동하는 로직 추가 가능
      // window.location.href = '/main';
    }
  } catch (error) {
    console.error('구글 로그인 실패:', error);
    showNotification('로그인 중 오류가 발생했습니다.', true);
  }
}

// 로그아웃 처리
async function handleLogout() {
  // 온보딩 모달이 열려있는 경우 로그아웃 방지
  if (onboardingModal && onboardingModal.style.display === 'flex') {
    showNotification('회원가입을 완료하기 위해 추가 정보를 입력해 주세요.', true);
    console.log('[handleLogout] 온보딩 완료 전까지는 로그아웃할 수 없습니다.');
    return;
  }
  
  try {
    await signOut(auth);
    
    // UI 초기화
    if (authButtons) {
      authButtons.style.display = 'flex';
    }
    if (userProfile) {
      userProfile.style.display = 'none';
      const dropdownMenu = document.getElementById('dropdown-menu');
      if (dropdownMenu) {
        dropdownMenu.classList.remove('show');
      }
    }
    
    // 모바일 프로필 로그아웃 상태로 복원
    const mobileUserProfile = document.getElementById('mobile-user-profile');
    const mobileUserAvatar = document.getElementById('mobile-user-avatar');
    const mobileUserName = document.getElementById('mobile-user-name');
    const mobileDropdownMenu = document.getElementById('mobile-dropdown-menu');
    
    if (mobileUserAvatar) {
      // 페이지 경로에 따라 기본 아바타 경로 설정
      const isInSubDir = window.location.pathname.includes('/pages/');
      mobileUserAvatar.src = isInSubDir ? '../images/default-avatar.svg' : 'images/default-avatar.svg';
    }
    if (mobileUserName) {
      mobileUserName.textContent = '게스트';
    }
    if (mobileDropdownMenu) {
      mobileDropdownMenu.classList.remove('show');
    }
    if (mobileUserProfile) {
      mobileUserProfile.classList.remove('active');
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

// 자체 로그인 모달 열기
function openAuthModal() {
  console.log('[openAuthModal] 로그인 모달 열기 시작');
  if (authModal) {
    console.log('[openAuthModal] authModal 요소 발견:', authModal);
    authModal.style.display = 'flex';
    authModal.style.zIndex = '99999';
    console.log('[openAuthModal] display 및 z-index 설정 완료');
    
    setTimeout(() => {
      authModal.classList.add('show');
      console.log('[openAuthModal] show 클래스 추가 완료');
    }, 10);
    document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
    // 언어별 입력 규칙 즉시 반영
    try { updatePhoneFieldPattern(); } catch (_) {}
    console.log('[openAuthModal] 모달 열기 완료');
  } else {
    console.error('[openAuthModal] authModal 요소를 찾을 수 없습니다');
  }
}

// 자체 로그인 모달 닫기
function closeAuthModal() {
  if (authModal) {
    authModal.classList.remove('show');
    setTimeout(() => {
      authModal.style.display = 'none';
      document.body.style.overflow = ''; // 배경 스크롤 복원
      clearLoginErrors(); // 로그인 에러 메시지 초기화
      emailLoginForm.reset(); // 폼 초기화
    }, 300); // CSS transition 시간과 일치
  }
}

// 자체 회원가입 모달 열기
function openSignupModal() {
  console.log('[openSignupModal] 회원가입 모달 열기 시작');
  if (signupModal) {
    console.log('[openSignupModal] signupModal 요소 발견:', signupModal);
    signupModal.style.display = 'flex';
    signupModal.style.zIndex = '99999';
    console.log('[openSignupModal] display 및 z-index 설정 완료');
    
    setTimeout(() => {
      signupModal.classList.add('show');
      console.log('[openSignupModal] show 클래스 추가 완료');
    }, 10);
    document.body.style.overflow = 'hidden';
    // 언어별 입력 규칙 즉시 반영
    try { updatePhoneFieldPattern(); } catch (_) {}
    console.log('[openSignupModal] 회원가입 모달 열기 완료');
  } else {
    console.error('[openSignupModal] signupModal 요소를 찾을 수 없습니다');
  }
}

// 자체 회원가입 모달 닫기
function closeSignupModal() {
  if (signupModal) {
    signupModal.classList.remove('show');
  setTimeout(() => {
      signupModal.style.display = 'none';
    document.body.style.overflow = '';
      clearSignupErrors(); // 회원가입 에러 메시지 초기화
      signupForm.reset(); // 폼 초기화
      termsAgreeRequiredCheckbox.checked = false; // 필수 약관 동의 초기화
      marketingAgreeOptionalCheckbox.checked = false; // 선택 약관 동의 초기화
  }, 300);
  }
}

// 로그인 에러 메시지 초기화
function clearLoginErrors() {
  hideError(loginEmailIdError);
  hideError(loginPasswordError);
}

// 회원가입 에러 메시지 초기화
function clearSignupErrors() {
  hideError(signupNicknameError);
  hideError(signupPhoneError);
  hideError(signupEmailError);
  hideError(signupUsernameError);
  hideError(signupPasswordError);
  hideError(signupPasswordConfirmError);
  hideSuccess(signupUsernameSuccess); // 성공 메시지도 초기화
}

// 온보딩 에러 메시지 초기화
function clearOnboardingErrors() {
  hideError(onboardingNicknameError);
  hideError(onboardingPhoneError);
  hideError(onboardingUsernameError);
  hideSuccess(onboardingUsernameSuccess); // 성공 메시지도 초기화
}

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

// 유효성 검사 헬퍼 함수
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function isValidPhoneNumber(phone) {
  const lang = getCurrentLang();
  if (lang === 'ja') {
    // 일본 휴대전화: 070/080/090-XXXX-XXXX 또는 하이픈 없는 11자리
    const reHyphen = /^0(70|80|90)-[0-9]{4}-[0-9]{4}$/;
    const rePlain = /^0(70|80|90)[0-9]{8}$/;
    return reHyphen.test(phone) || rePlain.test(phone);
  }
  // 기본(KO): 010-XXXX-XXXX 또는 010XXXXXXXX
  const re1 = /^010-[0-9]{4}-[0-9]{4}$/;
  const re2 = /^010[0-9]{8}$/;
  return re1.test(phone) || re2.test(phone);
}

// 전화번호 자동 포맷팅 함수
function formatPhoneNumber(phone) {
  const lang = getCurrentLang();
  const numbers = (phone || '').replace(/\D/g, '');

  if (lang === 'ja') {
    // 일본 휴대전화: 070/080/090 + 8 digits => 3-4-4로 포맷
    if (numbers.length === 11 && /^(070|080|090)/.test(numbers)) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    }
    return phone;
  }

  // 한국: 010 + 8 digits => 3-4-4
  if (numbers.length === 11 && numbers.startsWith('010')) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  }
  return phone;
}

function isValidPassword(password) {
  // 최소 8자, 영문, 숫자, 특수문자 포함
  const re = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
  return re.test(password);
}

// 이메일 중복 확인 (Firestore)
async function checkEmailDuplicate(email) {
  console.log('[checkEmailDuplicate] 중복 확인 대상 이메일:', email);

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      console.log('[checkEmailDuplicate] Firestore에서 이메일 중복 발견:', email);
      return false;
    } else {
      console.log('[checkEmailDuplicate] Firestore에서 이메일 사용 가능:', email);
      return true;
    }
  } catch (error) {
    console.error('[checkEmailDuplicate] 이메일 중복 확인 실패:', error);
    return false;
  }
}

// 이메일/비밀번호 로그인 처리
async function handleEmailPasswordLogin(e) {
  e.preventDefault();
  clearLoginErrors();

  const emailOrId = loginEmailIdInput.value.trim();
  const password = loginPasswordInput.value.trim();

  let isValid = true;

  if (!emailOrId) {
    showError(loginEmailIdError, '아이디 또는 이메일을 입력해 주세요.');
    showNotification('아이디 또는 이메일을 입력해 주세요.', true);
    isValid = false;
  }
  if (!password) {
    showError(loginPasswordError, '비밀번호를 입력해 주세요.');
    showNotification('비밀번호를 입력해 주세요.', true);
    isValid = false;
  }

  // 기본 유효성 검사 추가
  if (emailOrId && !isValidEmail(emailOrId) && emailOrId.length < 4) {
    showError(loginEmailIdError, '유효한 이메일 또는 아이디를 입력해 주세요.');
    showNotification('유효한 이메일 또는 아이디를 입력해 주세요.', true);
    isValid = false;
  }
  if (password && password.length < 6) {
    showError(loginPasswordError, '비밀번호는 6자 이상이어야 합니다.');
    showNotification('비밀번호는 6자 이상이어야 합니다.', true);
    isValid = false;
  }

  if (!isValid) return;

  let emailToSignIn = emailOrId;

  try {
    // 이메일 형식인지 먼저 확인
    if (!isValidEmail(emailOrId)) {
      // 이메일 형식이 아니라면 아이디로 간주하고 Firestore에서 이메일 찾기
      console.log('[handleEmailPasswordLogin] 이메일 형식이 아님. 아이디로 이메일 검색 시작:', emailOrId);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', emailOrId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log('[handleEmailPasswordLogin] 아이디에 해당하는 사용자 없음:', emailOrId);
        throw new Error('존재하지 않는 아이디입니다.');
      }

      const userData = querySnapshot.docs[0].data();
      emailToSignIn = userData.email;
      if (!emailToSignIn) {
        console.warn('[handleEmailPasswordLogin] Firestore 사용자 문서에 이메일 정보 없음:', userData);
        throw new Error('아이디에 연결된 이메일 정보를 찾을 수 없습니다.');
      }
      console.log('[handleEmailPasswordLogin] 아이디로 이메일 찾기 성공:', emailOrId, '->', emailToSignIn);
    }

    // 찾은 이메일 또는 원래 입력된 이메일로 로그인 시도
    await signInWithEmailAndPassword(auth, emailToSignIn, password);
    showNotification('로그인되었습니다.');
    closeAuthModal();
  } catch (error) {
    console.error('로그인 실패:', error);
    let errorMessage = '로그인 중 오류가 발생했습니다.';
    switch (error.code) {
      case 'auth/invalid-email':
      case 'auth/user-not-found':
        errorMessage = '존재하지 않는 이메일 또는 잘못된 형식입니다.';
        showError(loginEmailIdError, errorMessage);
        break;
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        errorMessage = '비밀번호가 올바르지 않습니다.';
        showError(loginPasswordError, errorMessage);
        break;
      case 'auth/too-many-requests':
        errorMessage = '로그인 시도 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
        break;
      default:
        // 아이디로 이메일 찾기 실패 시 발생하는 에러도 포함
        if (error.message.includes('존재하지 않는 아이디입니다.')) {
          errorMessage = '존재하지 않는 아이디입니다.';
          showError(loginEmailIdError, errorMessage);
        } else if (error.message.includes('아이디에 연결된 이메일 정보를 찾을 수 없습니다.')) {
          errorMessage = '아이디에 연결된 이메일 정보를 찾을 수 없습니다.';
          showError(loginEmailIdError, errorMessage);
        } else {
          errorMessage = error.message;
        }
        break;
    }
    showNotification(errorMessage, true);
  }
}

// 회원가입 처리
async function handleSignup(e) {
  e.preventDefault();
  clearSignupErrors();

  const nickname = signupNicknameInput.value.trim();
  const phone = signupPhoneInput.value.trim();
  const email = signupEmailInput.value.trim();
  const username = signupUsernameInput.value.trim();
  const password = signupPasswordInput.value.trim();
  const passwordConfirm = signupPasswordConfirmInput.value.trim();
  const termsAgreed = termsAgreeRequiredCheckbox.checked;
  const marketingAgreed = marketingAgreeOptionalCheckbox.checked;

  let isValid = true;

  console.log('[handleSignup] 회원가입 시작');
  console.log({ nickname, phone, email, username, password, passwordConfirm, termsAgreed, marketingAgreed });

  if (nickname.length < 2 || nickname.length > 16) {
    showError(signupNicknameError, '이름(닉네임)은 2~16자여야 합니다.');
    showNotification('이름(닉네임)이 유효하지 않습니다.', true);
    isValid = false;
    console.log('[handleSignup] nickname 유효성 검사 실패');
  }
  if (!isValidPhoneNumber(phone)) {
    showError(signupPhoneError, getPhoneInvalidMessage());
    showNotification(getPhoneInvalidMessage(), true);
    isValid = false;
    console.log('[handleSignup] phone 유효성 검사 실패');
  }
  if (!isValidEmail(email)) {
    showError(signupEmailError, '유효한 이메일 주소를 입력해 주세요.');
    showNotification('이메일 주소가 유효하지 않습니다.', true);
    isValid = false;
    console.log('[handleSignup] email 유효성 검사 실패');
  }
  // 아이디 유효성 검사
  if (username.length < 4 || username.length > 20 || !/^[a-zA-Z0-9]+$/.test(username)) {
    showError(signupUsernameError, '아이디는 4~20자의 영문과 숫자만 가능합니다.');
    showNotification('아이디 형식이 올바르지 않습니다.', true);
    isValid = false;
    console.log('[handleSignup] username 유효성 검사 실패');
  }
  if (!isValidPassword(password)) {
    showError(signupPasswordError, '비밀번호는 8자 이상이며, 영문, 숫자, 특수문자를 포함해야 합니다.');
    showNotification('비밀번호 형식이 올바르지 않습니다.', true);
    isValid = false;
    console.log('[handleSignup] password 유효성 검사 실패');
  }
  if (password !== passwordConfirm) {
    showError(signupPasswordConfirmError, '비밀번호가 일치하지 않습니다.');
    showNotification('비밀번호가 일치하지 않습니다.', true);
    isValid = false;
    console.log('[handleSignup] passwordConfirm 유효성 검사 실패');
  }
  if (!termsAgreed) {
    showNotification('필수 약관에 동의해야 합니다.', true);
    isValid = false;
    console.log('[handleSignup] termsAgreed 유효성 검사 실패');
  }

  console.log('[handleSignup] 1차 유효성 검사 결과:', isValid);
  if (!isValid) {
    console.log('[handleSignup] 1차 유효성 검사 실패, 제출 중단');
    showNotification('입력 정보를 다시 확인해 주세요.', true);
    return;
  }

  // 모든 필드 중복 확인
  console.log('[handleSignup] 중복 확인 시작');
  const isEmailUnique = await checkEmailDuplicate(email);
  console.log('[handleSignup] 이메일 중복 확인 결과:', isEmailUnique);
  
  const isNicknameUnique = await checkNicknameDuplicate(nickname);
  console.log('[handleSignup] 닉네임 중복 확인 결과:', isNicknameUnique);
  
  const isPhoneUnique = await checkPhoneDuplicate(phone);
  console.log('[handleSignup] 전화번호 중복 확인 결과:', isPhoneUnique);
  
  const isUsernameUnique = await checkUsernameDuplicate(username);
  console.log('[handleSignup] 아이디 중복 확인 결과:', isUsernameUnique);

  if (!isEmailUnique) {
    showError(signupEmailError, '이미 사용 중인 이메일입니다.');
    showNotification('이미 사용 중인 이메일입니다.', true);
    isValid = false;
    console.log('[handleSignup] 이메일 중복 확인 실패');
  }
  if (!isNicknameUnique) {
    showError(signupNicknameError, '이미 사용 중인 닉네임입니다.');
    showNotification('이미 사용 중인 닉네임입니다.', true);
    isValid = false;
    console.log('[handleSignup] 닉네임 중복 확인 실패');
  }
  if (!isPhoneUnique) {
    showError(signupPhoneError, getPhoneDuplicateMessage());
    showNotification(getPhoneDuplicateMessage(), true);
    isValid = false;
    console.log('[handleSignup] 전화번호 중복 확인 실패');
  }
  if (!isUsernameUnique) {
    showError(signupUsernameError, '이미 사용 중인 아이디입니다.');
    showNotification('이미 사용 중인 아이디입니다.', true);
    isValid = false;
    console.log('[handleSignup] 아이디 중복 확인 실패');
  }

  console.log('[handleSignup] 최종 유효성 검사 결과:', isValid);
  if (!isValid) {
    console.log('[handleSignup] 최종 유효성 검사 실패, 제출 중단');
    showNotification('입력 정보를 다시 확인해 주세요.', true);
    return;
  }

  try {
    console.log('[handleSignup] Firebase 사용자 생성 시도...');
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('[handleSignup] 사용자 생성 성공:', user.uid);

    console.log('[handleSignup] Firestore 사용자 데이터 저장 시도...');
    console.log('[handleSignup] 전달할 사용자 데이터:', {
      nickname: nickname,
      phone: phone,
      email: email,
      username: username,
      marketingAgreed: marketingAgreed,
      provider: 'emailpassword'
    });
    console.log('[handleSignup] 개별 필드 값 확인:');
    console.log('  - nickname:', nickname, '(타입:', typeof nickname, ')');
    console.log('  - phone:', phone, '(타입:', typeof phone, ')');
    console.log('  - email:', email, '(타입:', typeof email, ')');
    console.log('  - username:', username, '(타입:', typeof username, ')');
    try {
      await saveUserToFirestore(user, {
        nickname: nickname,
        phone: phone,
        email: email,
        username: username,
        marketingAgreed: marketingAgreed,
        provider: 'emailpassword'
      });
      console.log('[handleSignup] ✅ Firestore 사용자 데이터 저장 성공');
    } catch (firestoreError) {
      console.error('[handleSignup] ❌ Firestore 저장 실패:', firestoreError);
      // Firestore 저장 실패해도 회원가입은 성공했으므로 사용자에게 알림
      showNotification('회원가입은 완료되었지만 일부 정보 저장에 실패했습니다. 다시 로그인해 주세요.', true);
      throw firestoreError; // 에러를 다시 throw하여 catch 블록에서 처리
    }

    showNotification('회원가입이 완료되었습니다!');
    try { sessionStorage.setItem('postSignupPrompt', 'channel'); } catch (_) {}
    closeSignupModal();
    openAuthModal(); // 회원가입 완료 후 로그인 모달 자동 오픈
  } catch (error) {
    console.error('[handleSignup] 회원가입 실패:', error);
    console.error('[handleSignup] 에러 코드:', error.code);
    console.error('[handleSignup] 에러 메시지:', error.message);
    
    let errorMessage = '회원가입 중 오류가 발생했습니다.';
    
    // 에러 요소 초기화
    clearSignupErrors();
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = '이미 사용 중인 이메일 주소입니다.';
        console.log('[handleSignup] 이메일 중복 에러 처리:', errorMessage);
        showError(signupEmailError, errorMessage);
        // 이메일 필드에 포커스
        if (signupEmailInput) {
          signupEmailInput.focus();
        }
        break;
      case 'auth/weak-password':
        errorMessage = '비밀번호가 너무 취약합니다. 더 강력한 비밀번호를 사용해 주세요.';
        console.log('[handleSignup] 약한 비밀번호 에러 처리:', errorMessage);
        showError(signupPasswordError, errorMessage);
        if (signupPasswordInput) {
          signupPasswordInput.focus();
        }
        break;
      case 'auth/invalid-email':
        errorMessage = '유효하지 않은 이메일 주소입니다.';
        console.log('[handleSignup] 잘못된 이메일 에러 처리:', errorMessage);
        showError(signupEmailError, errorMessage);
        if (signupEmailInput) {
          signupEmailInput.focus();
        }
        break;
      default:
        console.log('[handleSignup] 기타 에러 처리:', error.code, error.message);
        errorMessage = error.message || '회원가입 중 오류가 발생했습니다.';
        break;
    }
    
    // 알림 메시지 표시
    showNotification(errorMessage, true);
    console.log('[handleSignup] 에러 처리 완료 - 알림 표시:', errorMessage);
  }
}

// 아이디 중복 확인
async function checkUsernameDuplicate(username) {
  hideError(signupUsernameError);
  hideSuccess(signupUsernameSuccess);
  console.log('[checkUsernameDuplicate] 중복 확인 대상 아이디:', username);

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      console.log('[checkUsernameDuplicate] 아이디 중복 발견:', username);
      return false;
    } else {
      console.log('[checkUsernameDuplicate] 아이디 사용 가능:', username);
      return true;
    }
  } catch (error) {
    console.error('[checkUsernameDuplicate] 아이디 중복 확인 실패:', error);
    // showNotification은 handleSignup에서 통합 관리하므로 여기서 제거
    // showError도 handleSignup에서 통합 관리하므로 여기서 제거
    return false;
  }
}

// 닉네임 중복 확인
async function checkNicknameDuplicate(nickname) {
  hideError(signupNicknameError);
  console.log('[checkNicknameDuplicate] 중복 확인 대상 닉네임:', nickname);

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('nickname', '==', nickname));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      console.log('[checkNicknameDuplicate] 닉네임 중복 발견:', nickname);
      return false;
    } else {
      console.log('[checkNicknameDuplicate] 닉네임 사용 가능:', nickname);
      return true;
    }
  } catch (error) {
    console.error('[checkNicknameDuplicate] 닉네임 중복 확인 실패:', error);
    // showNotification은 handleSignup에서 통합 관리하므로 여기서 제거
    return false;
  }
}

// 전화번호 중복 확인
async function checkPhoneDuplicate(phone) {
  hideError(signupPhoneError);
  console.log('[checkPhoneDuplicate] 중복 확인 대상 전화번호:', phone);

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phone', '==', phone));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      console.log('[checkPhoneDuplicate] 전화번호 중복 발견:', phone);
      return false;
    } else {
      console.log('[checkPhoneDuplicate] 전화번호 사용 가능:', phone);
      return true;
    }
  } catch (error) {
    console.error('[checkPhoneDuplicate] 전화번호 중복 확인 실패:', error);
    // showNotification은 handleSignup에서 통합 관리하므로 여기서 제거
    return false;
  }
}

// 로그인 시 이메일/아이디 존재 여부 확인
async function checkUserExists(emailOrId) {
  hideError(loginEmailIdError);
  console.log('[checkUserExists] 존재 여부 확인 대상:', emailOrId);

  try {
    const usersRef = collection(db, 'users');
    
    // 이메일 형식인지 확인
    const isEmail = isValidEmail(emailOrId);
    
    let q;
    if (isEmail) {
      // 이메일로 검색
      q = query(usersRef, where('email', '==', emailOrId));
    } else {
      // 아이디로 검색
      q = query(usersRef, where('username', '==', emailOrId));
    }
    
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      console.log('[checkUserExists] 존재하는 계정 발견:', emailOrId);
      return true;
    } else {
      console.log('[checkUserExists] 존재하지 않는 계정:', emailOrId);
      return false;
    }
  } catch (error) {
    console.error('[checkUserExists] 계정 존재 여부 확인 실패:', error);
    return false;
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
          '/pages/track-production.html',    '/pages/withdraw.html'
  ],
  // 페이지별 설명
        pageDescriptions: {
          '/pages/track-production.html': '트랙 제작 요청',    '/pages/withdraw.html': '계좌 등록 및 정산'
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

function renderPostSignupBanner() {
  if (document.querySelector('.post-signup-banner')) return;
  // 1시간 스누즈 체크 (유저별 키 우선)
  try {
    const uid = (auth && auth.currentUser && auth.currentUser.uid) || null;
    const keys = uid ? [`channelBannerSnoozeUntil:${uid}`, 'channelBannerSnoozeUntil'] : ['channelBannerSnoozeUntil'];
    const now = Date.now();
    for (const key of keys) {
      const untilStr = localStorage.getItem(key);
      const until = untilStr ? parseInt(untilStr, 10) : 0;
      if (until && now < until) {
        return; // 스누즈 중이면 표시하지 않음
      }
    }
  } catch (_) {}
  const banner = document.createElement('div');
  banner.className = 'post-signup-banner';
  banner.setAttribute('role', 'status');

  const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  const t = (key, fallback) => {
    try {
      if (window.i18next && typeof window.i18next.t === 'function') {
        const v = window.i18next.t(key);
        return v && v !== key ? v : (fallback || key);
      }
    } catch (_) {}
    return fallback || key;
  };

  const icon = document.createElement('div');
  icon.className = 'banner-icon';
  icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';

  const text = document.createElement('div');
  text.className = 'banner-text';
  {
    const title = t('channelManagement.banner.title', '엇! 아직 채널 등록 안 하셨네요?');
    const desc = t('channelManagement.banner.description', '지금 채널을 등록하고 수익창출 시작해보세요!');
    text.innerHTML = `<strong>${title}</strong><br>${desc}`;
  }

  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'banner-cta';
  cta.textContent = isMobile ? t('channelManagement.banner.ctaShort', '채널 등록') : t('channelManagement.banner.ctaLong', '채널 등록하러 가기');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'banner-close';
  closeBtn.setAttribute('aria-label', t('common.close', '닫기'));
  closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  banner.appendChild(icon);
  banner.appendChild(text);
  banner.appendChild(cta);
  banner.appendChild(closeBtn);
  document.body.appendChild(banner);

  const dismiss = () => {
    if (banner && banner.parentNode) {
      banner.classList.add('hide');
      setTimeout(() => banner.parentNode && banner.parentNode.removeChild(banner), 260);
    }
  };

  closeBtn.addEventListener('click', dismiss);
  // 닫기(X) 클릭 시 1시간 스누즈 저장 (유저별 키 우선 저장)
  closeBtn.addEventListener('click', () => {
    try {
      const uid = (auth && auth.currentUser && auth.currentUser.uid) || null;
      const key = uid ? `channelBannerSnoozeUntil:${uid}` : 'channelBannerSnoozeUntil';
      const until = Date.now() + 60 * 60 * 1000; // 1시간
      localStorage.setItem(key, String(until));
    } catch (_) {}
  });
  cta.addEventListener('click', () => {
    try {
      const isOnChannelPage = /\/pages\/channel-management\.html$/.test(window.location.pathname);
      if (auth && auth.currentUser) {
        if (isOnChannelPage) {
          // 같은 페이지면 모달 대신 등록 섹션으로 스크롤
          const target = document.querySelector('.channel-list-section') || document.getElementById('register-channel-btn') || document.getElementById('channel-list');
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          }
        } else {
          // 채널 관리 페이지로 이동 후 스크롤
          window.location.href = '/index.html';
        }
      } else {
        sessionStorage.setItem('redirectToChannelAfterLogin', '1');
        openAuthModal();
      }
    } catch (_) {
      try { sessionStorage.setItem('redirectToChannelAfterLogin', '1'); } catch (_) {}
      openAuthModal();
    } finally {
      dismiss();
    }
  });
}

// 계좌 등록 안내 배너 렌더링
function renderPayoutSignupBanner() {
  if (document.querySelector('.payout-signup-banner')) return;
  // 1시간 스누즈 체크 (유저별 키 우선)
  try {
    const uid = (auth && auth.currentUser && auth.currentUser.uid) || null;
    const keys = uid ? [`payoutBannerSnoozeUntil:${uid}`, 'payoutBannerSnoozeUntil'] : ['payoutBannerSnoozeUntil'];
    const now = Date.now();
    for (const key of keys) {
      const untilStr = localStorage.getItem(key);
      const until = untilStr ? parseInt(untilStr, 10) : 0;
      if (until && now < until) return;
    }
  } catch (_) {}

  const banner = document.createElement('div');
  banner.className = 'payout-signup-banner';
  banner.setAttribute('role', 'status');

  const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  const t = (key, fallback) => {
    try {
      if (window.i18next && typeof window.i18next.t === 'function') {
        const v = window.i18next.t(key);
        return v && v !== key ? v : (fallback || key);
      }
    } catch (_) {}
    return fallback || key;
  };

  const icon = document.createElement('div');
  icon.className = 'banner-icon';
  icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h20"/><path d="M12 2v20"/></svg>';

  const text = document.createElement('div');
  text.className = 'banner-text';
  {
    const title = t('withdraw.banner.title', '정산을 받으려면 계좌 등록을 완료하세요');
    const desc = t('withdraw.banner.description', '채널 등록은 완료되었습니다. 이제 계좌를 등록하면 자동 입금이 시작됩니다.');
    text.innerHTML = `<strong>${title}</strong><br>${desc}`;
  }

  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'banner-cta';
  cta.textContent = isMobile ? t('withdraw.banner.ctaShort', '계좌 등록') : t('withdraw.banner.ctaLong', '계좌 등록 페이지로');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'banner-close';
  closeBtn.setAttribute('aria-label', t('common.close', '닫기'));
  closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  banner.appendChild(icon);
  banner.appendChild(text);
  banner.appendChild(cta);
  banner.appendChild(closeBtn);
  document.body.appendChild(banner);

  const dismiss = () => {
    if (banner && banner.parentNode) {
      banner.classList.add('hide');
      setTimeout(() => banner.parentNode && banner.parentNode.removeChild(banner), 260);
    }
  };

  closeBtn.addEventListener('click', () => {
    dismiss();
    try {
      const uid = (auth && auth.currentUser && auth.currentUser.uid) || null;
      const key = uid ? `payoutBannerSnoozeUntil:${uid}` : 'payoutBannerSnoozeUntil';
      const until = Date.now() + 60 * 60 * 1000; // 1시간
      localStorage.setItem(key, String(until));
    } catch (_) {}
  });

  cta.addEventListener('click', () => {
    try {
      const isOnWithdrawPage = /\/pages\/withdraw\.html$/.test(window.location.pathname);
      if (isOnWithdrawPage) {
        const target = document.getElementById('withdraw-form-wrapper') || document.getElementById('withdraw-form');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.location.href = '/pages/withdraw.html';
      }
    } finally {
      dismiss();
    }
  });
}

// 채널 등록은 완료했지만 계좌 정보가 없는 경우 배너 노출
async function maybeShowPayoutBanner(uid) {
  try {
    if (!uid) return;
    if (document.querySelector('.payout-signup-banner')) return;

    // 채널 유무 확인
    const channelRef = doc(db, 'channels', uid);
    const channelSnap = await getDoc(channelRef);
    const hasChannels = channelSnap.exists() && Array.isArray(channelSnap.data().channels) && channelSnap.data().channels.length > 0;
    if (!hasChannels) return; // 채널이 없으면 기존 채널 등록 배너 우선

    // 계좌 유무 확인
    const accountRef = doc(db, 'user_withdraw_accounts', uid);
    const accountSnap = await getDoc(accountRef);
    const hasAccount = accountSnap.exists() && (
      (accountSnap.data().bank && accountSnap.data().account) ||
      (accountSnap.data().bankCode && accountSnap.data().accountNumber)
    );

    if (!hasAccount) {
      renderPayoutSignupBanner();
    } else {
      const existing = document.querySelector('.payout-signup-banner');
      if (existing) existing.remove();
    }
  } catch (e) {
    // 조용히 무시
  }
}
// 로그인 사용자의 채널 보유 여부에 따라 배너 노출
async function maybeShowChannelBanner(uid) {
  try {
    if (!uid) return;
    // 사이트 전역 표시 (페이지 제한 제거)
    if (document.querySelector('.post-signup-banner')) return;
    const userChannelDocRef = doc(db, 'channels', uid);
    const snap = await getDoc(userChannelDocRef);
    const hasChannels = snap.exists() && Array.isArray(snap.data().channels) && snap.data().channels.length > 0;
    if (!hasChannels) {
      // renderPostSignupBanner(); // 채널 등록 배너 비활성화
    } else {
      const existing = document.querySelector('.post-signup-banner');
      if (existing) existing.remove();
    }
  } catch (e) {
    // 실패 시에는 조용히 무시
  }
}

// 온보딩 모달 열기
function openOnboardingModal() {
  if (onboardingModal) {
    onboardingModal.style.display = 'flex';
    setTimeout(() => {
      onboardingModal.classList.add('show');
    }, 10);
    document.body.style.overflow = 'hidden';
    // 언어별 입력 규칙 즉시 반영
    try { updatePhoneFieldPattern(); } catch (_) {}
    
    // 브라우저 새로고침/뒤로가기 방지
    window.addEventListener('beforeunload', preventOnboardingExit);
    
    // 브라우저 히스토리 조작 방지
    history.pushState(null, null, location.href);
    window.addEventListener('popstate', preventOnboardingExit);
  }
}

// 온보딩 도중 페이지 이탈 방지 함수
function preventOnboardingExit(e) {
  if (onboardingModal && onboardingModal.style.display === 'flex') {
    e.preventDefault();
    e.returnValue = ''; // Chrome에서 필요
    showNotification('회원가입을 완료하기 위해 추가 정보를 입력해 주세요.', true);
    return '회원가입을 완료하기 위해 추가 정보를 입력해 주세요.';
  }
}

// 온보딩 모달 닫기 (완료된 경우에만)
function closeOnboardingModal(force = false) {
  if (onboardingModal) {
    // force가 true인 경우(온보딩 완료 시)에만 모달을 닫음
    if (force) {
      onboardingModal.classList.remove('show');
      setTimeout(() => {
        onboardingModal.style.display = 'none';
        document.body.style.overflow = '';
        clearOnboardingErrors(); // 온보딩 에러 메시지 초기화
        onboardingForm.reset(); // 폼 초기화
        onboardingTermsAgreeRequiredCheckbox.checked = false;
        onboardingMarketingAgreeOptionalCheckbox.checked = false;
        
        // 페이지 이탈 방지 이벤트 리스너 제거
        window.removeEventListener('beforeunload', preventOnboardingExit);
        window.removeEventListener('popstate', preventOnboardingExit);
      }, 300);
    } else {
      // 강제로 닫으려고 시도하는 경우 경고 메시지 표시
      showNotification('회원가입을 완료하기 위해 추가 정보를 입력해 주세요.', true);
      console.log('[closeOnboardingModal] 온보딩 완료 전까지는 모달을 닫을 수 없습니다.');
    }
  }
}

// 온보딩 폼 제출 처리
async function handleOnboarding(e) {
  e.preventDefault();
  clearOnboardingErrors();
  
  const nickname = onboardingNicknameInput.value.trim();
  const phone = onboardingPhoneInput.value.trim();
  const username = onboardingUsernameInput.value.trim();
  const termsAgreed = onboardingTermsAgreeRequiredCheckbox.checked;
  const marketingAgreed = onboardingMarketingAgreeOptionalCheckbox.checked;

  let isValid = true;

  console.log('[handleOnboarding] 폼 데이터:', { nickname, phone, username, termsAgreed, marketingAgreed });

  // 유효성 검사
  if (nickname.length < 2 || nickname.length > 16) {
    showError(onboardingNicknameError, '이름(닉네임)은 2~16자여야 합니다.');
    showNotification('이름(닉네임)이 유효하지 않습니다.', true);
    isValid = false;
  }
  if (!isValidPhoneNumber(phone)) {
    showError(onboardingPhoneError, '전화번호 형식이 올바르지 않습니다 (010-XXXX-XXXX 또는 01XXXXXXXXX).');
    showNotification('전화번호 형식이 올바르지 않습니다.', true);
    isValid = false;
  }
  if (username.length < 4 || username.length > 20 || !/^[a-zA-Z0-9]+$/.test(username)) {
    showError(onboardingUsernameError, '아이디는 4~20자의 영문과 숫자만 가능합니다.');
    showNotification('아이디 형식이 올바르지 않습니다.', true);
    isValid = false;
  }
  if (!termsAgreed) {
    showNotification('이용약관 및 개인정보처리방침에 동의해 주세요.', true);
    isValid = false;
  }

  if (!isValid) {
    console.log('[handleOnboarding] 유효성 검사 실패');
    return;
  }

  // 중복 확인
  const isNicknameUnique = await checkNicknameDuplicate(nickname);
  const isPhoneUnique = await checkPhoneDuplicate(phone);
  const isUsernameUnique = await checkUsernameDuplicate(username);

  if (!isNicknameUnique) {
    showError(onboardingNicknameError, '이미 사용 중인 닉네임입니다.');
    showNotification('이미 사용 중인 닉네임입니다.', true);
    isValid = false;
  }
  if (!isPhoneUnique) {
    showError(onboardingPhoneError, '이미 등록된 전화번호입니다.');
    showNotification('이미 등록된 전화번호입니다.', true);
    isValid = false;
  }
  if (!isUsernameUnique) {
    showError(onboardingUsernameError, '이미 사용 중인 아이디입니다.');
    showNotification('이미 사용 중인 아이디입니다.', true);
    isValid = false;
  }

  if (!isValid) {
    console.log('[handleOnboarding] 중복 확인 실패');
    return;
  }

  try {
    // 현재 로그인된 구글 사용자 정보 가져오기
    const currentUser = auth.currentUser;
    if (!currentUser) {
      showNotification('로그인 정보를 찾을 수 없습니다.', true);
      return;
    }

    // Firestore에 추가 정보 저장
    console.log('[handleOnboarding] 전달할 사용자 데이터:', {
      nickname: nickname,
      phone: phone,
      username: username,
      email: currentUser.email,
      provider: 'google'
    });
    await saveUserToFirestore(currentUser, {
      nickname: nickname,
      phone: phone,
      username: username,
      email: currentUser.email, // 구글 이메일 사용
      provider: 'google'
    });

    console.log('[handleOnboarding] 온보딩 완료');
    showNotification('회원가입이 완료되었습니다.');
    try { sessionStorage.setItem('postSignupPrompt', 'channel'); } catch (_) {}
    closeOnboardingModal(true); // 온보딩 완료 시에만 모달 닫기
    try { maybeShowChannelBanner(currentUser.uid); } catch (_) {}
    
    // 여기에 메인 페이지로 이동하는 로직 추가 가능
    // window.location.href = '/main';
    
  } catch (error) {
    console.error('[handleOnboarding] 온보딩 처리 실패:', error);
    showNotification('회원가입 중 오류가 발생했습니다.', true);
  }
}

// 아이디 중복 확인 통합 함수
async function checkUsernameAndShowResult(usernameInput, errorElement, successElement) {
  hideError(errorElement);
  hideSuccess(successElement);
  const username = usernameInput.value.trim();

  // 아이디 자체 유효성 검사 먼저 수행
  if (!username) {
    showError(errorElement, '아이디를 입력해 주세요.');
    showNotification('아이디를 입력해 주세요.', true);
    return;
  }
  if (username.length < 4 || username.length > 20 || !/^[a-zA-Z0-9]+$/.test(username)) {
    showError(errorElement, '아이디는 4~20자의 영문과 숫자만 가능합니다.');
    showNotification('아이디 형식이 올바르지 않습니다.', true);
    return;
  }

  // 중복 확인 함수 호출 및 결과에 따른 알림 표시
  const isUnique = await checkUsernameDuplicate(username);
  if (isUnique) {
    showSuccess(successElement, '사용 가능한 아이디입니다.');
    showNotification('사용 가능한 아이디입니다.');
  } else {
    showError(errorElement, '이미 사용 중인 아이디입니다.');
    showNotification('이미 사용 중인 아이디입니다.', true);
  }
}

// 자동완성 간섭 방지 함수
function preventAutocompleteInterference() {
  console.log('[preventAutocompleteInterference] 자동완성 간섭 방지 초기화');
  
  // 모든 입력 필드에서 자동완성이 의도치 않게 트리거되는 것을 방지
  document.addEventListener('click', (e) => {
    // 로그인 모달이 열려있지 않을 때는 자동완성 드롭다운 숨기기
    const authModal = document.getElementById('auth-modal');
    const signupModal = document.getElementById('signup-modal');
    const onboardingModal = document.getElementById('onboarding-modal');
    
    const isModalOpen = (authModal && authModal.style.display === 'flex') ||
                       (signupModal && signupModal.style.display === 'flex') ||
                       (onboardingModal && onboardingModal.style.display === 'flex');
    
    if (!isModalOpen) {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName === 'INPUT') {
        // 현재 포커스된 input이 로그인 관련 필드가 아니라면 blur 처리
        const isAuthInput = activeElement.closest('#auth-modal, #signup-modal, #onboarding-modal');
        if (!isAuthInput) {
          activeElement.blur();
        }
      }
    }
  });
  
  // 페이지 전체에서 자동완성 드롭다운이 의도치 않게 나타나는 것 방지
  document.addEventListener('focus', (e) => {
    if (e.target.tagName === 'INPUT') {
      const isAuthInput = e.target.closest('#auth-modal, #signup-modal, #onboarding-modal');
      if (!isAuthInput) {
        // 모달 외부의 입력 필드에서 자동완성 강제 비활성화
        e.target.setAttribute('autocomplete', 'off');
        e.target.setAttribute('readonly', true);
        setTimeout(() => {
          e.target.removeAttribute('readonly');
        }, 100);
      }
    }
  }, true);
  
  // 모달 닫을 때 입력 필드 초기화
  const originalCloseAuthModal = closeAuthModal;
  const originalCloseSignupModal = closeSignupModal;
  const originalCloseOnboardingModal = closeOnboardingModal;
  
  window.closeAuthModal = function() {
    clearModalInputs();
    if (originalCloseAuthModal) originalCloseAuthModal();
  };
  
  window.closeSignupModal = function() {
    clearModalInputs();
    if (originalCloseSignupModal) originalCloseSignupModal();
  };
  
  window.closeOnboardingModal = function() {
    clearModalInputs();
    if (originalCloseOnboardingModal) originalCloseOnboardingModal();
  };
  
  function clearModalInputs() {
    const authInputs = document.querySelectorAll('#auth-modal input, #signup-modal input, #onboarding-modal input');
    authInputs.forEach(input => {
      if (input.type !== 'checkbox') {
        input.value = '';
        input.blur();
      }
    });
  }
}

// 토큰 검증 함수를 전역으로 export
window.verifyUserToken = verifyUserToken;

// 현재 사용자 상태를 전역으로 관리
window.currentUser = null;

// i18n 동기화 훅: 언어 변경 시 로그인/회원가입 입력 규칙 업데이트
try {
  window.syncDynamicI18n = function() {
    try { updatePhoneFieldPattern(); } catch (_) {}
  };
} catch (_) {}

// 모바일 로그인 버튼 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', function() {
  // 모바일 로그인 버튼 이벤트 리스너
  const mobileLoginBtn = document.getElementById('mobile-login-btn');
  if (mobileLoginBtn) {
    mobileLoginBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openAuthModal();
    });
  }
  
  // 기존 모바일 드롭다운 내 로그인 버튼 이벤트 리스너 (mobile-btn-login)
  const mobileBtnLogin = document.getElementById('mobile-btn-login');
  if (mobileBtnLogin) {
    mobileBtnLogin.addEventListener('click', function(e) {
      e.preventDefault();
      openAuthModal();
    });
  }
});

// 현재 선택된 언어 반환 유틸
function getCurrentLang() {
  try {
    return (window.i18next && window.i18next.language) || localStorage.getItem('lang') || (navigator.language && navigator.language.startsWith('ja') ? 'ja' : 'ko');
  } catch (_) {
    return 'ko';
  }
}

// 언어별 전화번호 pattern 적용
function updatePhoneFieldPattern() {
  const lang = getCurrentLang();
  const signupPhone = document.getElementById('signup-phone');
  const onboardingPhone = document.getElementById('onboarding-phone');

  // KO: 010-XXXX-XXXX 또는 010XXXXXXXX
  // JA: 070/080/090-XXXX-XXXX 또는 070/080/090XXXXXXXX
  const koPattern = '010-[0-9]{4}-[0-9]{4}|010[0-9]{8}';
  const jaPattern = '0(70|80|90)-[0-9]{4}-[0-9]{4}|0(70|80|90)[0-9]{8}';

  const pattern = lang === 'ja' ? jaPattern : koPattern;

  if (signupPhone) signupPhone.setAttribute('pattern', pattern);
  if (onboardingPhone) onboardingPhone.setAttribute('pattern', pattern);

  // UX 보조: placeholder, inputmode 동기화
  const placeholderKo = '예: 010-1234-5678 또는 010XXXXXXXX';
  const placeholderJa = '例: 090-1234-5678 または 090XXXXXXXX';
  const placeholder = lang === 'ja' ? placeholderJa : placeholderKo;
  if (signupPhone) {
    signupPhone.setAttribute('placeholder', placeholder);
    signupPhone.setAttribute('inputmode', 'tel');
  }
  if (onboardingPhone) {
    onboardingPhone.setAttribute('placeholder', placeholder);
    onboardingPhone.setAttribute('inputmode', 'tel');
  }
}

// 에러 메시지(최소 범위) - 언어별
function getPhoneInvalidMessage() {
  return getCurrentLang() === 'ja'
    ? '電話番号の形式が正しくありません（例: 090-1234-5678 または 090XXXXXXXX）。'
    : '전화번호 형식이 올바르지 않습니다 (010-XXXX-XXXX 또는 010XXXXXXXX).';
}

function getPhoneDuplicateMessage() {
  return getCurrentLang() === 'ja'
    ? '既に登録されている電話番号です。'
    : '이미 등록된 전화번호입니다.';
}