// Firebase 관련 모듈 import
import { app, db } from './firebase.js';
import { 
  getAuth, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js';

import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  collection,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';

// auth.js 로드 (인증 관련 UI 처리)
import './auth.js';

// 사용자 프로필 문서가 없으면 최소 필드로 자동 생성
async function ensureUserProfile(uid) {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) return true;

    // 현재 인증 사용자 정보로 최소 문서 생성 (규칙 요건 충족: uid, email, createdAt)
    const u = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
    if (!u || u.uid !== uid) return false;

    await setDoc(userRef, {
      uid,
      email: u.email || '',
      createdAt: serverTimestamp(),
      // 선택 필드 (규칙상 문자열 허용)
      displayName: u.displayName || '',
      nickname: '',
      phone: '',
      username: '',
      provider: (u.providerData && u.providerData.some(p => p.providerId === 'google.com')) ? 'google' : 'emailpassword'
    });

    return true;
  } catch (e) {
    console.error('[ensureUserProfile] 사용자 문서 자동 생성 실패:', e);
    return false;
  }
}

// === 페이지 애니메이션 (브랜드 페이지와 일관성) ===
function initializeAnimations() {
    const animatedElements = document.querySelectorAll('[data-animate]');
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fade-up');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    animatedElements.forEach(element => {
        observer.observe(element);
    });
}

// DOM 요소
const form = document.getElementById('withdraw-form');
const formWrapper = document.getElementById('withdraw-form-wrapper');
const showFormBtn = document.getElementById('show-form-btn');
const bankSelect = document.getElementById('bank');
const accountInput = document.getElementById('account');
const accountConfirmInput = document.getElementById('account-confirm');
const holderInput = document.getElementById('holder');
const submitBtn = document.getElementById('submit-btn');
const noAccountInfo = document.getElementById('no-account-info');
const accountInfo = document.getElementById('account-info');
const infoBank = document.getElementById('info-bank');
const infoAccount = document.getElementById('info-account');
const infoHolder = document.getElementById('info-holder');
const infoUpdated = document.getElementById('info-updated');
const bankError = document.getElementById('bank-error');
const accountError = document.getElementById('account-error');
const accountConfirmError = document.getElementById('account-confirm-error');
const holderError = document.getElementById('holder-error');
const channelStatusNotice = document.getElementById('channel-status-notice');
const accountFormatGuide = document.getElementById('account-format-guide');
const accountConfirmGroup = document.getElementById('account-confirm-group');
const accountMatchStatus = document.getElementById('account-match-status');
const formatExample = document.getElementById('format-example');

// 언어별 필드 DOM 요소
const krAccountFields = document.getElementById('kr-account-fields');
const jpAccountFields = document.getElementById('jp-account-fields');
const languageOptions = document.querySelectorAll('.language-option, .mobile-language-option');

// 일본 계좌 필드 DOM 요소
const bankCodeInput = document.getElementById('bank-code');
const branchCodeInput = document.getElementById('branch-code');
const accountTypeSelect = document.getElementById('account-type');
const accountNumberInput = document.getElementById('account-number');
const accountHolderKanaInput = document.getElementById('account-holder-kana');
const bankCodeError = document.getElementById('bank-code-error');
const branchCodeError = document.getElementById('branch-code-error');
const accountTypeError = document.getElementById('account-type-error');
const accountNumberError = document.getElementById('account-number-error');
const accountHolderKanaError = document.getElementById('account-holder-kana-error');

// Firebase Auth 인스턴스
const auth = getAuth(app);
let currentUser = null;
let formMode = 'register'; // 'register' 또는 'update' 상태
let userChannels = []; // 사용자 채널 정보 저장
let channelMonitoringUnsubscribe = null; // 채널 모니터링 해제 함수
let currentLanguage = 'ko'; // 현재 선택된 언어

// 은행별 계좌번호 형식 정보
const bankFormats = {
  '국민은행': { length: [11, 14], example: '123456-78-901234' },
  '신한은행': { length: [11, 12], example: '110-123-456789' },
  '우리은행': { length: [13, 14], example: '1002-123-456789' },
  '하나은행': { length: [11, 14], example: '123-456789-01234' },
  '농협은행': { length: [11, 13], example: '123-12-123456' },
  '기업은행': { length: [10, 11], example: '123-123456-01' },
  'SC제일은행': { length: [11, 12], example: '123-12-123456' },
  '카카오뱅크': { length: [13], example: '3333-12-1234567' },
  '토스뱅크': { length: [13], example: '1000-12-1234567' }
};

