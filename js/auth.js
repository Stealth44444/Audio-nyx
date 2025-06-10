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
    element.style.color = '#dc3545'; // 빨간색으로 명확히 표시
    console.log('[showError] 에러 메시지 표시 완료:', message);
  } else {
    console.error('[showError] DOM 요소가 존재하지 않음:', element);
  }
}

function hideError(element) {
  if (element) {
    element.textContent = '';
    element.style.display = 'none';
  }
}

function showSuccess(element, message) {
  if (element) {
    element.textContent = message;
    element.style.display = 'block';
    element.style.color = '#28a745'; // 성공 메시지 색상
  }
}

function hideSuccess(element) {
  if (element) {
    element.textContent = '';
    element.style.display = 'none';
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

// DOM이 로드된 후 초기화 및 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', () => {
  // DOM 요소 존재 여부 확인
  console.log('[DOM 초기화] signupEmailError 요소:', signupEmailError);
  console.log('[DOM 초기화] signupEmailInput 요소:', signupEmailInput);
  console.log('[DOM 초기화] signupForm 요소:', signupForm);
  
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

  // 자체 회원가입 폼 제출 처리
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
  }

  // 온보딩 폼 제출 처리
  if (onboardingForm) {
    onboardingForm.addEventListener('submit', handleOnboarding);
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
    if (e.target === onboardingModal) {
      closeOnboardingModal();
    }
  });

  // 드롭다운 메뉴 토글
  if (userProfile) {
    userProfile.addEventListener('click', () => {
      dropdownMenu.classList.toggle('show');
      userProfile.setAttribute('aria-expanded', dropdownMenu.classList.contains('show'));
    });
  }

  // 로그아웃 버튼
  if (btnLogout) {
    btnLogout.addEventListener('click', handleLogout);
  }
});

// 사용자 상태 변경 감지
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Firebase 로그인 상태
    console.log('로그인된 사용자:', user);
    if (authButtons) {
      authButtons.style.display = 'none';
    }
    if (userProfile) {
      userProfile.style.display = 'flex';
      
      // Firestore에서 사용자 정보 가져오기
      let displayedName = '사용자';
      let shouldShowProfileImage = false;
      
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
          
          // 프로필 이미지 표시 여부 확인 (구글 로그인인 경우에만)
          if (userData.provider === 'google' && userData.photoURL) {
            shouldShowProfileImage = true;
            userAvatar.src = userData.photoURL;
            console.log('[onAuthStateChanged] 구글 로그인 사용자 - 프로필 이미지 표시:', userData.photoURL);
          } else {
            console.log('[onAuthStateChanged] 이메일/비밀번호 로그인 사용자 - 기본 프로필 이미지 사용');
          }
        } else {
          console.log('[onAuthStateChanged] Firestore에 사용자 문서 없음. Firebase displayName 사용 시도.');
          displayedName = user.displayName || '사용자';
          
          // Firebase Auth의 providerData로 구글 로그인 확인
          const isGoogleLogin = user.providerData && user.providerData.some(provider => provider.providerId === 'google.com');
          if (isGoogleLogin && user.photoURL) {
            shouldShowProfileImage = true;
            userAvatar.src = user.photoURL;
            console.log('[onAuthStateChanged] 구글 로그인 사용자 (Firestore 문서 없음) - Firebase Auth 프로필 이미지 사용');
          }
        }
      } catch (error) {
        console.error('[onAuthStateChanged] Firestore 사용자 정보 로드 실패:', error);
        displayedName = user.displayName || '사용자';
      }
      
      // 프로필 이미지 설정 (구글 로그인이 아닌 경우 기본 이미지)
      if (!shouldShowProfileImage) {
        userAvatar.src = '../images/default-avatar.png'; // 기본 프로필 이미지
      }
      
      userName.textContent = displayedName;
    }
    // 로그인 시 네비게이션 접근 권한 업데이트
    updateNavigationAccessOnLogin(user);
    closeAuthModal(); // 로그인 성공 시 모달 닫기
  } else {
    // Firebase 로그아웃 상태 - UI 초기화
    if (authButtons) {
      authButtons.style.display = 'flex';
    }
    if (userProfile) {
      userProfile.style.display = 'none';
      dropdownMenu.classList.remove('show');
    }
    // 로그아웃 시 네비게이션 접근 권한 재설정
    updateNavigationAccess(null);
  }
});

