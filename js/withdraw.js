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
  onSnapshot,
  query,
  where
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
function initPageAnimations() {
    const animatedElements = document.querySelectorAll('[data-animate]');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
        const animationType = entry.target.getAttribute('data-animate');
        if (animationType === 'fade-up') {
          entry.target.classList.add('animate-fade-up');
        } else if (animationType === 'fade-in') {
          entry.target.classList.add('animate-fade-in');
        }
        
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    observer.observe(el);
  });
}

// === DOM 요소 참조 ===
let userChannels = [];
let channelMonitoringUnsubscribe = null;

// DOM 요소들
let showFormBtn; // assign after DOMContentLoaded
let formWrapper; // assign after DOMContentLoaded
let withdrawForm; // assign after DOMContentLoaded
const channelStatusNotice = document.querySelector('.channel-status-notice');

// === 폼 유효성 검사 ===
function validateForm() {
  let isValid = true;
  const errors = {};

  // 은행 선택 검사
  const bankSelect = document.getElementById('bank');
  if (!bankSelect || !bankSelect.value) {
    errors.bank = '은행을 선택해주세요.';
    isValid = false;
  }
  
  // 계좌번호 검사
  const accountInput = document.getElementById('account');
  if (!accountInput || !accountInput.value.trim()) {
    errors.account = '계좌번호를 입력해주세요.';
    isValid = false;
  } else if (!/^[0-9]+$/.test(accountInput.value.trim())) {
    errors.account = '계좌번호는 숫자만 입력 가능합니다.';
      isValid = false;
  }

  // 예금주 검사
  const holderInput = document.getElementById('holder');
  if (!holderInput || !holderInput.value.trim()) {
    errors.holder = '예금주를 입력해주세요.';
    isValid = false;
  }
  
  // 에러 메시지 표시
  Object.keys(errors).forEach(field => {
    const errorElement = document.getElementById(`${field}-error`);
    if (errorElement) {
      errorElement.textContent = errors[field];
    }
  });

  // 에러가 없는 필드의 에러 메시지 제거
  ['bank', 'account', 'holder'].forEach(field => {
    if (!errors[field]) {
      const errorElement = document.getElementById(`${field}-error`);
      if (errorElement) {
        errorElement.textContent = '';
      }
    }
  });

  return isValid;
}