// 언어 토글 기능
function toggleLanguage(lang) {
  currentLanguage = lang;
  
  // 언어 토글 UI 업데이트
  languageOptions.forEach(option => {
    option.classList.remove('active');
    if (option.dataset.lang === lang) {
      option.classList.add('active');
    }
  });
  
  // 계좌 필드 전환 및 required 속성 관리
  if (lang === 'ko') {
    krAccountFields.style.display = 'block';
    jpAccountFields.style.display = 'none';
    // 한국 필드에 required 속성 추가
    setRequiredAttributes('ko');
    // 폼 상태 초기화
    clearAllFields();
  } else {
    krAccountFields.style.display = 'none';
    jpAccountFields.style.display = 'block';
    // 일본 필드에 required 속성 추가
    setRequiredAttributes('jp');
    // 폼 상태 초기화
    clearAllFields();
  }
  
  // 에러 메시지 초기화
  clearErrors();
}

// required 속성을 언어에 따라 동적으로 관리
function setRequiredAttributes(lang) {
  if (lang === 'ko') {
    // 한국 필드에 required 추가
    if (bankSelect) bankSelect.setAttribute('required', '');
    if (accountInput) accountInput.setAttribute('required', '');
    if (accountConfirmInput) accountConfirmInput.setAttribute('required', '');
    if (holderInput) holderInput.setAttribute('required', '');
    
    // 일본 필드에서 required 제거
    if (bankCodeInput) bankCodeInput.removeAttribute('required');
    if (branchCodeInput) branchCodeInput.removeAttribute('required');
    if (accountTypeSelect) accountTypeSelect.removeAttribute('required');
    if (accountNumberInput) accountNumberInput.removeAttribute('required');
    if (accountHolderKanaInput) accountHolderKanaInput.removeAttribute('required');
  } else {
    // 일본 필드에 required 추가
    if (bankCodeInput) bankCodeInput.setAttribute('required', '');
    if (branchCodeInput) branchCodeInput.setAttribute('required', '');
    if (accountTypeSelect) accountTypeSelect.setAttribute('required', '');
    if (accountNumberInput) accountNumberInput.setAttribute('required', '');
    if (accountHolderKanaInput) accountHolderKanaInput.setAttribute('required', '');
    
    // 한국 필드에서 required 제거
    if (bankSelect) bankSelect.removeAttribute('required');
    if (accountInput) accountInput.removeAttribute('required');
    if (accountConfirmInput) accountConfirmInput.removeAttribute('required');
    if (holderInput) holderInput.removeAttribute('required');
  }
}

// 모든 필드 초기화
function clearAllFields() {
  // 한국 계좌 필드 초기화
  if (bankSelect) bankSelect.value = '';
  if (accountInput) accountInput.value = '';
  if (accountConfirmInput) accountConfirmInput.value = '';
  if (holderInput) holderInput.value = '';
  
  // 일본 계좌 필드 초기화
  if (bankCodeInput) bankCodeInput.value = '';
  if (branchCodeInput) branchCodeInput.value = '';
  if (accountTypeSelect) accountTypeSelect.value = '';
  if (accountNumberInput) accountNumberInput.value = '';
  if (accountHolderKanaInput) accountHolderKanaInput.value = '';
  
  // UI 상태 초기화
  if (accountConfirmGroup) accountConfirmGroup.style.display = 'none';
  if (accountFormatGuide) accountFormatGuide.style.display = 'none';
  if (accountMatchStatus) accountMatchStatus.style.display = 'none';
}

// 오류 메시지 초기화
function clearErrors() {
  // 한국 계좌 필드 에러 초기화
  if (bankError) bankError.textContent = '';
  if (accountError) accountError.textContent = '';
  if (accountConfirmError) accountConfirmError.textContent = '';
  if (holderError) holderError.textContent = '';
  
  // 일본 계좌 필드 에러 초기화
  if (bankCodeError) bankCodeError.textContent = '';
  if (branchCodeError) branchCodeError.textContent = '';
  if (accountTypeError) accountTypeError.textContent = '';
  if (accountNumberError) accountNumberError.textContent = '';
  if (accountHolderKanaError) accountHolderKanaError.textContent = '';
}

