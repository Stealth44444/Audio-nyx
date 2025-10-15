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
const showFormBtn = document.getElementById('show-form-btn');
const formWrapper = document.getElementById('withdraw-form-wrapper');
const withdrawForm = document.getElementById('withdraw-form');
const channelStatusNotice = document.querySelector('.channel-status-notice');

// === 폼 표시/숨김 토글 ===
function toggleForm() {
  if (!formWrapper || !showFormBtn) return;
  
  const isVisible = formWrapper.style.display !== 'none';
  
  if (isVisible) {
    formWrapper.style.display = 'none';
    showFormBtn.textContent = '계좌 등록하기';
    showFormBtn.classList.remove('active');
  } else {
    formWrapper.style.display = 'block';
    showFormBtn.textContent = '폼 숨기기';
    showFormBtn.classList.add('active');
  }
}

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

// === Dashboard UI Elements ===
let totalRevenueAmount, totalRevenueChange, currentBalanceAmount, nextPayoutDate, payoutHistoryList, latestTrackTitleEl, latestTrackArtistEl;

// DOM 요소 참조 함수
function getDashboardElements() {
    totalRevenueAmount = document.querySelector('.card-total-revenue .revenue-amount');
    totalRevenueChange = document.querySelector('.card-total-revenue .revenue-change');
    currentBalanceAmount = document.querySelector('.card-current-balance .balance-amount');
    nextPayoutDate = document.querySelector('.card-next-payout .payout-date');
    payoutHistoryList = document.querySelector('.card-payout-history .history-list');
    latestTrackTitleEl = document.getElementById('latest-track-title');
    latestTrackArtistEl = document.getElementById('latest-track-artist');
    
    console.log('[getDashboardElements] DOM 요소 검색 결과:', {
        totalRevenueAmount: !!totalRevenueAmount,
        totalRevenueChange: !!totalRevenueChange,
        currentBalanceAmount: !!currentBalanceAmount,
        nextPayoutDate: !!nextPayoutDate,
        payoutHistoryList: !!payoutHistoryList,
        latestTrackTitleEl: !!latestTrackTitleEl,
        latestTrackArtistEl: !!latestTrackArtistEl
    });
}

function updateDashboardUI(dashboardData) {
    console.log('[updateDashboardUI] 대시보드 UI 업데이트 시작', dashboardData);
    
    // DOM 요소 다시 검색
    getDashboardElements();
    
    // DOM 요소 확인
    console.log('[updateDashboardUI] DOM 요소 상태:', {
        totalRevenueAmount: !!totalRevenueAmount,
        currentBalanceAmount: !!currentBalanceAmount,
        nextPayoutDate: !!nextPayoutDate,
        payoutHistoryList: !!payoutHistoryList,
        latestTrackTitleEl: !!latestTrackTitleEl,
        latestTrackArtistEl: !!latestTrackArtistEl
    });
    
    if (totalRevenueAmount) {
        totalRevenueAmount.textContent = `₩${dashboardData.totalRevenue.toLocaleString()}`;
        console.log('[updateDashboardUI] 총 수익 업데이트:', totalRevenueAmount.textContent);
    }
    
    if (totalRevenueChange) {
        totalRevenueChange.textContent = `${dashboardData.totalRevenueChange >= 0 ? '+' : ''}${dashboardData.totalRevenueChange}%`;
        totalRevenueChange.style.color = dashboardData.totalRevenueChange >= 0 ? '#22c55e' : '#ef4444';
    }
    
    if (currentBalanceAmount) {
        currentBalanceAmount.textContent = `₩${dashboardData.currentBalance.toLocaleString()}`;
        console.log('[updateDashboardUI] 현재 잔액 업데이트:', currentBalanceAmount.textContent);
    }
    
    if (nextPayoutDate) {
        nextPayoutDate.textContent = dashboardData.nextPayout;
        console.log('[updateDashboardUI] 다음 정산일 업데이트:', nextPayoutDate.textContent);
    }

    if (payoutHistoryList) {
        if (dashboardData.payoutHistory && dashboardData.payoutHistory.length > 0) {
        payoutHistoryList.innerHTML = dashboardData.payoutHistory.map(item => `
            <li><span>${item.date}</span><span>₩${item.amount.toLocaleString()}</span><span class="status-${item.status === '완료' ? 'completed' : 'pending'}">${item.status}</span></li>
        `).join('');
        } else {
            payoutHistoryList.innerHTML = '<li style="text-align: center; color: #64748b; padding: 20px;">정산 내역이 없습니다</li>';
        }
        console.log('[updateDashboardUI] 정산 내역 업데이트 완료');
    }

    if (latestTrackTitleEl) {
        latestTrackTitleEl.textContent = dashboardData.latestTrackTitle || '-';
    }
    if (latestTrackArtistEl) {
        latestTrackArtistEl.textContent = dashboardData.latestTrackArtist || '-';
    }

    renderDashboardCharts(dashboardData.monthlyEarnings, dashboardData.earningsLabels, dashboardData.sourceBreakdown, dashboardData.sourceLabels);
    
    console.log('[updateDashboardUI] 대시보드 UI 업데이트 완료');
}