// 신규 회원 Firestore 저장 함수
async function saveUserToFirestore(user, userData = {}) {
  if (!user || !user.uid) return;
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      // 로그인 방식 확인 (구글 로그인인지 확인)
      const isGoogleLogin = user.providerData && user.providerData.some(provider => provider.providerId === 'google.com');
      
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

      // 구글 로그인인 경우에만 photoURL 저장
      if (isGoogleLogin && user.photoURL) {
        userDataToSave.photoURL = user.photoURL;
        console.log('[saveUserToFirestore] 구글 로그인 - photoURL 저장:', user.photoURL);
      } else {
        console.log('[saveUserToFirestore] 이메일/비밀번호 로그인 - photoURL 저장하지 않음');
      }

      await setDoc(userRef, userDataToSave);
      console.log('신규 회원 Firestore 저장 완료:', user.uid, '프로바이더:', userDataToSave.provider);
    }
  } catch (error) {
    console.error('Firestore 회원 저장 실패:', error);
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
  try {
    await signOut(auth);
    
    // UI 초기화
    if (authButtons) {
      authButtons.style.display = 'flex';
    }
    if (userProfile) {
      userProfile.style.display = 'none';
      dropdownMenu.classList.remove('show');
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
      clearLoginErrors(); // 로그인 에러 메시지 초기화
      emailLoginForm.reset(); // 폼 초기화
    }, 300); // CSS transition 시간과 일치
  }
}

// 자체 회원가입 모달 열기
function openSignupModal() {
  if (signupModal) {
    signupModal.style.display = 'flex';
  setTimeout(() => {
      signupModal.classList.add('show');
  }, 10);
  document.body.style.overflow = 'hidden';
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
  const re = /^010-[0-9]{4}-[0-9]{4}$/;
  return re.test(phone);
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
    isValid = false;
  }
  if (!password) {
    showError(loginPasswordError, '비밀번호를 입력해 주세요.');
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
    showError(signupPhoneError, '전화번호 형식이 올바르지 않습니다 (010-XXXX-XXXX).');
    showNotification('전화번호 형식이 올바르지 않습니다.', true);
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
    showError(signupPhoneError, '이미 등록된 전화번호입니다.');
    showNotification('이미 등록된 전화번호입니다.', true);
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
    await saveUserToFirestore(user, {
      nickname: nickname,
      phone: phone,
      username: username,
      marketingAgreed: marketingAgreed
    });
    console.log('Firestore 사용자 데이터 저장 성공');

    showNotification('회원가입이 완료되었습니다!');
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

// 온보딩 모달 열기
function openOnboardingModal() {
  if (onboardingModal) {
    onboardingModal.style.display = 'flex';
    setTimeout(() => {
      onboardingModal.classList.add('show');
    }, 10);
    document.body.style.overflow = 'hidden';
  }
}

// 온보딩 모달 닫기
function closeOnboardingModal() {
  if (onboardingModal) {
    onboardingModal.classList.remove('show');
    setTimeout(() => {
      onboardingModal.style.display = 'none';
      document.body.style.overflow = '';
      clearOnboardingErrors(); // 온보딩 에러 메시지 초기화
      onboardingForm.reset(); // 폼 초기화
      onboardingTermsAgreeRequiredCheckbox.checked = false;
      onboardingMarketingAgreeOptionalCheckbox.checked = false;
    }, 300);
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
    showError(onboardingPhoneError, '전화번호 형식이 올바르지 않습니다 (010-XXXX-XXXX).');
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
    await saveUserToFirestore(currentUser, {
      nickname: nickname,
      phone: phone,
      username: username,
      email: currentUser.email // 구글 이메일 사용
    });

    console.log('[handleOnboarding] 온보딩 완료');
    showNotification('회원가입이 완료되었습니다.');
    closeOnboardingModal();
    
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