// 일본 계좌 검증 함수들
function validateJapaneseAccount() {
  let isValid = true;
  clearErrors();
  
  // 은행 코드 검증 (4자리 숫자)
  if (!bankCodeInput.value) {
    bankCodeError.textContent = '銀行コードを入力してください。';
    isValid = false;
  } else if (!/^\d{4}$/.test(bankCodeInput.value)) {
    bankCodeError.textContent = '銀行コードは4桁の数字で入力してください。';
    isValid = false;
  }
  
  // 지점 코드 검증 (3자리 숫자)
  if (!branchCodeInput.value) {
    branchCodeError.textContent = '支店コードを入力してください。';
    isValid = false;
  } else if (!/^\d{3}$/.test(branchCodeInput.value)) {
    branchCodeError.textContent = '支店コードは3桁の数字で入力してください。';
    isValid = false;
  }
  
  // 계좌 종별 검증
  if (!accountTypeSelect.value) {
    accountTypeError.textContent = '口座種別を選択してください。';
    isValid = false;
  }
  
  // 계좌 번호 검증 (7자리 숫자)
  if (!accountNumberInput.value) {
    accountNumberError.textContent = '口座番号を入力してください。';
    isValid = false;
  } else if (!/^\d{7}$/.test(accountNumberInput.value)) {
    accountNumberError.textContent = '口座番号は7桁の数字で入力してください。';
    isValid = false;
  }
  
  // 계좌 명의자 카나 검증
  if (!accountHolderKanaInput.value) {
    accountHolderKanaError.textContent = '名義カナを入力してください。';
    isValid = false;
  } else if (!/^[ァ-ヶー\s]+$/.test(accountHolderKanaInput.value)) {
    accountHolderKanaError.textContent = '名義カナはカタカナで入力してください。';
    isValid = false;
  }
  
  return isValid;
}

// 계좌번호 형식 검증
function validateAccountNumber(bank, account) {
  if (!bank || !account) return false;
  
  const format = bankFormats[bank];
  if (!format) return true; // 알 수 없는 은행은 통과
  
  const accountLength = account.replace(/\D/g, '').length;
  return format.length.includes(accountLength);
}

// 계좌번호 일치 확인
function checkAccountMatch() {
  const account = accountInput.value.trim();
  const accountConfirm = accountConfirmInput.value.trim();
  
  if (!account || !accountConfirm) {
    accountMatchStatus.style.display = 'none';
    return false;
  }
  
  accountMatchStatus.style.display = 'flex';
  
  if (account === accountConfirm) {
    accountMatchStatus.className = 'account-match-status match';
    accountMatchStatus.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M9 12l2 2 4-4"/>
        <circle cx="12" cy="12" r="9"/>
      </svg>
      계좌번호가 일치합니다
    `;
    return true;
  } else {
    accountMatchStatus.className = 'account-match-status mismatch';
    accountMatchStatus.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="9"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      계좌번호가 일치하지 않습니다
    `;
    return false;
  }
}

// 입력값 유효성 검사
function validateForm() {
  if (currentLanguage === 'ko') {
    return validateKoreanAccount();
  } else {
    return validateJapaneseAccount();
  }
}

// 한국 계좌 검증
function validateKoreanAccount() {
  let isValid = true;
  clearErrors();
  
  if (!bankSelect.value) {
    bankError.textContent = '은행을 선택해주세요.';
    isValid = false;
  }
  
  if (!accountInput.value) {
    accountError.textContent = '계좌번호를 입력해주세요.';
    isValid = false;
  } else if (!/^\d+$/.test(accountInput.value)) {
    accountError.textContent = '계좌번호는 숫자만 입력해주세요.';
    isValid = false;
  } else if (!validateAccountNumber(bankSelect.value, accountInput.value)) {
    const format = bankFormats[bankSelect.value];
    if (format) {
      accountError.textContent = `${bankSelect.value}의 계좌번호 자릿수가 올바르지 않습니다. (${format.length.join('~')}자리)`;
      isValid = false;
    }
  }
  
  if (!accountConfirmInput.value) {
    accountConfirmError.textContent = '계좌번호 재확인을 입력해주세요.';
    isValid = false;
  } else if (!checkAccountMatch()) {
    accountConfirmError.textContent = '계좌번호가 일치하지 않습니다.';
    isValid = false;
  }
  
  if (!holderInput.value) {
    holderError.textContent = '예금주 이름을 입력해주세요.';
    isValid = false;
  }
  
  return isValid;
}