// === Fetch Dashboard Data ===
async function fetchDashboardData(uid) {
    console.log(`[fetchDashboardData] Fetching dashboard data for user: ${uid}`);
    console.log(`[fetchDashboardData] Authenticated user UID: ${getAuth().currentUser?.uid}`);
    
    try {
        // Firestore에서 user_earnings 컬렉션 조회
        const userEarningsRef = doc(db, 'user_earnings', uid);
        const userEarningsSnap = await getDoc(userEarningsRef);
        
        if (userEarningsSnap.exists()) {
            const data = userEarningsSnap.data();
            console.log('[fetchDashboardData] 사용자 수익 데이터 발견:', data);
            
            // 실제 데이터가 있으면 반환
            // 월별 수익 데이터 정렬 및 매핑
            const monthlyEarningsMap = new Map();
            if (data.monthlyEarnings) {
                data.monthlyEarnings.forEach(earning => {
                    monthlyEarningsMap.set(earning.month, earning.amount);
                });
            }
            const currentYear = new Date().getFullYear();
            const chartMonthlyEarnings = [
                `${currentYear}-06`, `${currentYear}-07`, `${currentYear}-08`, `${currentYear}-09`, `${currentYear}-10`, `${currentYear}-11`
            ].map(monthKey => monthlyEarningsMap.get(monthKey) || 0);

            // 수익 소스 데이터 집계 및 매핑
            const sourceBreakdownMap = new Map();
            if (data.monthlyEarnings) {
                data.monthlyEarnings.forEach(earning => {
                    const platform = earning.platform || '기타';
                    const currentAmount = sourceBreakdownMap.get(platform) || 0;
                    sourceBreakdownMap.set(platform, currentAmount + earning.amount);
                });
            }
            const chartSourceBreakdown = [
                sourceBreakdownMap.get('YouTube') || 0,
                sourceBreakdownMap.get('Spotify') || 0,
                sourceBreakdownMap.get('Apple Music') || 0,
                sourceBreakdownMap.get('기타') || 0,
                sourceBreakdownMap.get('직접 판매') || 0
            ];

            // 최근 수익 발생 음원 정보 가져오기
            let latestTrackTitle = '-';
            let latestTrackArtist = '-';
            if (data.monthlyEarnings && data.monthlyEarnings.length > 0) {
                // 가장 최근에 추가된 수익 기록 (admin.js에서 월별로 집계되므로, 여기서는 단순히 첫 번째 항목 사용)
                const latestEarningRecord = data.monthlyEarnings[0]; // 첫 번째 수익 기록 사용
                console.log('[fetchDashboardData] latestEarningRecord:', latestEarningRecord);
                if (latestEarningRecord) {
                    latestTrackArtist = latestEarningRecord.artist || '-';
                    console.log('[fetchDashboardData] latestTrackArtist:', latestTrackArtist);
                    // ISRC를 사용하여 track_requests에서 트랙 제목 조회
                    if (latestEarningRecord.isrc) {
                        console.log('[fetchDashboardData] Searching for ISRC in track_requests:', latestEarningRecord.isrc);
                        const q = query(collection(db, 'track_requests'), where('ISRC', '==', latestEarningRecord.isrc));
                        const querySnapshot = await getDocs(q);
                        if (!querySnapshot.empty) {
                            const trackRequestData = querySnapshot.docs[0].data();
                            latestTrackTitle = trackRequestData.request || trackRequestData.description || '-'; // 요청 내용 또는 설명 사용
                            console.log('[fetchDashboardData] Found in track_requests, title:', latestTrackTitle);
                        } else {
                            console.log('[fetchDashboardData] Not found in track_requests, searching in track_new:', latestEarningRecord.isrc);
                            // track_new 컬렉션에서도 찾아볼 수 있음 (ISRC 필드가 있다면)
                            const q2 = query(collection(db, 'track_new'), where('ISRC', '==', latestEarningRecord.isrc));
                            const querySnapshot2 = await getDocs(q2);
                            if (!querySnapshot2.empty) {
                                const trackNewData = querySnapshot2.docs[0].data();
                                latestTrackTitle = trackNewData['Track Title'] || trackNewData.title || trackNewData.name || '-';
                                console.log('[fetchDashboardData] Found in track_new, title:', latestTrackTitle);
                            } else {
                                console.log('[fetchDashboardData] Not found in track_new either.');
                            }
                        }
                    }
                }
            }

            return {
                totalRevenue: data.totalEarnings || 0,
                totalRevenueChange: data.totalRevenueChange || 0,
                currentBalance: data.currentBalance || 0,
                nextPayout: data.nextPayout || '-',
                monthlyEarnings: chartMonthlyEarnings,
                earningsLabels: ['6월', '7월', '8월', '9월', '10월', '11월'],
                sourceBreakdown: chartSourceBreakdown,
                sourceLabels: ['YouTube', 'Spotify', 'Apple Music', '기타', '직접 판매'],
                payoutHistory: data.payoutHistory || [],
                latestTrackTitle: latestTrackTitle,
                latestTrackArtist: latestTrackArtist
            };
  } else {
            console.log('[fetchDashboardData] 사용자 수익 데이터 없음 - 빈 데이터 반환');
            // 데이터가 없으면 빈 데이터 반환
            return {
        totalRevenue: 0,
        totalRevenueChange: 0,
        currentBalance: 0,
        nextPayout: '-',
                monthlyEarnings: [0, 0, 0, 0, 0, 0],
                earningsLabels: ['6월', '7월', '8월', '9월', '10월', '11월'],
                sourceBreakdown: [0, 0, 0, 0, 0],
                sourceLabels: ['YouTube', 'Spotify', 'Apple Music', '기타', '직접 판매'],
        payoutHistory: []
            };
      }
    } catch (error) {
        console.error('[fetchDashboardData] 데이터 조회 오류:', error);
        console.error('[fetchDashboardData] 오류 코드:', error.code);
        console.error('[fetchDashboardData] 오류 메시지:', error.message);
        // 오류 발생 시에도 빈 데이터 반환
    return {
        totalRevenue: 0,
        totalRevenueChange: 0,
        currentBalance: 0,
        nextPayout: '-',
            monthlyEarnings: [0, 0, 0, 0, 0, 0],
            earningsLabels: ['6월', '7월', '8월', '9월', '10월', '11월'],
            sourceBreakdown: [0, 0, 0, 0, 0],
            sourceLabels: ['YouTube', 'Spotify', 'Apple Music', '기타', '직접 판매'],
        payoutHistory: []
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
      sourceBreakdown: [0, 0, 0, 0, 0],
      sourceLabels: ['YouTube', 'Spotify', 'Apple Music', '기타', '직접 판매'],
        payoutHistory: []
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
    sourceBreakdown: [0, 0, 0, 0, 0],
    sourceLabels: ['YouTube', 'Spotify', 'Apple Music', '기타', '직접 판매'],
        payoutHistory: []
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
document.addEventListener('DOMContentLoaded', () => {
  console.log('[DOMContentLoaded] 이벤트 발생');
  // 페이지 애니메이션 초기화
  initPageAnimations();

  // 대시보드 초기화
  initializeDashboard();

  // 계좌번호 재확인 기능 설정
  setupAccountConfirmation();

  // 폼 표시/숨김 버튼
    if (showFormBtn) {
    showFormBtn.addEventListener('click', toggleForm);
  }

  // 폼 제출 처리
  if (withdrawForm) {
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
  }
});