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
const holderError = document.getElementById('holder-error');

// Firebase Auth 인스턴스
const auth = getAuth(app);
let currentUser = null;
let formMode = 'register'; // 'register' 또는 'update' 상태

// 오류 메시지 초기화
function clearErrors() {
  bankError.textContent = '';
  accountError.textContent = '';
  holderError.textContent = '';
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
    holderInput.value = data.holder || '';
    
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
    
    // 버튼 텍스트 수정
    submitBtn.textContent = '계좌 등록하기';
    showFormBtn.textContent = '계좌 등록하기';
    formMode = 'register';
  }
}

// Firebase에서 사용자 계좌 정보 가져오기
async function fetchAccountData(uid) {
  try {
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
    showToast('계좌 정보를 불러오는 중 오류가 발생했습니다.', 'error');
  }
}

// Firebase에 계좌 정보 저장
async function saveAccountData(uid, data) {
  try {
    const docRef = doc(db, 'user_withdraw_accounts', uid);
    await setDoc(docRef, {
      ...data,
      uid: uid,
      updatedAt: serverTimestamp()
    });
    
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
    showToast('계좌 정보 저장 중 오류가 발생했습니다.', 'error');
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
    updateUI(null);
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
  
  // 계좌번호 입력 시 숫자만 허용
  accountInput?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });
  
  // 입력 필드 포커스 시 에러 메시지 제거
  bankSelect?.addEventListener('change', () => {
    bankError.textContent = '';
  });
  
  accountInput?.addEventListener('input', () => {
    accountError.textContent = '';
  });
  
  holderInput?.addEventListener('input', () => {
    holderError.textContent = '';
  });
});