// 계좌번호 마스킹 함수
function maskAccountNumber(account) {
  if (!account || account.length < 6) return account;
  
  const visiblePrefixLength = 3;
  const visibleSuffixLength = 3;
  const prefix = account.substring(0, visiblePrefixLength);
  const suffix = account.substring(account.length - visibleSuffixLength);
  const maskedLength = account.length - visiblePrefixLength - visibleSuffixLength;
  const maskedPart = '*'.repeat(maskedLength);
  
  return `${prefix}${maskedPart}${suffix}`;
}

// 날짜 포맷 함수
function formatDate(timestamp) {
  if (!timestamp) return '-';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 토스트 메시지 표시
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  
  // Add 'show' class to make the toast visible
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Hide the toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    
    // Remove class after animation completes
    setTimeout(() => {
      toast.className = 'toast';
    }, 300);
  }, 3000);
}

// UI 업데이트
function updateUI(data = null) {
  if (data) {
    // 계좌 정보 표시
    noAccountInfo.style.display = 'none';
    accountInfo.style.display = 'block';
    
    // 저장된 언어에 따라 UI 업데이트
    if (data.language) {
      currentLanguage = data.language;
      toggleLanguage(data.language);
    }
    
    if (data.language === 'jp') {
      // 일본 계좌 정보 표시
      infoBank.textContent = `${data.bankCode || '-'} / ${data.branchCode || '-'}`;
      infoAccount.textContent = `${data.accountType || '-'} ${maskAccountNumber(data.accountNumber) || '-'}`;
      infoHolder.textContent = data.accountHolderKana || '-';
      
      // 일본 계좌 폼에 현재 데이터 채우기
      if (bankCodeInput) bankCodeInput.value = data.bankCode || '';
      if (branchCodeInput) branchCodeInput.value = data.branchCode || '';
      if (accountTypeSelect) accountTypeSelect.value = data.accountType || '';
      if (accountNumberInput) accountNumberInput.value = data.accountNumber || '';
      if (accountHolderKanaInput) accountHolderKanaInput.value = data.accountHolderKana || '';
    } else {
      // 한국 계좌 정보 표시
      infoBank.textContent = data.bank || '-';
      infoAccount.textContent = maskAccountNumber(data.account) || '-';
      infoHolder.textContent = data.holder || '-';
      
      // 한국 계좌 폼에 현재 데이터 채우기
      if (bankSelect) bankSelect.value = data.bank || '';
      if (accountInput) accountInput.value = data.account || '';
      if (accountConfirmInput) accountConfirmInput.value = data.account || '';
      if (holderInput) holderInput.value = data.holder || '';
      
      // 계좌번호가 있으면 재확인 필드와 형식 안내 표시
      if (data.account) {
        accountConfirmGroup.style.display = 'block';
        checkAccountMatch();
        
        if (data.bank && bankFormats[data.bank]) {
          const format = bankFormats[data.bank];
          formatExample.textContent = `예: ${format.example} (${format.length.join('~')}자리)`;
          accountFormatGuide.style.display = 'block';
        }
      }
    }
    
    infoUpdated.textContent = formatDate(data.updatedAt) || '-';
    
    // 버튼 텍스트 수정
    submitBtn.textContent = '계좌 수정하기';
    showFormBtn.textContent = '계좌 수정하기';
    formMode = 'update';
  } else {
    // 계좌 정보 미표시
    noAccountInfo.style.display = 'block';
    accountInfo.style.display = 'none';
    
    // 폼 초기화
    clearAllFields();
    
    // 버튼 텍스트 수정
    submitBtn.textContent = '계좌 등록하기';
    showFormBtn.textContent = '계좌 등록하기';
    formMode = 'register';
  }
}