// === 계좌 정보 저장 ===
async function saveAccountData(userId, accountData) {
  try {
    const accountRef = doc(db, 'user_withdraw_accounts', userId);
    await setDoc(accountRef, {
      ...accountData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log('[saveAccountData] 계좌 정보 저장 성공');
    return true;
  } catch (error) {
    console.error('[saveAccountData] 계좌 정보 저장 실패:', error);
    return false;
  }
}

// === 계좌 정보 가져오기 ===
async function fetchAccountData(userId) {
  try {
    const accountRef = doc(db, 'user_withdraw_accounts', userId);
    const accountSnap = await getDoc(accountRef);
    
    if (accountSnap.exists()) {
      const accountData = accountSnap.data();
      updateAccountInfoUI(accountData);
      return accountData;
  } else {
      showNoAccountInfo();
      return null;
    }
  } catch (error) {
    console.error('[fetchAccountData] 계좌 정보 조회 실패:', error);
    showNoAccountInfo();
    return null;
  }
}

// === 계좌 정보 UI 업데이트 ===
function updateAccountInfoUI(accountData) {
  const noAccountInfo = document.getElementById('no-account-info');
  const accountInfo = document.getElementById('account-info');
  
  if (noAccountInfo) noAccountInfo.style.display = 'none';
  if (accountInfo) {
    accountInfo.style.display = 'block';
    
    // 계좌 정보 표시
    const bankElement = document.getElementById('info-bank');
    const accountElement = document.getElementById('info-account');
    const holderElement = document.getElementById('info-holder');
    const updatedElement = document.getElementById('info-updated');
    
    if (bankElement) bankElement.textContent = accountData.bank || '-';
    if (accountElement) accountElement.textContent = accountData.account || '-';
    if (holderElement) holderElement.textContent = accountData.holder || '-';
    if (updatedElement && accountData.updatedAt) {
      const updateDate = accountData.updatedAt.toDate ? accountData.updatedAt.toDate() : new Date(accountData.updatedAt);
      updatedElement.textContent = updateDate.toLocaleDateString('ko-KR');
    }
  }
}

// === 계좌 정보 없음 표시 ===
function showNoAccountInfo() {
  const noAccountInfo = document.getElementById('no-account-info');
  const accountInfo = document.getElementById('account-info');
  
  if (noAccountInfo) noAccountInfo.style.display = 'block';
  if (accountInfo) accountInfo.style.display = 'none';
}

// === 토스트 메시지 ===
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.style.display = 'block';
  
    setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// === 채널 정보 가져오기 ===
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
    }
    // else 블록 제거: 채널 문서가 없어도 대시보드는 표시
      userChannels = [];
      console.log('[fetchUserChannels] 채널 문서가 존재하지 않습니다.');
      return [];
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

// === 채널 등록 상태에 따른 UI 업데이트 ===
function updateChannelStatusUI(hasChannels) {
  console.log('[updateChannelStatusUI] 채널 상태 업데이트:', hasChannels);
  
  // 대시보드에서는 채널 등록 여부와 관계없이 대시보드 표시
  // 폼 활성화/비활성화 로직은 유지
  if (hasChannels) {
    console.log('[updateChannelStatusUI] 채널이 있음 - 계좌 등록 폼 활성화');
    if (channelStatusNotice) {
      channelStatusNotice.style.display = 'none';
    }
    if (showFormBtn) {
      showFormBtn.style.display = 'block';
      showFormBtn.disabled = false;
    }
  }
  // else 블록 제거: 대시보드에서는 채널 등록 여부와 관계없이 대시보드 표시
  
  // DOM 요소 상태 확인
  console.log('[updateChannelStatusUI] DOM 요소 상태:', {
    channelStatusNotice: channelStatusNotice ? channelStatusNotice.style.display : 'not found',
    showFormBtn: showFormBtn ? showFormBtn.style.display : 'not found',
    formWrapper: formWrapper ? formWrapper.style.display : 'not found'
  });
}

// === 채널 정보 실시간 모니터링 설정 ===
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

// === 채널 모니터링 중지 ===
function stopChannelMonitoring() {
  console.log('[stopChannelMonitoring] 채널 모니터링 중지');
  
  if (channelMonitoringUnsubscribe) {
    channelMonitoringUnsubscribe();
    channelMonitoringUnsubscribe = null;
  }
}

// === Dashboard Chart Rendering ===
function renderDashboardCharts(monthlyEarnings, earningsLabels, sourceBreakdown, sourceLabels) {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded. Make sure to include the script in your HTML.');
        // Chart.js가 로드되지 않은 경우에도 대시보드는 표시
        return;
    }
    
    console.log('[renderDashboardCharts] 차트 렌더링 시작', { monthlyEarnings, sourceBreakdown });
    
    // 데이터가 모두 0인 경우 차트 대신 메시지 표시
    const hasEarningsData = monthlyEarnings && monthlyEarnings.some(amount => amount > 0);
    const hasSourceData = sourceBreakdown && sourceBreakdown.some(amount => amount > 0);

    // Chart Configs
    const earningsChartConfig = {
        type: 'line',
        data: {
            labels: earningsLabels,
            datasets: [{
                label: '월별 수익',
                data: monthlyEarnings,
                borderColor: '#3EB489',
                backgroundColor: 'rgba(62, 180, 137, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#3EB489',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff',
                        callback: function(value) {
                            return '₩' + value.toLocaleString();
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff'
                    }
                }
            }
        }
    };

    const sourceChartConfig = {
        type: 'doughnut',
        data: {
            labels: sourceLabels,
            datasets: [{
                data: sourceBreakdown,
                backgroundColor: [
                    '#3EB489',
                    '#FF6B35',
                    '#4ECDC4',
                    '#45B7D1',
                    '#96CEB4',
                    '#FFEAA7'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff',
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    };

    // Render Charts
    const earningsCtx = document.getElementById('earningsChart');
    if (earningsCtx) {
        // Destroy existing chart if it exists to prevent re-rendering issues
        if (window.earningsChartInstance) {
            window.earningsChartInstance.destroy();
        }
        
        if (hasEarningsData) {
        window.earningsChartInstance = new Chart(earningsCtx, earningsChartConfig);
        } else {
            // 데이터가 없으면 메시지 표시
            earningsCtx.parentElement.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #64748b; font-size: 14px;">
                    월별 수익 데이터가 없습니다
                </div>
            `;
        }
    }

    const sourceCtx = document.getElementById('sourceChart');
    if (sourceCtx) {
        // Destroy existing chart if it exists to prevent re-rendering issues
        if (window.sourceChartInstance) {
            window.sourceChartInstance.destroy();
        }
        
        if (hasSourceData) {
            window.sourceChartInstance = new Chart(sourceCtx, sourceChartConfig);
  } else {
            // 데이터가 없으면 메시지 표시
            sourceCtx.parentElement.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #64748b; font-size: 14px;">
                    수익 소스 데이터가 없습니다
                </div>
            `;
        }
    }
}

function getPlatformIcon(platform) {
  const p = String(platform).toLowerCase();
  if (p.includes('spotify')) {
    return '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.223 17.493c-.24.36-.68.47-1.04.23-.29-.19-.4-.51-.4-.82v-.01c0-.3.11-.6.39-.79 2.5-1.53 2.84-4.23.7-6.16-2.13-1.93-5.53-2.2-8.2.23-.34.3-.78.39-1.14.15-.36-.24-.48-.68-.24-1.04.24-.36.68-.48 1.04-.24 3.25-2.92 7.43-2.5 10.13.23 2.7 2.7 2.35 6.38-.58 8.21zm-3.11-3.11c-.2.29-.58.38-.88.18-1.92-1.18-4.32-1.53-7.02-.82-.3.08-.6-.08-.68-.38-.08-.3.08-.6.38-.68 3-.78 5.7-.39 7.82.98.3.2.38.58.18.88zm-4.1-3.25c-.16.24-.48.32-.72.16-1.5-.92-3.4-.92-4.82 0-.24.16-.56.08-.72-.16-.16-.24-.08-.56.16-.72 1.64-1.08 3.9-.99 5.64.24.24.16.32.48.16.72z"/></svg>';
  }
  if (p.includes('apple')) {
    return '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.015 6.992C10.848 6.984 9.83 7.544 9.24 8.4c-1.12 1.696-.744 4.12.704 6.04.56.72 1.216 1.584 2.048 1.584.816 0 1.232-.784 2.016-1.584 1.24-1.28 1.824-2.96 1.824-4.64 0-2.312-1.68-3.408-3.816-3.408zM14.4 2.16c-.048.008-2.248.96-3.6 2.48-.96 1.12-1.88 2.8-1.632 4.44.12.784.56 1.472 1.12 2.04.56.56 1.248.968 2.064.96.048 0 .08-.008.12-.008.04-.008.08-.008.12-.008.8-.008 1.536-.44 2.096-1.04.64-.64 1.04-1.512 1.04-2.424 0-.072-.016-.144-.016-.216-.024-1.52-1.008-2.92-2.2-3.816C15.448 2.448 14.76 2.16 14.4 2.16z"/></svg>';
  }
  if (p.includes('youtube')) {
    return '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M21.582 7.242c-.23-.854-.882-1.508-1.735-1.738C18.23 5 12 5 12 5s-6.23 0-7.847.504c-.853.23-1.505.884-1.735 1.738C2 9.01 2 12 2 12s0 2.99.418 4.758c.23.854.882 1.508 1.735 1.738C5.77 19 12 19 12 19s6.23 0 7.847-.504c.853-.23 1.505-.884 1.735-1.738C22 14.99 22 12 22 12s0-2.99-.418-4.758zM9.75 15.5V8.5l6.5 3.5-6.5 3.5z"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
}

let totalRevenueAmount, totalRevenueChange, currentBalanceAmount, nextPayoutDate, lastUpdatedDateEl, latestTrackInfoEl, sourceListEl, payoutHistoryList, dbAccountBank, dbAccountNumber, dbAccountHolder;

// DOM 요소 참조 함수
function getDashboardElements() {
    totalRevenueAmount = document.querySelector('.card-total-revenue .revenue-amount');
    totalRevenueChange = document.querySelector('.card-total-revenue .revenue-change');
    currentBalanceAmount = document.querySelector('.card-current-balance .balance-amount');
    nextPayoutDate = document.querySelector('.card-next-payout .payout-date');
    lastUpdatedDateEl = document.querySelector('.card-last-updated .update-date');
    latestTrackInfoEl = document.getElementById('latest-track-info');
    sourceListEl = document.getElementById('source-list');
    // 대시보드 내 계좌 정보 요소
    dbAccountBank = document.getElementById('dashboard-account-bank');
    dbAccountNumber = document.getElementById('dashboard-account-number');
    dbAccountHolder = document.getElementById('dashboard-account-holder');
}

function updateDashboardUI(dashboardData) {
    getDashboardElements();

    if (totalRevenueAmount) totalRevenueAmount.textContent = `₩${dashboardData.totalRevenue.toLocaleString()}`;
    if (totalRevenueChange) {
        totalRevenueChange.textContent = `${dashboardData.totalRevenueChange >= 0 ? '+' : ''}${dashboardData.totalRevenueChange}%`;
        totalRevenueChange.style.color = dashboardData.totalRevenueChange >= 0 ? '#22c55e' : '#ef4444';
    }
    if (currentBalanceAmount) currentBalanceAmount.textContent = `₩${dashboardData.currentBalance.toLocaleString()}`;
    if (nextPayoutDate) nextPayoutDate.textContent = dashboardData.nextPayout;
    if (lastUpdatedDateEl) lastUpdatedDateEl.textContent = dashboardData.lastUpdatedAt || '-';

    if (latestTrackInfoEl) {
        const title = dashboardData.latestTrackTitle || '-';
        const artist = dashboardData.latestTrackArtist || '-';
        latestTrackInfoEl.textContent = title === '-' ? '-' : `${title} - ${artist}`;
    }

    // 대시보드 내 계좌 정보 업데이트
    if (dbAccountBank) dbAccountBank.textContent = dashboardData.bank || '-';
    if (dbAccountNumber) dbAccountNumber.textContent = dashboardData.account || '-';
    if (dbAccountHolder) dbAccountHolder.textContent = dashboardData.holder || '-';

    if (sourceListEl) {
        sourceListEl.innerHTML = '';
        if (dashboardData.sourceBreakdownMap && dashboardData.sourceBreakdownMap.size > 0) {
            const sourceLabels = Array.from(dashboardData.sourceBreakdownMap.keys());
            const sourceData = Array.from(dashboardData.sourceBreakdownMap.values());
            
            sourceLabels.forEach((platform, index) => {
                const amount = sourceData[index];
                const li = document.createElement('li');
                li.innerHTML = `
                    <span class="source-icon">${getPlatformIcon(platform)}</span>
                    <span class="source-name">${platform}</span>
                    <span class="source-amount">₩${amount.toLocaleString()}</span>
                `;
                sourceListEl.appendChild(li);
            });
        } else {
            sourceListEl.innerHTML = '<li style="justify-content: center; color: #64748b;">수익 소스 데이터가 없습니다</li>';
        }
    }

    renderDashboardCharts(dashboardData.monthlyEarnings, dashboardData.earningsLabels, Array.from(dashboardData.sourceBreakdownMap.values()), Array.from(dashboardData.sourceBreakdownMap.keys()));
}

// === Fetch Dashboard Data ===

async function fetchDashboardData(uid) {
    try {
        // 두 데이터 소스를 병렬로 조회
        const [userEarningsSnap, userAccountSnap] = await Promise.all([
            getDoc(doc(db, 'user_earnings', uid)),
            getDoc(doc(db, 'user_withdraw_accounts', uid))
        ]);

        let earningsData = {};
        let accountData = {};

        if (userEarningsSnap.exists()) {
            earningsData = userEarningsSnap.data();
        }

        if (userAccountSnap.exists()) {
            accountData = userAccountSnap.data();
            // 기존 계좌 정보 UI도 업데이트
            updateAccountInfoUI(accountData);
        } else {
            showNoAccountInfo();
        }

        const monthlyEarningsMap = new Map();
        const currentYear = new Date().getFullYear();
        const monthLabels = ['6월', '7월', '8월', '9월', '10월', '11월'];
        const monthKeys = [`${currentYear}-06`, `${currentYear}-07`, `${currentYear}-08`, `${currentYear}-09`, `${currentYear}-10`, `${currentYear}-11`];
        monthKeys.forEach(key => monthlyEarningsMap.set(key, 0));

        const sourceBreakdownMap = new Map();
        if (earningsData.monthlyEarnings) {
            earningsData.monthlyEarnings.forEach(earning => {
                if (monthlyEarningsMap.has(earning.month)) {
                    const currentAmount = monthlyEarningsMap.get(earning.month);
                    monthlyEarningsMap.set(earning.month, currentAmount + earning.amount);
                }
                const platform = earning.platform || '기타';
                const currentSourceAmount = sourceBreakdownMap.get(platform) || 0;
                sourceBreakdownMap.set(platform, currentSourceAmount + earning.amount);
            });
        }
        const chartMonthlyEarnings = Array.from(monthlyEarningsMap.values());

        const currentMonthIndex = new Date().getMonth() - 5; // Assuming 6월 is index 0
        const lastMonthIndex = currentMonthIndex - 1;

        const currentMonthRevenue = chartMonthlyEarnings[currentMonthIndex] || 0;
        const lastMonthRevenue = chartMonthlyEarnings[lastMonthIndex] || 0;

        let totalRevenueChange = 0;
        if (lastMonthRevenue > 0) {
            totalRevenueChange = Math.round(((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);
        } else if (currentMonthRevenue > 0) {
            totalRevenueChange = 100; // 지난달 수익이 0일 때
        }

        let latestTrackTitle = '-';
        let latestTrackArtist = '-';
        if (earningsData.monthlyEarnings && earningsData.monthlyEarnings.length > 0) {
            const sortedEarnings = [...earningsData.monthlyEarnings].sort((a, b) => new Date(b.month) - new Date(a.month));
            const latestEarningRecord = sortedEarnings[0];
            if (latestEarningRecord) {
                latestTrackTitle = latestEarningRecord.trackTitle || '-';
                latestTrackArtist = latestEarningRecord.artistName || latestEarningRecord.artist || '-';
            }
        }

        let lastUpdatedAtFormatted = '-';
        if (earningsData.lastUpdatedAt && earningsData.lastUpdatedAt.toDate) {
            const date = earningsData.lastUpdatedAt.toDate();
            lastUpdatedAtFormatted = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
        }

        return {
            totalRevenue: earningsData.totalEarnings || 0,
            totalRevenueChange: totalRevenueChange,
            currentBalance: earningsData.currentBalance || 0,
            nextPayout: earningsData.nextPayout || '-',
            monthlyEarnings: chartMonthlyEarnings,
            earningsLabels: monthLabels,
            sourceBreakdownMap,
            payoutHistory: earningsData.payoutHistory || [],
            latestTrackTitle,
            latestTrackArtist,
            lastUpdatedAt: lastUpdatedAtFormatted,
            bank: accountData.bank,
            account: accountData.account,
            holder: accountData.holder
        };

    } catch (error) {
        console.error('[fetchDashboardData] 데이터 조회 오류:', error);
        return { 
            totalRevenue: 0, currentBalance: 0, nextPayout: '-',
            monthlyEarnings: [0, 0, 0, 0, 0, 0],
            earningsLabels: ['6월', '7월', '8월', '9월', '10월', '11월'],
            sourceBreakdown: new Map(),
            payoutHistory: [],
            latestTrackTitle: '-', latestTrackArtist: '-',
            lastUpdatedAt: '-',
            bank: '-', account: '-', holder: '-'
        };
    }
}

// === 계좌번호 재확인 기능 ===
function setupAccountConfirmation() {
  const accountInput = document.getElementById('account');
  const accountConfirmInput = document.getElementById('account-confirm');
  const accountConfirmGroup = document.getElementById('account-confirm-group');
  const accountMatchStatus = document.getElementById('account-match-status');
  const accountConfirmError = document.getElementById('account-confirm-error');
  const holderInput = document.getElementById('holder'); // Declare holderInput locally

  if (!accountInput || !accountConfirmInput || !accountConfirmGroup || !accountMatchStatus || !holderInput) return;

  // 계좌번호 일치 여부 확인 함수
  function checkAccountMatch() {
    const accountValue = accountInput.value.trim();
    const confirmValue = accountConfirmInput.value.trim();

    if (confirmValue === '') {
      accountMatchStatus.textContent = '';
      accountMatchStatus.className = 'account-match-status';
      return;
    }
    
    if (accountValue === confirmValue) {
      accountMatchStatus.textContent = '✓ 계좌번호가 일치합니다';
      accountMatchStatus.className = 'account-match-status match';
      accountConfirmError.textContent = '';
      } else {
      accountMatchStatus.textContent = '✗ 계좌번호가 일치하지 않습니다';
      accountMatchStatus.className = 'account-match-status no-match';
      accountConfirmError.textContent = '계좌번호가 일치하지 않습니다.';
    }
  }

  // 계좌번호 입력 시 재확인 필드 표시/숨김
  accountInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
    
    if (accountInput.value.trim().length >= 10) {
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
  holderInput.addEventListener('input', () => { // Removed optional chaining as holderInput is now checked
    const holderError = document.getElementById('holder-error'); // Retrieve holderError locally
    if (holderError) holderError.textContent = '';
  });
}

// === 인증 상태 변경 감지 ===
onAuthStateChanged(getAuth(), async (user) => {
  if (user) {
    // 로그인된 상태: 계좌 정보 가져오기
    await fetchAccountData(user.uid); // Ensure account data is fetched first
    
    // 대시보드 데이터 가져오기 및 업데이트
    const dashboardData = await fetchDashboardData(user.uid);
    updateDashboardUI(dashboardData);

    // 채널 정보 실시간 모니터링 시작
    setupChannelMonitoring(user.uid);
  } else {
    // 로그아웃된 상태: UI 초기화
    showNoAccountInfo();
    stopChannelMonitoring();
    
    // 로그아웃 상태에서도 대시보드 표시 (빈 데이터로)
    const emptyDashboardData = {
      totalRevenue: 0,
      totalRevenueChange: 0,
      currentBalance: 0,
      nextPayout: '-',
      monthlyEarnings: [0, 0, 0, 0, 0, 0],
      earningsLabels: ['6월', '7월', '8월', '9월', '10월', '11월'],
      sourceBreakdownMap: new Map(), // Map 객체로 수정
      payoutHistory: [],
      latestTrackTitle: '-',
      latestTrackArtist: '-',
      lastUpdatedAt: '-',
      bank: '-',
      account: '-',
      holder: '-'
    };
    updateDashboardUI(emptyDashboardData);
  }
});

// === 대시보드 초기화 ===
function initializeDashboard() {
  console.log('[initializeDashboard] 대시보드 초기화 시작');
  
  // 데이터가 없을 때 기본값 0으로 표시하는 대시보드 데이터
  const emptyDashboardData = {
    totalRevenue: 0,
    totalRevenueChange: 0,
    currentBalance: 0,
    nextPayout: '-',
    monthlyEarnings: [0, 0, 0, 0, 0, 0],
    earningsLabels: ['6월', '7월', '8월', '9월', '10월', '11월'],
    sourceBreakdownMap: new Map(), // Map 객체로 수정
    payoutHistory: [],
    latestTrackTitle: '-',
    latestTrackArtist: '-',
    lastUpdatedAt: '-',
    bank: '-',
    account: '-',
    holder: '-'
  };
  
  // 대시보드 섹션 표시
  const dashboardSection = document.querySelector('.dashboard-section');
  console.log('[initializeDashboard] dashboardSection 요소 검색 결과:', dashboardSection);
  if (dashboardSection) {
    dashboardSection.style.display = 'block';
    console.log('[initializeDashboard] 대시보드 섹션 표시됨');
  } else {
    console.error('[initializeDashboard] 대시보드 섹션을 찾을 수 없습니다');
  }
  
  // DOM 요소 검색
  getDashboardElements();
  
  // 대시보드 UI 업데이트
  updateDashboardUI(emptyDashboardData);
  
  console.log('[initializeDashboard] 대시보드 초기화 완료');
}

// === 이벤트 리스너 설정 ===
function initializePage() {
  console.log('[initializePage] 페이지 초기화 시작');
  
  // 페이지 애니메이션 초기화
  initPageAnimations();

  // 대시보드 초기화
  initializeDashboard();

  // 계좌번호 재확인 기능 설정
  setupAccountConfirmation();

  // DOM 요소 바인딩
  showFormBtn = document.getElementById('show-form-btn');
  formWrapper = document.getElementById('withdraw-form-wrapper');
  withdrawForm = document.getElementById('withdraw-form');

  console.log('[initializePage] DOM 요소 확인:', {
    showFormBtn: !!showFormBtn,
    formWrapper: !!formWrapper,
    withdrawForm: !!withdrawForm
  });

  // 폼 표시/숨김 버튼
  if (showFormBtn) {
    console.log('[initializePage] 계좌등록 버튼에 이벤트 리스너 추가');
    showFormBtn.addEventListener('click', toggleForm);
  } else {
    console.error('[initializePage] show-form-btn 요소를 찾을 수 없습니다');
  }

  // 폼 제출 처리
  if (withdrawForm) {
    console.log('[initializePage] 폼에 submit 이벤트 리스너 추가');
    withdrawForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!validateForm()) {
        showToast('입력 정보를 확인해주세요.', 'error');
        return;
      }

      const formData = new FormData(withdrawForm);
      const accountData = {
        bank: formData.get('bank'),
        account: formData.get('account'),
        holder: formData.get('holder')
      };

      try {
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (!user) {
          showToast('로그인이 필요합니다.', 'error');
          return;
        }
    
        const success = await saveAccountData(user.uid, accountData);
      
        if (success) {
          showToast('계좌 정보가 성공적으로 저장되었습니다.', 'success');
          await fetchAccountData(user.uid);
          toggleForm(); // 폼 숨기기
        } else {
          showToast('계좌 정보 저장에 실패했습니다.', 'error');
        }
      } catch (error) {
        console.error('계좌 저장 오류:', error);
        showToast('계좌 정보 저장 중 오류가 발생했습니다.', 'error');
      }
    });
  } else {
    console.error('[initializePage] withdraw-form 요소를 찾을 수 없습니다');
  }
  
  console.log('[initializePage] 페이지 초기화 완료');
}

// DOMContentLoaded 또는 이미 로드된 경우 즉시 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  // DOM이 이미 준비된 경우 (모듈 스크립트는 defer처럼 동작)
  initializePage();
}

// === 폼 표시/숨김 토글 ===
function toggleForm() {
  console.log('[toggleForm] 함수 호출됨');
  
  const localFormWrapper = document.getElementById('withdraw-form-wrapper');
  const localShowFormBtn = document.getElementById('show-form-btn');
  
  console.log('[toggleForm] 요소 검색 결과:', {
    localFormWrapper: !!localFormWrapper,
    localShowFormBtn: !!localShowFormBtn
  });
  
  if (!localFormWrapper || !localShowFormBtn) {
    console.error('[toggleForm] 요소를 찾을 수 없습니다');
    return;
  }

  const isVisible = localFormWrapper.style.display !== 'none';
  console.log('[toggleForm] 현재 상태 - isVisible:', isVisible, 'display:', localFormWrapper.style.display);

  if (isVisible) {
    localFormWrapper.style.display = 'none';
    localShowFormBtn.textContent = '계좌 등록하기';
    localShowFormBtn.classList.remove('active');
    console.log('[toggleForm] 폼 숨김 완료');
  } else {
    localFormWrapper.style.display = 'block';
    localShowFormBtn.textContent = '폼 숨기기';
    localShowFormBtn.classList.add('active');
    console.log('[toggleForm] 폼 표시 완료');
  }
}