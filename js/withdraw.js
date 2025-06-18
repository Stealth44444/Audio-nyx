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
  collection
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';

// auth.js 로드 (인증 관련 UI 처리)
import './auth.js';

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

// Firebase Auth 인스턴스
const auth = getAuth(app);
let currentUser = null;
let formMode = 'register'; // 'register' 또는 'update' 상태
let userChannels = []; // 사용자 채널 정보 저장

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

// 오류 메시지 초기화
function clearErrors() {
  bankError.textContent = '';
  accountError.textContent = '';
  accountConfirmError.textContent = '';
  holderError.textContent = '';
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
    
    infoBank.textContent = data.bank || '-';
    infoAccount.textContent = maskAccountNumber(data.account) || '-';
    infoHolder.textContent = data.holder || '-';
    infoUpdated.textContent = formatDate(data.updatedAt) || '-';
    
    // 폼에 현재 데이터 채우기
    bankSelect.value = data.bank || '';
    accountInput.value = data.account || '';
    accountConfirmInput.value = data.account || '';
    holderInput.value = data.holder || '';
    
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
    
    // 버튼 텍스트 수정
    submitBtn.textContent = '계좌 수정하기';
    showFormBtn.textContent = '계좌 수정하기';
    formMode = 'update';
  } else {
    // 계좌 정보 미표시
    noAccountInfo.style.display = 'block';
    accountInfo.style.display = 'none';
    
    // 폼 초기화
    form.reset();
    accountConfirmGroup.style.display = 'none';
    accountFormatGuide.style.display = 'none';
    accountMatchStatus.style.display = 'none';
    
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
    
    // 채널 정보 확인
    const channels = await fetchUserChannels(uid);
    const hasChannels = channels.length > 0;
    
    // 채널 상태에 따른 UI 업데이트
    updateChannelStatusUI(hasChannels);
    
    if (!hasChannels) {
      updateUI(null);
      return;
    }
    
    // 계좌 정보 가져오기
    const docRef = doc(db, 'user_withdraw_accounts', uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      updateUI(data);
    } else {
      updateUI(null);
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
    updateChannelStatusUI(false);
  }
}

// Firebase에 계좌 정보 저장
async function saveAccountData(uid, data) {
  try {
    // 먼저 사용자 문서가 존재하는지 확인
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.warn('[saveAccountData] 사용자 문서가 없습니다. 회원가입 과정을 완료해야 합니다.');
      showToast('계좌 등록을 위해 회원가입을 먼저 완료해주세요.', 'error');
      return false;
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
  } else {
    // 로그아웃된 상태: UI 초기화
    userChannels = [];
    updateUI(null);
    updateChannelStatusUI(false);
  }
});

// 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
  // 애니메이션 초기화
  initializeAnimations();
  
  // 폼 토글 버튼 이벤트
  showFormBtn?.addEventListener('click', toggleForm);
  
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
      const accountData = {
        bank: bankSelect.value,
        account: accountInput.value,
        holder: holderInput.value
      };
      
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
    const userChannelDocRef = doc(db, 'channels', uid);
    const docSnap = await getDoc(userChannelDocRef);
    
    if (docSnap.exists()) {
      const userData = docSnap.data();
      userChannels = userData.channels || [];
      console.log('[fetchUserChannels] 사용자 채널 수:', userChannels.length);
      return userChannels;
    } else {
      userChannels = [];
      console.log('[fetchUserChannels] 등록된 채널이 없습니다.');
      return [];
    }
  } catch (error) {
    console.error('[fetchUserChannels] 채널 정보를 불러오는 중 오류 발생:', error);
    userChannels = [];
    return [];
  }
}

// 채널 등록 상태에 따른 UI 업데이트
function updateChannelStatusUI(hasChannels) {
  if (hasChannels) {
    // 채널이 있는 경우: 안내 메시지 숨기고 폼 활성화
    channelStatusNotice.style.display = 'none';
    showFormBtn.style.display = 'block';
    showFormBtn.disabled = false;
  } else {
    // 채널이 없는 경우: 안내 메시지 표시하고 폼 비활성화
    channelStatusNotice.style.display = 'block';
    showFormBtn.style.display = 'none';
    formWrapper.style.display = 'none';
  }
}