// Firebase에서 사용자 계좌 정보 가져오기
async function fetchAccountData(uid) {
  try {
    // 먼저 사용자 문서가 존재하는지 확인
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.warn('[fetchAccountData] 사용자 문서가 없습니다. 회원가입 과정을 완료해야 합니다.');
      updateUI(null);
      updateChannelStatusUI(false);
      return;
    }
    
    // 채널 정보와 계좌 정보를 병렬로 가져오기
    const [channels, accountData] = await Promise.allSettled([
      fetchUserChannels(uid),
      getDoc(doc(db, 'user_withdraw_accounts', uid))
    ]);
    
    // 채널 정보 처리
    let hasChannels = false;
    if (channels.status === 'fulfilled') {
      hasChannels = channels.value.length > 0;
      console.log('[fetchAccountData] 채널 확인 완료:', hasChannels, '채널 수:', channels.value.length);
    } else {
      console.error('[fetchAccountData] 채널 정보 로드 실패:', channels.reason);
      // 채널 정보를 다시 시도
      try {
        const retryChannels = await fetchUserChannels(uid);
        hasChannels = retryChannels.length > 0;
        console.log('[fetchAccountData] 채널 재시도 성공:', hasChannels, '채널 수:', retryChannels.length);
      } catch (retryError) {
        console.error('[fetchAccountData] 채널 재시도 실패:', retryError);
        hasChannels = false;
      }
    }
    
    // 채널 상태 UI 업데이트
    updateChannelStatusUI(hasChannels);
    
    // 계좌 정보 처리
    if (accountData.status === 'fulfilled' && accountData.value.exists()) {
      const data = accountData.value.data();
      updateUI(data);
    } else {
      updateUI(null);
      if (accountData.status === 'rejected') {
        console.error('[fetchAccountData] 계좌 정보 로드 실패:', accountData.reason);
      }
    }
    
  } catch (error) {
    console.error('계좌 정보를 불러오는 중 오류 발생:', error);
    
    // 권한 오류인 경우 특별히 처리
    if (error.code === 'permission-denied') {
      console.warn('[fetchAccountData] 권한 부족 - 사용자 문서가 없거나 접근 권한이 없습니다.');
      showToast('계좌 정보에 접근할 권한이 없습니다. 회원가입을 완료해주세요.', 'error');
    } else {
      showToast('계좌 정보를 불러오는 중 오류가 발생했습니다.', 'error');
    }
    updateUI(null);
    
    // 채널 정보만 별도로 다시 확인
    try {
      const channels = await fetchUserChannels(uid);
      updateChannelStatusUI(channels.length > 0);
    } catch (channelError) {
      console.error('[fetchAccountData] 오류 상황에서 채널 정보 확인 실패:', channelError);
      updateChannelStatusUI(false);
    }
  }
}

// Firebase에 계좌 정보 저장
async function saveAccountData(uid, data) {
  try {
    // 사용자 문서 보장 (없으면 자동 생성)
    const userRef = doc(db, 'users', uid);
    let userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      const created = await ensureUserProfile(uid);
      if (!created) {
        console.warn('[saveAccountData] 사용자 문서 자동 생성 실패');
        showToast('계좌 등록을 위해 회원가입 정보를 확인해주세요.', 'error');
        return false;
      }
      userSnap = await getDoc(userRef);
    }
    
    // 채널 정보 확인
    if (userChannels.length === 0) {
      showToast('채널 등록이 필요합니다. 채널 관리 페이지에서 채널을 먼저 등록해주세요.', 'error');
      return false;
    }
    
    // 계좌 정보와 채널 정보 함께 저장
    const docRef = doc(db, 'user_withdraw_accounts', uid);
    const saveData = {
      ...data,
      uid: uid,
      channels: userChannels, // 채널 정보 포함
      updatedAt: serverTimestamp()
    };
    
    await setDoc(docRef, saveData);
    
    console.log('[saveAccountData] 계좌 정보 저장 완료. 포함된 채널 수:', userChannels.length);
    
    showToast(formMode === 'register' 
      ? '계좌가 정상 등록되었습니다.' 
      : '계좌 정보가 업데이트되었습니다.');
      
    // 성공 후 UI 새로고침
    await fetchAccountData(uid);
    form.reset();
    formWrapper.style.display = 'none';
      
    return true;
  } catch (error) {
    console.error('계좌 정보 저장 중 오류 발생:', error);
    
    // 권한 오류인 경우 특별히 처리
    if (error.code === 'permission-denied') {
      console.warn('[saveAccountData] 권한 부족 - 사용자 문서가 없거나 접근 권한이 없습니다.');
      showToast('계좌 정보를 저장할 권한이 없습니다. 회원가입을 완료해주세요.', 'error');
    } else {
      showToast('계좌 정보 저장 중 오류가 발생했습니다.', 'error');
    }
    return false;
  }
}

// 폼 토글 기능
function toggleForm() {
  if (formWrapper.style.display === 'none' || !formWrapper.style.display) {
    formWrapper.style.display = 'block';
    showFormBtn.textContent = '취소';

    // 모바일 키보드 자동 노출: 폼 오픈 시 첫 입력란에 포커스
    try {
      setTimeout(() => {
        let targetInput = null;
        if (currentLanguage === 'ko') {
          // 한국 계좌: 숫자 입력 필드에 포커스
          targetInput = accountInput || holderInput;
          if (targetInput) {
            targetInput.setAttribute('inputmode', 'numeric');
            targetInput.setAttribute('enterkeyhint', 'next');
            targetInput.setAttribute('autocomplete', 'off');
            targetInput.setAttribute('autocapitalize', 'off');
            targetInput.setAttribute('autocorrect', 'off');
          }
        } else {
          // 일본 계좌: 은행 코드부터 입력
          targetInput = bankCodeInput || accountNumberInput;
          if (targetInput) {
            targetInput.setAttribute('inputmode', 'numeric');
            targetInput.setAttribute('enterkeyhint', 'next');
            targetInput.setAttribute('autocomplete', 'off');
            targetInput.setAttribute('autocapitalize', 'off');
            targetInput.setAttribute('autocorrect', 'off');
          }
        }

        if (targetInput) {
          // iOS 대응: 스크롤로 입력란을 살짝 올린 뒤 포커스
          try { targetInput.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
          targetInput.focus();
        }
      }, 120);
    } catch (_) {}
  } else {
    formWrapper.style.display = 'none';
    showFormBtn.textContent = formMode === 'register' ? '계좌 등록하기' : '계좌 수정하기';
    form.reset();
    clearErrors();
    accountConfirmGroup.style.display = 'none';
    accountFormatGuide.style.display = 'none';
    accountMatchStatus.style.display = 'none';
  }
}

// 인증 상태 변경 리스너
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  
  if (user) {
    // 로그인된 상태: 계좌 정보 가져오기
    fetchAccountData(user.uid);
    
    // 채널 정보 실시간 모니터링 시작
    setupChannelMonitoring(user.uid);
  } else {
    // 로그아웃된 상태: UI 초기화
    userChannels = [];
    updateUI(null);
    updateChannelStatusUI(false);
    
    // 채널 모니터링 중지
    stopChannelMonitoring();
  }
});

// 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
  // 애니메이션 초기화
  initializeAnimations();
  
  // 초기 언어 설정에 따른 required 속성 설정
  setRequiredAttributes(currentLanguage);
  
  // 폼 토글 버튼 이벤트
  showFormBtn?.addEventListener('click', toggleForm);
  
  // 페이지 진입 직후 모바일에서 스크롤/포커스 유도: 폼이 열려있는 경우 키보드 자동 노출
  try {
    if (formWrapper && formWrapper.style.display === 'block') {
      setTimeout(() => {
        const target = accountInput || holderInput;
        if (target) {
          try { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
          target.focus();
        }
      }, 200);
    }
  } catch (_) {}

  // 모바일에서 필드 터치 시 즉시 키보드 노출 보조
  const attachMobileFocusHelpers = (el, options = {}) => {
    if (!el) return;
    try {
      const { inputmode = null, enterkeyhint = null } = options;
      if (inputmode) el.setAttribute('inputmode', inputmode);
      if (enterkeyhint) el.setAttribute('enterkeyhint', enterkeyhint);
      el.setAttribute('autocomplete', 'off');
      el.setAttribute('autocapitalize', 'off');
      el.setAttribute('autocorrect', 'off');
    } catch (_) {}
    const handler = () => {
      setTimeout(() => {
        try { el.focus({ preventScroll: false }); } catch (_) { el.focus(); }
        try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
      }, 0);
    };
    el.addEventListener('click', handler, { passive: true });
    el.addEventListener('touchend', handler, { passive: true });
    el.addEventListener('pointerdown', handler, { passive: true });
  };

  attachMobileFocusHelpers(accountInput, { inputmode: 'numeric', enterkeyhint: 'next' });
  attachMobileFocusHelpers(holderInput, { inputmode: 'text', enterkeyhint: 'done' });
  attachMobileFocusHelpers(accountConfirmInput, { inputmode: 'numeric', enterkeyhint: 'done' });
  
  // 언어 토글 이벤트
  languageOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      const lang = e.target.dataset.lang;
      if (lang && lang !== currentLanguage) {
        toggleLanguage(lang);
      }
    });
  });
  
  // 폼 제출 이벤트
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      showToast('로그인이 필요합니다.', 'error');
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    // 버튼 비활성화
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '처리 중...';
    
    try {
      let accountData;
      
      if (currentLanguage === 'ko') {
        accountData = {
          language: 'ko',
          bank: bankSelect.value,
          account: accountInput.value,
          holder: holderInput.value
        };
      } else {
        accountData = {
          language: 'jp',
          bankCode: bankCodeInput.value,
          branchCode: branchCodeInput.value,
          accountType: accountTypeSelect.value,
          accountNumber: accountNumberInput.value,
          accountHolderKana: accountHolderKanaInput.value
        };
      }
      
      const success = await saveAccountData(currentUser.uid, accountData);
      
      if (success) {
        // 폼 숨기기
        toggleForm();
      }
    } catch (error) {
      console.error('폼 제출 중 오류:', error);
      showToast('처리 중 오류가 발생했습니다.', 'error');
    } finally {
      // 버튼 활성화
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
  
  // 은행 선택 시 계좌번호 형식 안내 표시
  bankSelect?.addEventListener('change', (e) => {
    bankError.textContent = '';
    
    const selectedBank = e.target.value;
    if (selectedBank && bankFormats[selectedBank]) {
      const format = bankFormats[selectedBank];
      formatExample.textContent = `예: ${format.example} (${format.length.join('~')}자리)`;
      accountFormatGuide.style.display = 'block';
    } else {
      accountFormatGuide.style.display = 'none';
    }
    
    // 계좌번호가 이미 입력된 경우 재검증
    if (accountInput.value) {
      validateAccountNumber(selectedBank, accountInput.value);
    }
  });
  
  // 계좌번호 입력 시 숫자만 허용 및 재확인 필드 표시
  accountInput?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
    accountError.textContent = '';
    
    // 계좌번호가 입력되면 재확인 필드 표시
    if (e.target.value.length > 0) {
      accountConfirmGroup.style.display = 'block';
    } else {
      accountConfirmGroup.style.display = 'none';
      accountMatchStatus.style.display = 'none';
    }
    
    // 재확인 필드에 값이 있으면 일치 여부 확인
    if (accountConfirmInput.value) {
      checkAccountMatch();
    }
  });
  
  // 계좌번호 재확인 입력 시 일치 여부 확인
  accountConfirmInput?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
    accountConfirmError.textContent = '';
    checkAccountMatch();
  });
  
  // 입력 필드 포커스 시 에러 메시지 제거
  holderInput?.addEventListener('input', () => {
    holderError.textContent = '';
  });
});

// 채널 정보 가져오기
async function fetchUserChannels(uid) {
  try {
    console.log('[fetchUserChannels] 채널 정보 조회 중...', uid);
    const userChannelDocRef = doc(db, 'channels', uid);
    const docSnap = await getDoc(userChannelDocRef);
    
    if (docSnap.exists()) {
      const userData = docSnap.data();
      const channels = userData.channels || [];
      userChannels = channels;
      console.log('[fetchUserChannels] 사용자 채널 수:', channels.length);
      
      // 채널 정보 상세 로그
      if (channels.length > 0) {
        console.log('[fetchUserChannels] 채널 목록:', channels.map(c => ({
          url: c.url,
          platform: c.platform,
          status: c.status
        })));
      }
      
      return channels;
    } else {
      userChannels = [];
      console.log('[fetchUserChannels] 채널 문서가 존재하지 않습니다.');
      return [];
    }
  } catch (error) {
    console.error('[fetchUserChannels] 채널 정보를 불러오는 중 오류 발생:', error);
    console.error('[fetchUserChannels] 오류 코드:', error.code);
    console.error('[fetchUserChannels] 오류 메시지:', error.message);
    
    userChannels = [];
    
    // 네트워크 오류인 경우 재시도
    if (error.code === 'unavailable' || error.message.includes('network')) {
      console.log('[fetchUserChannels] 네트워크 오류로 인한 재시도...');
      // 짧은 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const userChannelDocRef = doc(db, 'channels', uid);
        const docSnap = await getDoc(userChannelDocRef);
        
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const channels = userData.channels || [];
          userChannels = channels;
          console.log('[fetchUserChannels] 재시도 성공 - 채널 수:', channels.length);
          return channels;
        } else {
          console.log('[fetchUserChannels] 재시도 결과 - 채널 문서 없음');
          return [];
        }
      } catch (retryError) {
        console.error('[fetchUserChannels] 재시도 실패:', retryError);
        return [];
      }
    }
    
    return [];
  }
}

// 채널 등록 상태에 따른 UI 업데이트
function updateChannelStatusUI(hasChannels) {
  console.log('[updateChannelStatusUI] 채널 상태 업데이트:', hasChannels);
  
  if (hasChannels) {
    // 채널이 있는 경우: 안내 메시지 숨기고 폼 활성화
    console.log('[updateChannelStatusUI] 채널이 있음 - 계좌 등록 폼 활성화');
    if (channelStatusNotice) {
      channelStatusNotice.style.display = 'none';
    }
    if (showFormBtn) {
      showFormBtn.style.display = 'block';
      showFormBtn.disabled = false;
    }
  } else {
    // 채널이 없는 경우: 안내 메시지 표시하고 폼 비활성화
    console.log('[updateChannelStatusUI] 채널이 없음 - 계좌 등록 폼 비활성화');
    if (channelStatusNotice) {
      channelStatusNotice.style.display = 'block';
    }
    if (showFormBtn) {
      showFormBtn.style.display = 'none';
    }
    if (formWrapper) {
      formWrapper.style.display = 'none';
    }
  }
  
  // DOM 요소 상태 확인
  console.log('[updateChannelStatusUI] DOM 요소 상태:', {
    channelStatusNotice: channelStatusNotice ? channelStatusNotice.style.display : 'not found',
    showFormBtn: showFormBtn ? showFormBtn.style.display : 'not found',
    formWrapper: formWrapper ? formWrapper.style.display : 'not found'
  });
}

// 채널 정보 실시간 모니터링 설정
function setupChannelMonitoring(uid) {
  console.log('[setupChannelMonitoring] 채널 모니터링 시작:', uid);
  
  // 기존 리스너가 있다면 해제
  if (channelMonitoringUnsubscribe) {
    channelMonitoringUnsubscribe();
  }
  
  try {
    const userChannelDocRef = doc(db, 'channels', uid);
    
    channelMonitoringUnsubscribe = onSnapshot(userChannelDocRef, (docSnapshot) => {
      console.log('[setupChannelMonitoring] 채널 문서 변경 감지');
      
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data();
        const channels = userData.channels || [];
        userChannels = channels;
        
        console.log('[setupChannelMonitoring] 실시간 채널 업데이트:', channels.length);
        
        // 채널 상태 UI 업데이트
        updateChannelStatusUI(channels.length > 0);
      } else {
        console.log('[setupChannelMonitoring] 채널 문서가 존재하지 않음');
        userChannels = [];
        updateChannelStatusUI(false);
      }
    }, (error) => {
      console.error('[setupChannelMonitoring] 채널 모니터링 오류:', error);
      
      // 오류 발생 시 일반적인 방법으로 다시 시도
      setTimeout(() => {
        console.log('[setupChannelMonitoring] 오류 복구를 위한 재조회 시도');
        fetchUserChannels(uid).then(channels => {
          updateChannelStatusUI(channels.length > 0);
        });
      }, 2000);
    });
    
  } catch (error) {
    console.error('[setupChannelMonitoring] 모니터링 설정 실패:', error);
  }
}

// 채널 모니터링 중지
function stopChannelMonitoring() {
  console.log('[stopChannelMonitoring] 채널 모니터링 중지');
  
  if (channelMonitoringUnsubscribe) {
    channelMonitoringUnsubscribe();
    channelMonitoringUnsubscribe = null;
  }
}