// 채널 관리 페이지 JavaScript
import { 
  collection, 
  addDoc, 
  getDoc,
  setDoc,
  serverTimestamp, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  deleteDoc,
  doc,
  where,
  getDocs 
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js';

import { db, app } from './firebase.js';

// 현재 사용자 정보를 저장할 변수
let currentUser = null;
let channelUnsubscribe = null; // 채널 리스너 해제 함수
let channelsData = []; // 채널 데이터 저장 변수

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
  console.log('채널 관리 페이지 초기화 중...');
  
  // Firebase 인증 초기화
  const auth = getAuth(app);
  
  // 사용자 가이드 섹션 초기화
  initializeUserGuide();
  
  // 컨텐츠 링크 초기화
  initializeContentLinks();
  
  // 복사 버튼 이벤트 핸들러 초기화
  function initializeCopyButtons() {
    // 채널 카드와 테이블을 대상으로 하는 이벤트 위임
    const channelContainer = document.querySelector('.channel-list-container');
    if (channelContainer) {
      channelContainer.addEventListener('click', (e) => {
        if (e.target.closest('.btn-copy-key')) {
          e.preventDefault();
          e.stopPropagation();
          
          const button = e.target.closest('.btn-copy-key');
          const keyValue = button.closest('.channel-key-display')?.querySelector('.channel-key-value')?.textContent ||
                         button.closest('tr')?.querySelector('.channel-key')?.textContent;
          
          if (!keyValue) {
            console.warn('복사할 키 값을 찾을 수 없습니다.');
            return;
          }
          
          handleCopyButtonClick(button, keyValue);
        }
      });
    }
    
    // 모달 내 발급된 키 복사 버튼 처리
    const modal = document.getElementById('channel-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target.closest('.btn-copy-issued-key')) {
          e.preventDefault();
          e.stopPropagation();
          
          const button = e.target.closest('.btn-copy-issued-key');
          const keyValue = document.getElementById('issued-key')?.textContent;
          
          if (!keyValue) {
            console.warn('복사할 키 값을 찾을 수 없습니다.');
            return;
          }
          
          handleCopyButtonClick(button, keyValue);
        }
      });
    }
  }
  
  // 복사 버튼 클릭 처리 함수
  function handleCopyButtonClick(button, keyValue) {
    const originalContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
    
    copyToClipboard(keyValue)
      .then(() => {
        button.style.background = 'rgba(40, 167, 69, 0.2)';
        button.style.borderColor = 'rgba(40, 167, 69, 0.4)';
        setTimeout(() => {
          button.innerHTML = originalContent;
          button.style.background = '';
          button.style.borderColor = '';
          button.disabled = false;
        }, 1500);
      })
      .catch(() => {
        button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
        button.style.background = 'rgba(220, 53, 69, 0.2)';
        button.style.borderColor = 'rgba(220, 53, 69, 0.4)';
        setTimeout(() => {
          button.innerHTML = originalContent;
          button.style.background = '';
          button.style.borderColor = '';
          button.disabled = false;
        }, 1500);
      });
  }
  
  // DOM 요소
  const registerBtn = document.getElementById('register-channel-btn');
  const modal = document.getElementById('channel-modal');
  const modalContent = modal.querySelector('.modal-content');
  const closeModalBtn = document.getElementById('close-modal');
  const cancelBtn = document.getElementById('cancel-registration');
  const channelForm = document.getElementById('channel-form');
  const urlInput = document.getElementById('channel-url');
  const urlError = document.getElementById('url-error');
  const channelList = document.getElementById('channel-list');
  const loadingEl = document.getElementById('channel-loading');
  const noChannelsEl = document.getElementById('no-channels');
  const urlLabel = document.getElementById('url-label');
  const helpText = document.getElementById('help-text');
  const keyHelpText = document.getElementById('key-help-text');
  
  // Firebase 초기화 확인
  if (!db) {
    console.error('Firebase DB가 초기화되지 않았습니다.');
    showNotification('데이터베이스 연결에 문제가 있습니다. 페이지를 새로고침하거나 나중에 다시 시도해주세요.');
    return;
  }
  
  // 플랫폼 선택기 이벤트 핸들러
  let selectedPlatform = 'youtube'; // 기본값
  
  // 플랫폼 선택기만 대상으로 하는 이벤트 리스너
  function initializePlatformSelector() {
    const platformSelector = document.querySelector('.platform-selector');
    if (platformSelector) {
      // 초기 상태 설정 (YouTube 기본 선택)
      const youtubeOption = platformSelector.querySelector('[data-platform="youtube"]');
      if (youtubeOption) {
        youtubeOption.classList.add('active');
      }
      
      platformSelector.addEventListener('click', (e) => {
        const option = e.target.closest('.platform-option');
        if (option) {
          e.preventDefault();
          e.stopPropagation();
          
          const platform = option.dataset.platform;
          
          console.log('플랫폼 선택됨:', platform);
          
          // 기존 active 클래스 제거
          document.querySelectorAll('.platform-option').forEach(opt => opt.classList.remove('active'));
          
          // 새로운 플랫폼 선택
          option.classList.add('active');
          selectedPlatform = platform;
          
          // UI 업데이트
          updatePlatformUI(platform);
        }
      });
    }
  }
  
  // 플랫폼별 UI 업데이트 함수
  function updatePlatformUI(platform) {
    const platformConfigs = {
      youtube: {
        label: 'YouTube 채널 URL',
        placeholder: 'https://www.youtube.com/@핸들명 또는 https://www.youtube.com/channel/UC...',
        helpText: (window.i18next && window.i18next.t('channelManagement.modal.helpText')) || 'YouTube 채널 URL 또는 @핸들을 입력하세요. 예: https://www.youtube.com/@Audionyx-o7b..., https://www.youtube.com/channel/UCKyR5HM..., https://www.youtube.com/@%EC%88%8F%EB%8D...',
        keyHelp: 'YouTube 채널 설명란에 위 키를 붙여넣으세요'
      },
      tiktok: {
        label: 'TikTok 프로필 URL',
        placeholder: 'https://www.tiktok.com/@사용자명',
        helpText: 'TikTok 프로필 URL을 입력하세요 (예: @username)',
        keyHelp: 'TikTok 프로필 소개란에 위 키를 붙여넣으세요'
      },
      instagram: {
        label: 'Instagram 프로필 URL',
        placeholder: 'https://www.instagram.com/사용자명',
        helpText: 'Instagram 프로필 URL을 입력하세요',
        keyHelp: 'Instagram 프로필 소개란에 위 키를 붙여넣으세요'
      }
    };
    
    const config = platformConfigs[platform];
    if (urlLabel) urlLabel.textContent = config.label;
    if (urlInput) urlInput.placeholder = config.placeholder;
    if (helpText) {
      // i18n 동기화: data-i18n 바인딩 요소와 동일한 키로부터 값 가져오기
      const localized = (window.i18next && window.i18next.t('channelManagement.modal.helpText')) || config.helpText;
      helpText.textContent = localized;
    }
    if (keyHelpText) keyHelpText.textContent = config.keyHelp;
    
    // URL 입력값 초기화
    if (urlInput) urlInput.value = '';
    if (urlError) urlError.style.display = 'none';
  }

  // 플랫폼 선택기 초기화
  initializePlatformSelector();
  
  // 복사 버튼 초기화
  initializeCopyButtons();
  
  // 컨텐츠 링크 초기화
  initializeContentLinks();
  
  // 입력 필드 활성화 보장
  function ensureInputFieldEnabled() {
    if (urlInput) {
      urlInput.disabled = false;
      urlInput.readonly = false;
      urlInput.removeAttribute('disabled');
      urlInput.removeAttribute('readonly');
      urlInput.style.pointerEvents = 'auto';
      console.log('입력 필드 활성화 확인됨');
    }
  }
  
  // 초기 실행
  ensureInputFieldEnabled();
  // URL 파라미터로 모달 자동 오픈 처리 (회원가입 직후 유도)
  try {
    const params = new URLSearchParams(window.location.search);
    // 테이블 스크롤 유도 파라미터
    if (params.get('scrollTo') === 'channelTable') {
      setTimeout(() => {
        const section = document.querySelector('.channel-list-section') || document.getElementById('channel-list');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  } catch (_) {}
  
  // 모달이 열릴 때마다 확인
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        if (modal.style.display === 'flex') {
          setTimeout(() => ensureInputFieldEnabled(), 50);
        }
      }
    });
  });
  
  if (modal) {
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
  }

  // 인증 상태 감시 및 채널 목록 로딩
  onAuthStateChanged(auth, (user) => {
    console.log('인증 상태 변경:', user ? user.uid : '로그아웃');
    
    // 기존 리스너 해제
    if (channelUnsubscribe) {
      channelUnsubscribe();
      channelUnsubscribe = null;
    }
    
    if (user) {
      currentUser = user;
      console.log('로그인된 사용자:', user.uid);
      // URL 파라미터에 따라 최초 진입 시 테이블로 스크롤
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('scrollTo') === 'channelTable') {
          setTimeout(() => {
            const section = document.querySelector('.channel-list-section') || document.getElementById('channel-list');
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 300);
        }
      } catch (_) {}
      
      // 채널 목록 실시간 업데이트 설정
      setupChannelListener();
      
      // 컨텐츠 링크 로드
      loadContentLinks();
    } else {
      currentUser = null;
      console.log('로그인되지 않은 상태');
      
      // 로딩 숨기기
      if (loadingEl) {
        loadingEl.style.display = 'none';
      }
      
      // 채널 목록 초기화
      if (channelList) {
        channelList.innerHTML = '';
      }
      const channelCardsGrid = document.getElementById('channel-cards-grid');
      if (channelCardsGrid) {
        channelCardsGrid.innerHTML = '';
      }
      
      // 빈 상태 표시
      if (noChannelsEl) {
        noChannelsEl.style.display = 'flex';
      }
      
      // 컨텐츠 링크 테이블 초기화
      const tableBody = document.getElementById('content-links-list');
      const noLinksEl = document.getElementById('no-content-links');
      const tableWrapper = document.querySelector('.content-table-wrapper');
      
      if (tableBody) {
        tableBody.innerHTML = '';
      }
      if (tableWrapper) {
        tableWrapper.style.display = 'none';
      }
      if (noLinksEl) {
        noLinksEl.style.display = 'block';
      }
    }
  });
  
  // 채널 등록 버튼 클릭 - 모달 표시
  registerBtn.addEventListener('click', () => {
    console.log('채널 등록 버튼 클릭됨');
    if (!currentUser) {
      showNotification('채널 등록을 위해 로그인이 필요합니다.');
      return;
    }
    openModal();
  });
  
  // 모달 닫기 버튼들
  closeModalBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  
  // 모달 외부 클릭 시 닫기 (backdrop만)
  modal.addEventListener('click', (e) => {
    // modal-content 외부를 클릭했을 때만 닫기
    if (!modalContent.contains(e.target)) {
      closeModal();
    }
  });
  
  // modal-content 내부 클릭은 이벤트 전파 차단
  modalContent.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // ESC 키 누를 때 모달 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      closeModal();
    }
  });
  
  // 폼 제출 처리
  channelForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('채널 폼 제출됨');
    
    const url = urlInput.value.trim();
    
    // 입력 검증
    if (!url) {
      showError('채널 URL을 입력해주세요.');
      return;
    }
    
    // URL 형식 검증 (플랫폼별)
    if (!isValidChannelUrl(url, selectedPlatform)) {
      const platformNames = {
        youtube: 'YouTube',
        tiktok: 'TikTok',
        instagram: 'Instagram'
      };
      showError(`유효한 ${platformNames[selectedPlatform]} 채널 URL을 입력해주세요.`);
      return;
    }
    
        // 상세한 로그인 상태 확인
    if (!currentUser) {
      console.error('사용자 인증 실패 - currentUser가 null입니다.');
      showError('채널 등록을 위해 로그인이 필요합니다.');
      return;
    }

    // 추가 인증 상태 확인
    if (!currentUser.uid) {
      console.error('사용자 UID가 없습니다:', currentUser);
      showError('인증 상태에 문제가 있습니다. 다시 로그인해주세요.');
      return;
    }

    console.log('인증된 사용자 UID:', currentUser.uid);
    console.log('사용자 이메일:', currentUser.email);
    
    // 토큰 검증 수행
    try {
      console.log('토큰 검증 중...');
      const token = await currentUser.getIdToken(true); // 토큰 강제 갱신
      console.log('토큰 갱신 성공');
    } catch (tokenError) {
      console.error('토큰 갱신 실패:', tokenError);
      showError('인증 토큰에 문제가 있습니다. 다시 로그인해주세요.');
      return;
    }

    try {
      // 로딩 상태 표시
      const submitBtn = document.getElementById('submit-channel');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading-spinner"></span> 처리 중...';
      
      // Firebase 연결 상태 확인
      if (!db) {
        console.error('Firestore 데이터베이스 인스턴스가 없습니다.');
        showError('데이터베이스 연결에 문제가 있습니다.');
        submitBtn.disabled = false;
        submitBtn.textContent = '등록하기';
        return;
      }
      
      // 중복 검사 수행
      console.log('채널 URL 중복 검사 중...', selectedPlatform, url);
      const isDuplicate = await checkDuplicateChannel(url, selectedPlatform);
      if (isDuplicate.exists) {
        showError(isDuplicate.message);
        
        // 버튼 상태 복구
        submitBtn.disabled = false;
        submitBtn.textContent = '등록하기';
        return;
      }
      
      console.log('Firestore에 채널 데이터 추가 시도...');
      
      // 임의의 이모지 키 생성 (실제로는 서버에서 받아야 함)
      const emojiKey = generateEmojiKey();
      
      // 플랫폼별 URL 정규화
      const normalizedUrl = normalizeUrl(url, selectedPlatform);
      
      console.log('선택된 플랫폼:', selectedPlatform);
      console.log('원본 URL:', url);
      console.log('정규화된 URL:', normalizedUrl);
      console.log('저장할 데이터:', {
        url: normalizedUrl,
        originalUrl: url,
        platform: selectedPlatform,
        key: emojiKey,
        status: '검사중',
        uid: currentUser.uid
      });
      
      // 유저 정보 수집
      const userInfo = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName || '익명 사용자',
        photoURL: currentUser.photoURL || null
      };
      
      console.log('수집된 유저 정보:', userInfo);
      
      // 새로운 채널 객체 생성 (serverTimestamp는 배열 내부에서 사용 불가)
      const newChannel = {
        url: normalizedUrl, // 정규화된 URL 저장 (중복 검사용)
        originalUrl: url, // 원본 URL 저장 (표시용)
        platform: selectedPlatform, // 플랫폼 정보 추가
        key: emojiKey,
        status: '검사중', // 초기 상태: 검사중
        createdAt: new Date() // 클라이언트 타임스탬프 사용
      };
      
      console.log('새로운 채널 데이터:', newChannel);
      
      // 유저별 채널 문서 참조
      const userChannelDocRef = doc(db, 'channels', currentUser.uid);
      
      // Firestore에 채널 추가 - 더 구체적인 오류 처리
      try {
        // 기존 문서가 있는지 확인
        const userChannelDoc = await getDoc(userChannelDocRef);
        
        if (userChannelDoc.exists()) {
          // 기존 문서에 채널 추가
          const existingData = userChannelDoc.data();
          const existingChannels = existingData.channels || [];
          
          console.log('기존 채널 수:', existingChannels.length);
          
          // 새 채널을 기존 배열에 추가
          const updatedChannels = [...existingChannels, newChannel];
          
          await updateDoc(userChannelDocRef, {
            channels: updatedChannels,
            userInfo: userInfo, // 유저 정보 업데이트
            updatedAt: serverTimestamp()
          });
          
          console.log('기존 문서에 채널 추가 성공!');
        } else {
          // 새 문서 생성
          await setDoc(userChannelDocRef, {
            userInfo: userInfo,
            channels: [newChannel],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          console.log('새 유저 채널 문서 생성 성공!');
        }
        
        console.log('Firestore 저장 성공! 사용자 ID:', currentUser.uid);
        
        // 발급된 키 표시
        document.getElementById('issued-key-container').style.display = 'block';
        document.getElementById('issued-key').textContent = emojiKey;
        
        console.log('채널 추가 성공! 문서 ID:', currentUser.uid);
        
        // 등록 확인 후 모달 닫기
        setTimeout(() => {
        closeModal();
        }, 2000);
        
        // 채널 미등록 배너가 떠있다면 제거
        try {
          const banner = document.querySelector('.post-signup-banner');
          if (banner) banner.remove();
        } catch (_) {}
        
        // 서버 API 호출 (Cloud Function)
        try {
          console.log('서버 API 호출 시도...');
          const response = await fetch('/api/registerChannel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              userId: currentUser.uid,
              userInfo: userInfo,
              channel: newChannel,
              url: url,
              platform: selectedPlatform,
              normalizedUrl: normalizedUrl
            }),
          });
          
          if (response.ok) {
            console.log('API 호출 성공');
          } else {
            console.warn('API 응답이 성공적이지 않음:', response.status);
            // API 응답 실패는 사용자에게 알림
            showNotification('채널이 등록되었으나, 서버 동기화에 문제가 있을 수 있습니다.');
          }
        } catch (apiError) {
          console.error('채널 등록 API 호출 중 오류:', apiError);
          // API 오류는 사용자에게 알림
          showNotification('채널이 등록되었으나, 서버 동기화 중 문제가 발생했습니다.');
        }
        
        // 성공 메시지 표시
        showNotification('채널이 성공적으로 등록되었습니다. 검증 진행 후 사용 가능합니다.');
        
      } catch (firestoreError) {
        console.error('Firestore 저장 실패:', firestoreError);
        console.error('오류 코드:', firestoreError.code);
        console.error('오류 메시지:', firestoreError.message);
        
        if (firestoreError.code === 'permission-denied') {
          showError('데이터베이스 권한이 없습니다. 관리자에게 문의하세요.');
        } else if (firestoreError.code === 'unauthenticated') {
          showError('인증이 필요합니다. 다시 로그인해주세요.');
        } else {
          showError(`데이터베이스 오류: ${firestoreError.message}`);
        }
        
        // 버튼 상태 복구
        submitBtn.disabled = false;
        submitBtn.textContent = '등록하기';
        return;
      }
      
    } catch (error) {
      console.error('채널 등록 중 오류 발생:', error);
      showError('채널 등록 중 오류가 발생했습니다. 다시 시도해주세요.');
      
      // 버튼 상태 복구
      const submitBtn = document.getElementById('submit-channel');
      submitBtn.disabled = false;
      submitBtn.textContent = '등록하기';
    }
  });
  
  // 애니메이션 초기화
  initializeAnimations();
  
  // 첫 채널 등록 버튼 이벤트 (빈 상태에서)
  const registerFirstChannelBtn = document.getElementById('register-first-channel');
  if (registerFirstChannelBtn) {
    registerFirstChannelBtn.addEventListener('click', () => {
      if (!currentUser) {
        showNotification('채널 등록을 위해 로그인이 필요합니다.');
        return;
      }
      openModal();
    });
  }
  
  // Firestore 채널 목록 실시간 리스너 설정 - 새로운 구조에 맞게 수정
  function setupChannelListener() {
    console.log('채널 목록 리스너 설정 중...');
    
    if (!currentUser) {
      console.log('사용자가 로그인하지 않음, 리스너 설정 건너뜀');
      return;
    }
    
    try {
      // 현재 사용자의 채널 문서를 실시간으로 감시
      const userChannelDocRef = doc(db, 'channels', currentUser.uid);
      
      // 실시간 리스너 설정
      channelUnsubscribe = onSnapshot(userChannelDocRef, (docSnapshot) => {
        let channels = [];
        
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          const userChannels = userData.channels || [];
          
          console.log('채널 목록 업데이트됨, 채널 수:', userChannels.length);
          console.log('유저 정보:', userData.userInfo);
          
          // 각 채널에 ID와 유저 정보 추가하고 Document 형태로 변환
          channels = userChannels.map((channel, index) => ({
            id: `${currentUser.uid}_${index}`, // 임시 ID 생성
            data: () => ({
              ...channel,
              userInfo: userData.userInfo // 유저 정보 포함
            })
          }));
          
          // createdAt으로 정렬 (최신순) - Date 객체와 Timestamp 모두 지원
          channels.sort((a, b) => {
            const aTime = a.data().createdAt;
            const bTime = b.data().createdAt;
            
            // createdAt이 없는 경우 처리
            if (!aTime && !bTime) return 0;
            if (!aTime) return 1;
            if (!bTime) return -1;
            
            let aTimeValue, bTimeValue;
            
            // Firestore Timestamp 객체인 경우
            if (aTime.toDate && bTime.toDate) {
              aTimeValue = aTime.toDate().getTime();
              bTimeValue = bTime.toDate().getTime();
            }
            // Date 객체인 경우
            else if (aTime instanceof Date && bTime instanceof Date) {
              aTimeValue = aTime.getTime();
              bTimeValue = bTime.getTime();
            }
            // 문자열인 경우
            else if (typeof aTime === 'string' && typeof bTime === 'string') {
              aTimeValue = new Date(aTime).getTime();
              bTimeValue = new Date(bTime).getTime();
            }
            // 타입이 다른 경우 Date로 변환 시도
            else {
              try {
                aTimeValue = aTime.toDate ? aTime.toDate().getTime() : new Date(aTime).getTime();
                bTimeValue = bTime.toDate ? bTime.toDate().getTime() : new Date(bTime).getTime();
              } catch (error) {
                console.warn('날짜 정렬 중 오류:', error);
                return 0;
              }
            }
            
            return bTimeValue - aTimeValue; // 내림차순 (최신순)
          });
        } else {
          console.log('채널 문서가 존재하지 않음');
        }
        
        console.log('현재 사용자의 채널 수:', channels.length);
        
        // channelsData 업데이트 - 컨텐츠 링크 모달에서 사용
        channelsData = channels.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log('channelsData 업데이트됨:', channelsData);
        
        // 로딩 숨기기
        if (loadingEl) {
          loadingEl.style.display = 'none';
        }
        
        if (channels.length === 0) {
          // 채널이 없는 경우
          if (channelList) {
            channelList.innerHTML = '';
          }
          const channelCardsGrid = document.getElementById('channel-cards-grid');
          if (channelCardsGrid) {
            channelCardsGrid.innerHTML = '';
          }
          if (noChannelsEl) {
            noChannelsEl.style.display = 'flex';
          }
        } else {
          // 채널이 있는 경우
          if (noChannelsEl) {
            noChannelsEl.style.display = 'none';
          }
          
          // 테이블 렌더링 (데스크톱)
          renderChannelTable(channels);
          
          // 카드 그리드 렌더링 (모바일)
          renderChannelCards(channels);
        }
      }, (error) => {
        console.error('채널 목록 리스너 오류:', error);
        
        // 로딩 숨기기
        if (loadingEl) {
          loadingEl.style.display = 'none';
        }
        
        showNotification('채널 목록을 불러오는 중 오류가 발생했습니다.');
      });
      
    } catch (error) {
      console.error('채널 리스너 설정 중 오류:', error);
      
      // 로딩 숨기기
      if (loadingEl) {
        loadingEl.style.display = 'none';
      }
      
      showNotification('채널 목록 설정 중 오류가 발생했습니다.');
    }
  }
  
  // 테이블 렌더링 함수
  function renderChannelTable(channels) {
    if (!channelList) return;
    
    channelList.innerHTML = '';
    
    channels.forEach((doc, index) => {
      const data = doc.data();
      const row = document.createElement('tr');
      row.style.setProperty('--row-index', index);
      
      // 표시할 URL 결정 (originalUrl이 있으면 사용, 없으면 url 사용)
      const displayUrl = data.originalUrl || data.url;
      
      row.innerHTML = `
        <td>
          <a href="${displayUrl}" target="_blank" class="channel-url">${displayUrl}</a>
        </td>
        <td class="channel-key-cell">
          <span class="channel-key">${data.key}</span>
          <button class="btn-copy-key" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          </button>
        </td>
        <td class="channel-date">${formatDate(data.createdAt)}</td>
        <td>${renderStatusTag(data.status)}</td>
      `;
      
      // 복사 버튼은 이벤트 위임으로 처리됨
      channelList.appendChild(row);
    });
  }
  
  // 카드 그리드 렌더링 함수
  function renderChannelCards(channels) {
    const channelCardsGrid = document.getElementById('channel-cards-grid');
    if (!channelCardsGrid) return;
    
    channelCardsGrid.innerHTML = '';
    
    channels.forEach((doc, index) => {
      const data = doc.data();
      const card = document.createElement('div');
      card.className = 'channel-card';
      card.style.animationDelay = `${index * 0.1}s`;
      
      const statusClass = getStatusClass(data.status);
      const statusColor = getStatusColor(data.status);
      
      // 표시할 URL 결정 (originalUrl이 있으면 사용, 없으면 url 사용)
      const displayUrl = data.originalUrl || data.url;
      
      card.innerHTML = `
        <div class="channel-card-header">
          <div class="channel-info-section">
            ${renderPlatformIcon(data.platform || 'youtube')}
            <a href="${displayUrl}" target="_blank" class="channel-url-display">${truncateUrl(displayUrl)}</a>
          </div>
          ${renderStatusTag(data.status)}
        </div>
        
        <div class="channel-key-section">
          <div class="channel-key-label">이모지 키</div>
          <div class="channel-key-display">
            <div class="channel-key-value">${data.key}</div>
            <button class="btn-copy-key" type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="channel-date">${formatDate(data.createdAt)}</div>
      `;
      
      // 복사 버튼은 이벤트 위임으로 처리됨
      
      channelCardsGrid.appendChild(card);
    });
  }
  
  // 날짜 포맷팅 함수 개선 - Date 객체와 Firestore Timestamp 모두 지원
  function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    let date;
    if (timestamp.toDate) {
      // Firestore Timestamp
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      // JavaScript Date 객체
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      // 문자열 형태의 날짜
      date = new Date(timestamp);
    } else {
      return 'N/A';
    }
    
    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    
    // YYYY.MM.DD 형식으로 변환
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }
  
  // 헬퍼 함수들
  function getStatusClass(status) {
    switch(status) {
      case '검사중': return 'status-pending';
      case '검사완료': return 'status-verified';
      case '이모지 키 누락': return 'status-missing-emoji';
      case 'Url 재확인': return 'status-recheck-url';
      default: return 'status-pending';
    }
  }
  
  function getStatusColor(status) {
    switch(status) {
      case '검사중': 
        return { bg: 'rgba(255, 193, 7, 0.1)', text: '#ffc107', border: 'rgba(255, 193, 7, 0.2)' };
      case '검사완료': 
        return { bg: 'rgba(40, 167, 69, 0.1)', text: '#28a745', border: 'rgba(40, 167, 69, 0.2)' };
      case '이모지 키 누락': 
        return { bg: 'rgba(13, 110, 253, 0.1)', text: '#0d6efd', border: 'rgba(13, 110, 253, 0.2)' };
      case 'Url 재확인': 
        return { bg: 'rgba(108, 117, 125, 0.1)', text: '#6c757d', border: 'rgba(108, 117, 125, 0.2)' };
      default: 
        return { bg: 'rgba(255, 193, 7, 0.1)', text: '#ffc107', border: 'rgba(255, 193, 7, 0.2)' };
    }
  }
  
  function truncateUrl(url) {
    if (url.length > 40) {
      return url.substring(0, 37) + '...';
    }
    return url;
  }
  
  // 상태 태그 렌더링
  function renderStatusTag(status) {
    let statusKey;
    let statusClass;

    switch (status) {
      case '검사중':
        statusKey = 'channelManagement.status.pending';
        statusClass = 'tag-pending';
        break;
      case '검사완료':
        statusKey = 'channelManagement.status.verified';
        statusClass = 'tag-verified';
        break;
      case '이모지 키 누락':
        statusKey = 'channelManagement.status.missingEmoji';
        statusClass = 'tag-missing-emoji';
        break;
      case 'Url 재확인':
        statusKey = 'channelManagement.status.recheckUrl';
        statusClass = 'tag-recheck-url';
        break;
      default:
        return `<span>${status}</span>`;
    }

    const translatedStatus = window.i18next ? window.i18next.t(statusKey) : status;
    return `<span class="${statusClass}">${translatedStatus}</span>`;
  }
  
  // 플랫폼 아이콘 렌더링
  function renderPlatformIcon(platform) {
    const icons = {
      youtube: `
        <div class="platform-badge youtube">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
          </svg>
          <span>YouTube</span>
        </div>
      `,
      tiktok: `
        <div class="platform-badge tiktok">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.525 9.52c2.25.25 4.105-.17 5.352-1.216v3.822c0 5.013-4.096 9.01-9.01 9.01s-9.01-4.096-9.01-9.01 4.096-9.01 9.01-9.01c.49 0 .968.04 1.433.117v3.77c-.47-.08-.95-.12-1.433-.12-2.763 0-5.01 2.248-5.01 5.01s2.248 5.01 5.01 5.01 5.01-2.248 5.01-5.01v-8.137h3.855c.073 1.905.66 3.695 1.67 5.168-.66-.12-1.347-.19-2.055-.19-.54 0-1.08.04-1.607.12v-3.883c1.07.66 2.33 1.047 3.662 1.047"/>
          </svg>
          <span>TikTok</span>
        </div>
      `,
      instagram: `
        <div class="platform-badge instagram">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
          <span>Instagram</span>
        </div>
      `
    };
    
    return icons[platform] || icons.youtube;
  }
  
  function openModal() {
    console.log('모달 열기');
    // 모달 열릴 때 배너 숨김
    try {
      const banner = document.querySelector('.post-signup-banner');
      if (banner) banner.remove();
    } catch (_) {}
    modal.style.display = 'flex';
    
    // 입력 필드 초기화
    if (urlInput) {
      urlInput.value = '';
      urlInput.disabled = false; // 입력 필드 활성화 확실히 하기
    }
    if (urlError) {
      urlError.textContent = '';
      urlError.style.display = 'none';
    }
    
    // 발급된 키 컨테이너 숨기기
    const issuedKeyContainer = document.getElementById('issued-key-container');
    if (issuedKeyContainer) {
      issuedKeyContainer.style.display = 'none';
    }

    // 모달 내용 애니메이션 초기화
    modalContent.classList.remove('closing');
    
    // 플랫폼 UI를 기본값으로 초기화
    updatePlatformUI(selectedPlatform);
    
    // 포커스를 주기 전에 모달이 표시되도록 약간의 지연 추가
    setTimeout(() => {
      if (urlInput) {
        ensureInputFieldEnabled(); // 입력 필드 활성화 재확인
        urlInput.focus();
      }
    }, 150);
  }
  
  function closeModal() {
    console.log('모달 닫기');
    
    // 닫기 애니메이션 추가
    modalContent.classList.add('closing');
    
    // 애니메이션 완료 후 모달 닫기
    setTimeout(() => {
      modal.style.display = 'none';
      urlInput.value = '';
      urlError.textContent = '';
      
      // 발급된 키 영역 초기화
      document.getElementById('issued-key-container').style.display = 'none';
      document.getElementById('issued-key').textContent = '';
      
      // 버튼 상태 복구
      const submitBtn = document.getElementById('submit-channel');
      submitBtn.disabled = false;
      submitBtn.textContent = '등록하기';
      
      // 닫기 애니메이션 클래스 제거
      modalContent.classList.remove('closing');
    }, 300); // 모달 닫기 애니메이션 지속 시간
  }
  
  function showError(message) {
    console.log('오류 표시:', message);
    urlError.textContent = message;
    urlInput.classList.add('error');
    
    // 입력 필드에 포커스
    urlInput.focus();
    
    // 잠시 후 에러 표시 제거
    setTimeout(() => {
      urlInput.classList.remove('error');
    }, 3000);
  }
  
  function isValidChannelUrl(url, platform) {
    if (!url || !platform) return false;
    
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return false;
    
    // 플랫폼별 URL 패턴 검증
    const patterns = {
      youtube: [
        /^https?:\/\/(www\.)?youtube\.com\/c\/[a-zA-Z0-9_-]+\/?(\?.*)?$/,
        /^https?:\/\/(www\.)?youtube\.com\/channel\/[a-zA-Z0-9_-]+\/?(\?.*)?$/,
        /^https?:\/\/(www\.)?youtube\.com\/user\/[a-zA-Z0-9_-]+\/?(\?.*)?$/,
        // 핸들(@) + 퍼센트 인코딩(UTF-8) 허용
        /^https?:\/\/(www\.)?youtube\.com\/@(?:[a-zA-Z0-9_.-]|%[0-9A-Fa-f]{2})+\/?(\?.*)?$/,
        // @핸들명만 (퍼센트 인코딩 허용)
        /^@(?:[a-zA-Z0-9_.-]|%[0-9A-Fa-f]{2})+$/
      ],
      tiktok: [
        /^https?:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+\/?(\?.*)?$/,
        /^@[a-zA-Z0-9_.]+$/  // @사용자명만
      ],
      instagram: [
        /^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?(\?.*)?$/,
        /^[a-zA-Z0-9_.]+$/  // 사용자명만
      ]
    };
    
    const platformPatterns = patterns[platform];
    if (!platformPatterns) {
      console.error('지원하지 않는 플랫폼:', platform);
      return false;
    }
    
    const isValid = platformPatterns.some(pattern => pattern.test(trimmedUrl));
    console.log(`URL 검증 (${platform}):`, trimmedUrl, '결과:', isValid);
    
    return isValid;
  }
  
  // 기존 함수는 호환성을 위해 유지
  function isValidYouTubeUrl(url) {
    return isValidChannelUrl(url, 'youtube');
  }
  
  function showNotification(message, type = '') {
    console.log('알림 표시:', message);
    
    // 기존 알림 제거
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => {
      document.body.removeChild(notif);
    });
    
    // 임시 알림 생성
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 애니메이션 효과
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // 3초 후 제거
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 4000);
  }
  
  // 이모지 키 생성 함수
  function generateEmojiKey() {
    // 이모지 배열
    const emojis = [
      '🔑', '🔒', '🔓', '🔐', '🔏', '🔖', '🏷️', '📝', '📌', '📍', '🎯', '✅', '✨',
      '⭐', '🌟', '💫', '🎉', '🎊', '🎈', '🎁', '🎀', '🎵', '🎶', '👑', '💎', '🏆',
      '🥇', '🥳', '😄', '😊', '🚀', '💡', '🔔', '🎬', '🎮', '🧩', '🎨', '🎭', '🎤'
    ];
    
    // 랜덤으로 3-4개의 이모지 선택
    const length = Math.floor(Math.random() * 2) + 3; // 3 또는 4
    let key = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * emojis.length);
      key += emojis[randomIndex];
    }
    
    return key;
  }
  
  // 채널 상태 업데이트
  async function updateChannelStatus(channelId, newStatus) {
    console.log(`채널 상태 업데이트: ${channelId} => ${newStatus}`);
    try {
      const channelRef = doc(db, 'channels', channelId);
      await updateDoc(channelRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      console.log('채널 상태 업데이트 성공');
      showNotification('채널 상태가 업데이트되었습니다.');
    } catch (error) {
      console.error('채널 상태 업데이트 중 오류:', error);
      showNotification('상태 업데이트 중 오류가 발생했습니다.');
    }
  }
  
  // 클립보드 복사
  function copyToClipboard(text) {
    console.log('클립보드 복사:', text);
    
    // 모던 네비게이터 API 사용 시도
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text)
        .then(() => {
          console.log('클립보드 복사 성공 (Navigator API)');
          // showNotification 제거 - 버튼 시각적 피드백만 사용
        })
        .catch(err => {
          console.error('클립보드 API 오류:', err);
          return fallbackCopyToClipboard(text);
        });
    } else {
      // 폴백: 전통적인 방식
      return fallbackCopyToClipboard(text);
    }
  }
  
  // 폴백 클립보드 복사 방식
  function fallbackCopyToClipboard(text) {
    // 임시 텍스트 영역 생성
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed'; // 화면 밖으로
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      // 복사 명령 실행
      const successful = document.execCommand('copy');
      console.log('클립보드 복사 ' + (successful ? '성공' : '실패') + ' (execCommand)');
      // showNotification 제거 - 버튼 시각적 피드백만 사용
      return successful ? Promise.resolve() : Promise.reject();
    } catch (err) {
      console.error('클립보드 복사 중 오류:', err);
      return Promise.reject(err);
    } finally {
      // 임시 요소 제거
      document.body.removeChild(textarea);
    }
  }
  
  // 페이지 언로드 시 리스너 해제
  window.addEventListener('beforeunload', () => {
    if (channelUnsubscribe) {
      channelUnsubscribe();
    }
  });
  
  console.log('채널 관리 페이지 초기화 완료');
  
  // 애니메이션 효과 추가
  addAnimationEffects();
  
  // === 컨텐츠 링크 관리 기능 ===

  // 컨텐츠 링크 관련 변수
  let contentLinksData = [];
  let contentModalOpen = false;
  
  // 페이지네이션 관련 변수
  let contentLinksCurrentPage = 1;
  let contentLinksPerPage = 10;
  let contentLinksVisible = false;

  // 컨텐츠 링크 초기화
  function initializeContentLinks() {
    const addContentBtn = document.getElementById('add-content-link');
    const addFirstContentBtn = document.getElementById('add-first-content-link');
    const contentModal = document.getElementById('content-link-modal');
    const closeContentModalBtn = document.getElementById('close-content-modal');
    const cancelContentBtn = document.getElementById('cancel-content-link');
    const contentForm = document.getElementById('content-link-form');
    const contentUrlInput = document.getElementById('content-url');
    const toggleContentBtn = document.getElementById('toggle-content-links');
    
    // 이벤트 리스너 추가
    if (addContentBtn) {
      addContentBtn.addEventListener('click', openContentModal);
    }
    
    if (addFirstContentBtn) {
      addFirstContentBtn.addEventListener('click', openContentModal);
    }
    
    // 토글 버튼 이벤트 리스너
    if (toggleContentBtn) {
      toggleContentBtn.addEventListener('click', toggleContentLinksVisibility);
    }
    
    // 페이지네이션 이벤트 리스너
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    
    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => goToPage(contentLinksCurrentPage - 1));
    }
    
    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => goToPage(contentLinksCurrentPage + 1));
    }
    
    if (closeContentModalBtn) {
      closeContentModalBtn.addEventListener('click', closeContentModal);
    }
    
    if (cancelContentBtn) {
      cancelContentBtn.addEventListener('click', closeContentModal);
    }
    
    if (contentModal) {
      contentModal.addEventListener('click', (e) => {
        if (e.target === contentModal) {
          closeContentModal();
        }
      });
    }
    
    if (contentForm) {
      contentForm.addEventListener('submit', handleContentLinkSubmit);
    }
    
    if (contentUrlInput) {
      contentUrlInput.addEventListener('input', handleContentUrlChange);
    }

    // 모바일: 채널 선택 후 다음 입력란에서 키보드가 뜨지 않는 문제 우회
    const channelSelectEl = document.getElementById('channel-select');
    if (channelSelectEl) {
      const releaseSelectFocus = () => {
        try { channelSelectEl.blur(); } catch (_) {}
      };
      channelSelectEl.addEventListener('change', () => {
        releaseSelectFocus();
        // 다음 입력란을 자연스럽게 보이도록 살짝 스크롤 유도
        setTimeout(() => {
          const urlEl = document.getElementById('content-url');
          if (urlEl) {
            try { urlEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
          }
        }, 50);
      }, { passive: true });
      channelSelectEl.addEventListener('touchend', releaseSelectFocus, { passive: true });
      channelSelectEl.addEventListener('pointerdown', releaseSelectFocus, { passive: true });
    }
    
    // 컨텐츠 링크 테이블 이벤트 위임 설정
    const contentLinksTable = document.getElementById('content-links-list');
    if (contentLinksTable) {
      contentLinksTable.addEventListener('click', (e) => {
        // 삭제 버튼 클릭 처리
        if (e.target.closest('.btn-delete-content')) {
          const button = e.target.closest('.btn-delete-content');
          const linkId = button.getAttribute('data-link-id');
          if (linkId) {
            deleteContentLink(linkId);
          }
        }
      });
    }
    
    // 컨텐츠 링크 데이터 로드
    loadContentLinks();
  }

  // 컨텐츠 링크 모달 열기
  function openContentModal() {
    const modal = document.getElementById('content-link-modal');
    if (!modal) return;
    
    contentModalOpen = true;
    try { document.body.classList.add('modal-open'); } catch (_) {}
    modal.style.display = 'flex';
    
    // 애니메이션 효과
    requestAnimationFrame(() => {
      modal.classList.add('show');
      const modalContent = modal.querySelector('.modal-content');
      if (modalContent) {
        modalContent.style.transform = 'scale(1)';
        modalContent.style.opacity = '1';
      }
    });
    
    // 모달 초기화 (지연된 실행)
    setTimeout(() => {
      console.log('모달 초기화 시작');
      console.log('현재 channelsData 상태:', channelsData);
      loadChannelOptions();        // 채널 목록 로드
      // 음원 자동완성 제거됨
    }, 100);
    
    // 모든 입력 필드 강제 활성화
    setTimeout(() => {
      console.log('입력 필드 활성화 시작');
      
      // 모든 입력 필드와 선택 필드 활성화
      const inputFields = modal.querySelectorAll('input, select, textarea');
      inputFields.forEach((field, index) => {
        console.log(`필드 ${index + 1} 활성화:`, field.id || field.name || 'unknown');
        
        // 모든 제한 제거
        field.disabled = false;
        field.readOnly = false;
        field.removeAttribute('disabled');
        field.removeAttribute('readonly');
        field.removeAttribute('tabindex');
        
        // 스타일 강제 적용
        const cursor = field.tagName.toLowerCase() === 'select' ? 'pointer' : 'text';
        field.style.cssText = `
          pointer-events: auto !important;
          cursor: ${cursor} !important;
          background: rgba(12, 12, 12, 0.9) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #fff !important;
          z-index: 200 !important;
          position: relative !important;
          padding: 14px 16px !important;
          border-radius: 8px !important;
          font-size: 1rem !important;
        `;
        
        // 이벤트 리스너 추가
        field.addEventListener('focus', () => {
          console.log('필드 포커스됨:', field.id || field.name);
          field.style.borderColor = '#3eb489 !important';
        });
        
        field.addEventListener('blur', () => {
          field.style.borderColor = 'rgba(255, 255, 255, 0.1) !important';
        });
        
        field.addEventListener('click', (e) => {
          e.stopPropagation();
          field.focus();
          console.log('필드 클릭됨:', field.id || field.name);
        });
      });
      
      // 컨텐츠 URL 입력 필드 특별 처리
      const contentUrlInput = document.getElementById('content-url');
      if (contentUrlInput) {
        console.log('Content URL 입력 필드 설정');
        contentUrlInput.addEventListener('input', handleContentUrlChange);
        // 모바일 키보드 유도 속성
        try {
          contentUrlInput.setAttribute('inputmode', 'url');
          contentUrlInput.setAttribute('enterkeyhint', 'done');
          contentUrlInput.setAttribute('autocomplete', 'off');
          contentUrlInput.setAttribute('autocapitalize', 'off');
          contentUrlInput.setAttribute('autocorrect', 'off');
        } catch (_) {}

        // 터치/클릭 시 키보드가 즉시 뜨도록 포커스 보조
        const ensureFocus = (el) => {
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
        ensureFocus(contentUrlInput);

        setTimeout(() => {
          contentUrlInput.focus();
          console.log('Content URL 필드 포커스됨');
        }, 120);
      }
    }, 150);
    
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', handleContentModalEscape);
  }

  // 컨텐츠 링크 모달 닫기
  function closeContentModal() {
    const modal = document.getElementById('content-link-modal');
    if (!modal) return;
    
    contentModalOpen = false;
    try { document.body.classList.remove('modal-open'); } catch (_) {}
    modal.classList.remove('show');
    
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.style.transform = 'scale(0.95)';
      modalContent.style.opacity = '0';
    }
    
    setTimeout(() => {
      modal.style.display = 'none';
      resetContentForm();
    }, 300);
    
    document.removeEventListener('keydown', handleContentModalEscape);
  }

  // ESC 키 핸들러
  function handleContentModalEscape(e) {
    if (e.key === 'Escape' && contentModalOpen) {
      closeContentModal();
    }
  }

  // 컨텐츠 URL 변경 핸들러
  function handleContentUrlChange(e) {
    const url = e.target.value.trim();
    const platformInfo = detectPlatformFromUrl(url);
    updateDetectedPlatform(platformInfo);
  }

  // URL에서 플랫폼 감지
  function detectPlatformFromUrl(url) {
    if (!url) {
      return { platform: null, name: '자동 감지됨', icon: '' };
    }
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return {
        platform: 'youtube',
        name: 'YouTube',
        icon: '../images/platform-youtube.svg'
      };
    } else if (url.includes('tiktok.com')) {
      return {
        platform: 'tiktok',
        name: 'TikTok',
        icon: '../images/platform-tiktok.svg'
      };
    } else if (url.includes('instagram.com')) {
      return {
        platform: 'instagram',
        name: 'Instagram',
        icon: '../images/platform-instagram.svg'
      };
    } else {
      return {
        platform: 'other',
        name: '기타 플랫폼',
        icon: ''
      };
    }
  }

  // 감지된 플랫폼 UI 업데이트
  function updateDetectedPlatform(platformInfo) {
    const platformIcon = document.getElementById('detected-platform-icon');
    const platformName = document.getElementById('detected-platform-name');
    
    if (platformIcon && platformName) {
      if (platformInfo.icon) {
        platformIcon.src = platformInfo.icon;
        platformIcon.style.display = 'block';
      } else {
        platformIcon.style.display = 'none';
      }
      
      platformName.textContent = platformInfo.name;
    }
  }

  // 컨텐츠 링크 폼 제출 핸들러
  async function handleContentLinkSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
      showNotification('로그인이 필요합니다.', 'error');
      return;
    }
    
    const formData = new FormData(e.target);
    const channelId = formData.get('channel-select');
    const contentUrl = formData.get('content-url');
    // 사용된 음원 입력 필드 제거에 따라 값 수집 안 함
    
    // 유효성 검증
    if (!channelId) {
      showNotification('채널을 선택해주세요.', 'error');
      return;
    }
    
    if (!contentUrl) {
      showNotification('컨텐츠 URL을 입력해주세요.', 'error');
      return;
    }
    
    // 음원 입력 필드 유효성 검사 제거
    
    const platformInfo = detectPlatformFromUrl(contentUrl);
    
    // 선택된 채널 정보 가져오기
    const selectedChannel = channelsData.find(ch => ch.id === channelId);
    
    if (!selectedChannel) {
      console.error('선택된 채널을 찾을 수 없습니다:', channelId);
      console.log('현재 channelsData:', channelsData);
      showNotification('선택된 채널을 찾을 수 없습니다. 채널을 다시 선택해주세요.', 'error');
      return;
    }
    
    // 고유 ID 생성 (timestamp 기반)
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const normalizedPlatform = (platformInfo && platformInfo.platform)
      || (selectedChannel && selectedChannel.platform)
      || 'other';

    const newContentLink = {
      id: uniqueId,
      channelId,
      channelUrl: selectedChannel.originalUrl || selectedChannel.channelUrl || selectedChannel.url || '',
      channelPlatform: selectedChannel.platform || 'youtube',
      contentUrl,
      platform: normalizedPlatform,
      createdAt: new Date() // 클라이언트 타임스탬프 사용
    };
    
    // 유저 정보 수집
    const userInfo = {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName || '익명 사용자',
      photoURL: currentUser.photoURL || null
    };
    
    // 디버깅 로그
    console.log('콘텐츠 링크 제출 시도:', newContentLink);
    console.log('현재 사용자:', currentUser.uid);
    console.log('선택된 채널:', selectedChannel);
    
    try {
      // 사용자별 contentLinks 문서 참조
      const userContentLinksDocRef = doc(db, 'contentLinks', currentUser.uid);
      
      // 기존 문서가 있는지 확인
      const userContentLinksDoc = await getDoc(userContentLinksDocRef);
      
      if (userContentLinksDoc.exists()) {
        // 기존 문서에 contentLink 추가
        const existingData = userContentLinksDoc.data();
        const existingContentLinks = existingData.contentLinks || [];
        
        console.log('기존 컨텐츠 링크 수:', existingContentLinks.length);
        
        // 새 contentLink를 기존 배열에 추가
        const updatedContentLinks = [...existingContentLinks, newContentLink];
        
        await updateDoc(userContentLinksDocRef, {
          contentLinks: updatedContentLinks,
          userInfo: userInfo, // 유저 정보 업데이트
          updatedAt: serverTimestamp()
        });
        
        console.log('기존 문서에 컨텐츠 링크 추가 성공!');
      } else {
        // 새 문서 생성
        await setDoc(userContentLinksDocRef, {
          userInfo: userInfo,
          contentLinks: [newContentLink],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        console.log('새 유저 컨텐츠 링크 문서 생성 성공!');
      }
      
      console.log('Firestore 저장 성공! 사용자 ID:', currentUser.uid);
      
      showNotification('컨텐츠 링크가 성공적으로 등록되었습니다! 🎉', 'success');
      closeContentModal();
      loadContentLinks(); // 목록 새로고침
      
    } catch (error) {
      console.error('컨텐츠 링크 추가 중 오류:', error);
      console.error('오류 상세:', error.code, error.message);
      showNotification('컨텐츠 링크 등록 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    }
  }

  // 컨텐츠 링크 목록 로드
  async function loadContentLinks() {
    console.log('loadContentLinks 호출됨 - currentUser:', currentUser ? currentUser.uid : '없음');
    
    if (!currentUser) {
      console.log('사용자가 인증되지 않음 - 컨텐츠 링크 로드 건너뜀');
      return;
    }
    
    try {
      console.log('컨텐츠 링크 문서 로드 시작 - userId:', currentUser.uid);
      
      // 현재 사용자의 contentLinks 문서를 직접 참조
      const userContentLinksDocRef = doc(db, 'contentLinks', currentUser.uid);
      const userContentLinksDoc = await getDoc(userContentLinksDocRef);
      
      if (userContentLinksDoc.exists()) {
        const userData = userContentLinksDoc.data();
        const userContentLinks = userData.contentLinks || [];
        
        console.log('컨텐츠 링크 문서 발견, 링크 수:', userContentLinks.length);
        console.log('유저 정보:', userData.userInfo);
        
        // contentLinks 배열을 contentLinksData에 할당
        contentLinksData = userContentLinks.map((link) => ({
          ...link,
          userInfo: userData.userInfo // 유저 정보 포함
        }));
        
        console.log('로드된 컨텐츠 링크 데이터:', contentLinksData);
      } else {
        console.log('컨텐츠 링크 문서가 존재하지 않음, 기존 개별 문서 마이그레이션 시도...');
        
        // 기존 개별 문서 형태가 있는지 확인하고 마이그레이션 시도
        const migrationResult = await migrateOldContentLinks();
        
        if (migrationResult.success) {
          console.log(`마이그레이션 완료: ${migrationResult.migratedCount}개 링크 변환됨`);
          
          // 마이그레이션 후 새로운 문서에서 데이터 로드
          const newUserContentLinksDoc = await getDoc(userContentLinksDocRef);
          if (newUserContentLinksDoc.exists()) {
            const userData = newUserContentLinksDoc.data();
            const userContentLinks = userData.contentLinks || [];
            
            contentLinksData = userContentLinks.map((link) => ({
              ...link,
              userInfo: userData.userInfo
            }));
            
            console.log('마이그레이션 후 로드된 컨텐츠 링크 데이터:', contentLinksData);
          } else {
            contentLinksData = [];
          }
        } else {
          console.log('마이그레이션할 기존 데이터가 없음');
          contentLinksData = [];
        }
      }
      
      // 플랫폼 보정 + 정렬 (createdAt 기준 내림차순)
      contentLinksData = contentLinksData.map((link) => ({
        ...link,
        platform: link.platform || link.channelPlatform || 'other'
      }));

      contentLinksData.sort((a, b) => {
        const aTime = a.createdAt;
        const bTime = b.createdAt;
        
        // createdAt이 없는 경우 처리
        if (!aTime && !bTime) return 0;
        if (!aTime) return 1;
        if (!bTime) return -1;
        
        let aTimeValue, bTimeValue;
        
        // Firestore Timestamp 객체인 경우
        if (aTime.toDate && bTime.toDate) {
          aTimeValue = aTime.toDate().getTime();
          bTimeValue = bTime.toDate().getTime();
        }
        // Date 객체인 경우
        else if (aTime instanceof Date && bTime instanceof Date) {
          aTimeValue = aTime.getTime();
          bTimeValue = bTime.getTime();
        }
        // 문자열인 경우
        else if (typeof aTime === 'string' && typeof bTime === 'string') {
          aTimeValue = new Date(aTime).getTime();
          bTimeValue = new Date(bTime).getTime();
        }
        // 타입이 다른 경우 Date로 변환 시도
        else {
          try {
            aTimeValue = aTime.toDate ? aTime.toDate().getTime() : new Date(aTime).getTime();
            bTimeValue = bTime.toDate ? bTime.toDate().getTime() : new Date(bTime).getTime();
          } catch (error) {
            console.warn('날짜 정렬 중 오류:', error);
            return 0;
          }
        }
        
        return bTimeValue - aTimeValue; // 내림차순 (최신순)
      });
      
      console.log('현재 사용자의 컨텐츠 링크 수:', contentLinksData.length);
      console.log('컨텐츠 링크 테이블 렌더링 시작');
      renderContentLinksTable();
      
    } catch (error) {
      console.error('컨텐츠 링크 로드 중 오류:', error);
      showNotification('컨텐츠 링크를 불러오는 중 오류가 발생했습니다.', 'error');
    }
  }

  // 기존 개별 contentLinks 문서를 새로운 구조로 마이그레이션
  async function migrateOldContentLinks() {
    console.log('=== 기존 contentLinks 마이그레이션 시작 ===');
    
    if (!currentUser) {
      console.error('마이그레이션: 사용자가 로그인하지 않음');
      return { success: false, migratedCount: 0 };
    }
    
    try {
      // 먼저 현재 사용자 UID가 기존 개별 문서 ID와 동일한지 확인 (충돌 방지)
      const currentUserDocRef = doc(db, 'contentLinks', currentUser.uid);
      const currentUserDoc = await getDoc(currentUserDocRef);
      
      if (currentUserDoc.exists()) {
        // 이미 새로운 구조의 문서가 존재하면 마이그레이션 불필요
        console.log('마이그레이션: 이미 새로운 구조의 문서가 존재함');
        return { success: false, migratedCount: 0 };
      }
      
      // 현재 사용자의 기존 개별 contentLinks 문서들 조회
      const oldContentLinksQuery = query(
        collection(db, 'contentLinks'),
        where('userId', '==', currentUser.uid)
      );
      
      const oldContentLinksSnapshot = await getDocs(oldContentLinksQuery);
      
      if (oldContentLinksSnapshot.empty) {
        console.log('마이그레이션: 기존 개별 문서가 없음');
        return { success: false, migratedCount: 0 };
      }
      
      console.log(`마이그레이션: ${oldContentLinksSnapshot.docs.length}개의 기존 문서 발견`);
      
      // 기존 문서들을 새로운 구조로 변환
      const migratedContentLinks = [];
      const documentsToDelete = [];
      
      oldContentLinksSnapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        
        // 고유 ID 생성 (기존 문서 ID 사용 또는 새로 생성)
        const uniqueId = data.id || `migrated_${docSnapshot.id}_${Date.now()}`;
        
        const migratedLink = {
          id: uniqueId,
          channelId: data.channelId || '',
          channelUrl: data.channelUrl || '',
          channelPlatform: data.channelPlatform || 'youtube',
          contentUrl: data.contentUrl || '',
          // audioTrack 제거됨
          platform: data.platform || 'youtube',
          createdAt: data.createdAt || new Date(),
          // 마이그레이션 정보 추가
          migratedAt: new Date(),
          originalDocId: docSnapshot.id
        };
        
        migratedContentLinks.push(migratedLink);
        documentsToDelete.push(docSnapshot.id);
      });
      
      // 유저 정보 수집
      const userInfo = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName || '익명 사용자',
        photoURL: currentUser.photoURL || null
      };
      
      // 새로운 사용자별 문서 생성
      const userContentLinksDocRef = doc(db, 'contentLinks', currentUser.uid);
      
      await setDoc(userContentLinksDocRef, {
        userInfo: userInfo,
        contentLinks: migratedContentLinks,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        migratedAt: serverTimestamp(),
        migrationInfo: {
          originalDocumentCount: oldContentLinksSnapshot.docs.length,
          migratedAt: serverTimestamp()
        }
      });
      
      console.log(`마이그레이션: 새로운 문서 생성 완료 (${migratedContentLinks.length}개 링크)`);
      
      // 기존 개별 문서들 삭제 (선택사항 - 안전을 위해 주석 처리)
      /*
      console.log('마이그레이션: 기존 개별 문서들 삭제 중...');
      const deletePromises = documentsToDelete.map(docId => 
        deleteDoc(doc(db, 'contentLinks', docId))
      );
      await Promise.all(deletePromises);
      console.log(`마이그레이션: ${documentsToDelete.length}개 기존 문서 삭제 완료`);
      */
      
      console.log('=== 마이그레이션 성공 ===');
      showNotification(`기존 데이터 ${migratedContentLinks.length}개를 새로운 구조로 변환했습니다.`, 'success');
      
      return { 
        success: true, 
        migratedCount: migratedContentLinks.length,
        deletedCount: 0 // 실제로는 삭제하지 않음
      };
      
    } catch (error) {
      console.error('마이그레이션 중 오류 발생:', error);
      console.error('오류 코드:', error.code);
      console.error('오류 메시지:', error.message);
      
      showNotification('데이터 마이그레이션 중 오류가 발생했습니다.', 'error');
      
      return { success: false, migratedCount: 0, error: error.message };
    }
  }

  // 컨텐츠 링크 테이블 렌더링 (페이지네이션 포함)
  function renderContentLinksTable() {
    console.log('renderContentLinksTable 호출됨 - 데이터 개수:', contentLinksData.length);
    
    const tableBody = document.getElementById('content-links-list');
    const noLinksEl = document.getElementById('no-content-links');
    const tableWrapper = document.querySelector('.content-table-wrapper');
    const paginationEl = document.getElementById('content-pagination');
    
    console.log('DOM 요소 확인 - tableBody:', !!tableBody, 'noLinksEl:', !!noLinksEl, 'tableWrapper:', !!tableWrapper);
    
    if (!tableBody || !noLinksEl || !tableWrapper) {
      console.error('필수 DOM 요소를 찾을 수 없음');
      return;
    }
    
    if (contentLinksData.length === 0) {
      console.log('컨텐츠 링크 없음 - 빈 상태 표시');
      tableWrapper.style.display = 'none';
      noLinksEl.style.display = 'block';
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }
    
    console.log('컨텐츠 링크 테이블 렌더링 시작 - 링크 수:', contentLinksData.length);
    tableWrapper.style.display = 'block';
    noLinksEl.style.display = 'none';
    
    // 페이지네이션 계산
    const totalItems = contentLinksData.length;
    const totalPages = Math.ceil(totalItems / contentLinksPerPage);
    const startIndex = (contentLinksCurrentPage - 1) * contentLinksPerPage;
    const endIndex = Math.min(startIndex + contentLinksPerPage, totalItems);
    const paginatedData = contentLinksData.slice(startIndex, endIndex);
    
    // 테이블 내용 렌더링 (페이지네이션된 데이터 사용)
    tableBody.innerHTML = paginatedData.map(link => {
      // 채널 정보 가져오기
      const channel = channelsData.find(ch => ch.id === link.channelId);
      const channelDisplay = channel ? 
        `${truncateUrl(channel.originalUrl || channel.channelUrl || channel.url || '채널 URL 없음', 30)} (${getPlatformName(channel.platform)})` : 
        '채널 정보 없음';
      
      return `
        <tr data-link-id="${link.id}">
          <td class="content-url-cell">
            <a href="${link.contentUrl}" target="_blank" class="content-url-display" title="${link.contentUrl}">
              ${truncateUrl(link.contentUrl, 35)}
            </a>
          </td>
          <td>
            <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.7);">
              ${channelDisplay}
            </div>
          </td>
          
          <td>
            <div class="content-platform-badge ${link.platform}">
              ${getPlatformIcon(link.platform)}
              <span>${getPlatformName(link.platform)}</span>
            </div>
          </td>
          <td>${formatDate(link.createdAt)}</td>
          <td>
            <div class="content-actions">
              <button class="btn-content-action btn-delete-content" data-link-id="${link.id}" title="삭제">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
                삭제
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    // 페이지네이션 UI 업데이트
    updatePagination(totalItems, totalPages);
  }

  // 채널 목록 재렌더링 함수 (언어 변경 시 호출)
  function rerenderChannels() {
    if (channelsData && channelsData.length > 0) {
      const docs = channelsData.map(channel => ({ data: () => channel }));
      renderChannelTable(docs);
      renderChannelCards(docs);
    }
  }
  window.rerenderChannelManagement = rerenderChannels;

  // 컨텐츠 링크 토글 기능
  function toggleContentLinksVisibility() {
    const container = document.getElementById('content-links-container');
    const toggleBtn = document.getElementById('toggle-content-links');
    const toggleText = document.getElementById('toggle-content-text');
    const toggleIcon = toggleBtn.querySelector('.toggle-icon');
    
    if (!container || !toggleBtn || !toggleText || !toggleIcon) return;
    
    contentLinksVisible = !contentLinksVisible;
    
    if (contentLinksVisible) {
      container.classList.remove('hidden');
      toggleBtn.classList.add('expanded');
      toggleText.textContent = (window.i18next && window.i18next.t('channelManagement.contentLinks.hideLinks')) || '목록 숨기기';
    } else {
      container.classList.add('hidden');
      toggleBtn.classList.remove('expanded');
      toggleText.textContent = (window.i18next && window.i18next.t('channelManagement.contentLinks.showLinks')) || '목록 보기';
    }
  }

  // 페이지네이션 UI 업데이트
  function updatePagination(totalItems, totalPages) {
    const paginationEl = document.getElementById('content-pagination');
    const paginationInfo = document.getElementById('pagination-info-text');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageNumbers = document.getElementById('page-numbers');
    
    if (!paginationEl || totalPages <= 1) {
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }
    
    paginationEl.style.display = 'flex';
    
    // 페이지 정보 업데이트
    const startItem = (contentLinksCurrentPage - 1) * contentLinksPerPage + 1;
    const endItem = Math.min(contentLinksCurrentPage * contentLinksPerPage, totalItems);
    if (paginationInfo) {
      paginationInfo.textContent = `${startItem}-${endItem} of ${totalItems} items`;
    }
    
    // 이전/다음 버튼 상태 업데이트
    if (prevBtn) {
      prevBtn.disabled = contentLinksCurrentPage <= 1;
    }
    if (nextBtn) {
      nextBtn.disabled = contentLinksCurrentPage >= totalPages;
    }
    
    // 페이지 번호 생성
    if (pageNumbers) {
      pageNumbers.innerHTML = generatePageNumbers(totalPages);
    }
  }

  // 페이지 번호 생성
  function generatePageNumbers(totalPages) {
    const current = contentLinksCurrentPage;
    const delta = 2; // 현재 페이지 주변에 보여줄 페이지 수
    const range = [];
    const rangeWithDots = [];
    
    for (let i = Math.max(2, current - delta); i <= Math.min(totalPages - 1, current + delta); i++) {
      range.push(i);
    }
    
    if (current - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }
    
    rangeWithDots.push(...range);
    
    if (current + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }
    
    return rangeWithDots.map(i => {
      if (i === '...') {
        return '<span class="page-ellipsis">...</span>';
      }
      
      const isActive = i === current;
      return `<button class="page-number ${isActive ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }).join('');
  }

  // 페이지 이동
  function goToPage(page) {
    const totalPages = Math.ceil(contentLinksData.length / contentLinksPerPage);
    
    if (page < 1 || page > totalPages) return;
    
    contentLinksCurrentPage = page;
    renderContentLinksTable();
  }

  // 전역 함수로 노출 (HTML onclick에서 사용)
  window.goToPage = goToPage;

  // 플랫폼 아이콘 가져오기
  function getPlatformIcon(platform) {
    const icons = {
      youtube: '<img src="../images/platform-youtube.svg" alt="YouTube" width="14" height="14">',
      tiktok: '<img src="../images/platform-tiktok.svg" alt="TikTok" width="14" height="14">',
      instagram: '<img src="../images/platform-instagram.svg" alt="Instagram" width="14" height="14">',
      other: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>'
    };
    return icons[platform] || icons.other;
  }

  // 플랫폼 이름 가져오기
  function getPlatformName(platform) {
    const names = {
      youtube: 'YouTube',
      tiktok: 'TikTok',
      instagram: 'Instagram',
      other: '기타'
    };
    return names[platform] || '알 수 없음';
  }

  // 컨텐츠 링크 삭제
  async function deleteContentLink(linkId) {
    if (!confirm('이 컨텐츠 링크를 완전히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      console.log('사용자가 삭제를 취소함');
      return;
    }
    
    if (!currentUser) {
      console.error('사용자가 로그인하지 않음');
      showNotification('로그인이 필요합니다.', 'error');
      return;
    }
    
    console.log('=== 컨텐츠 링크 삭제 시작 ===');
    console.log('삭제 대상 linkId:', linkId);
    console.log('현재 사용자:', currentUser.uid);
    
    try {
      console.log('Firestore 삭제 작업 시작...');
      
      // 현재 사용자의 contentLinks 문서 참조
      const userContentLinksDocRef = doc(db, 'contentLinks', currentUser.uid);
      const userContentLinksDoc = await getDoc(userContentLinksDocRef);
      
      if (!userContentLinksDoc.exists()) {
        console.error('사용자의 컨텐츠 링크 문서가 존재하지 않음');
        showNotification('삭제하려는 링크가 존재하지 않습니다.', 'error');
        return;
      }
      
      const userData = userContentLinksDoc.data();
      const existingContentLinks = userData.contentLinks || [];
      
      // 삭제할 링크가 존재하는지 확인
      const linkIndex = existingContentLinks.findIndex(link => link.id === linkId);
      
      if (linkIndex === -1) {
        console.error('삭제하려는 링크를 찾을 수 없음:', linkId);
        showNotification('삭제하려는 링크가 존재하지 않습니다.', 'error');
        // 최신 상태 반영을 위해 목록 새로고침
        loadContentLinks();
        return;
      }
      
      console.log(`링크 발견됨 (인덱스: ${linkIndex}), 배열에서 제거 중...`);
      
      // 배열에서 해당 링크 제거
      const updatedContentLinks = existingContentLinks.filter(link => link.id !== linkId);
      
      console.log(`업데이트된 링크 수: ${updatedContentLinks.length} (기존: ${existingContentLinks.length})`);
      
      // Firestore 문서 업데이트
      await updateDoc(userContentLinksDocRef, {
        contentLinks: updatedContentLinks,
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Firestore 업데이트 완료!');
      console.log('=== 컨텐츠 링크 삭제 성공 ===');
      showNotification('컨텐츠 링크가 완전히 삭제되었습니다.', 'success');
      
      // 목록 새로고침
      console.log('컨텐츠 링크 목록 새로고침 시작...');
      loadContentLinks();
      
    } catch (error) {
      console.error('❌ 컨텐츠 링크 삭제 중 오류 발생!');
      console.error('오류 전체 객체:', error);
      console.error('오류 코드:', error.code);
      console.error('오류 메시지:', error.message);
      console.error('오류 스택:', error.stack);
      
      // 오류 상세 정보 로그
      if (error.code === 'permission-denied') {
        console.error('🚫 권한 오류 - 사용자가 이 문서를 수정할 권한이 없음');
        console.error('현재 사용자 UID:', currentUser.uid);
        showNotification('삭제 권한이 없습니다. 본인이 등록한 링크만 삭제할 수 있습니다.', 'error');
      } else if (error.code === 'not-found') {
        console.error('📄 문서를 찾을 수 없음 - 사용자의 컨텐츠 링크 문서가 존재하지 않음');
        showNotification('삭제하려는 링크가 존재하지 않습니다.', 'error');
        // 목록 새로고침하여 최신 상태 반영
        loadContentLinks();
      } else {
        console.error('🔥 기타 삭제 오류:', error.message);
        showNotification(`삭제 중 오류가 발생했습니다: ${error.message}`, 'error');
      }
      
      console.log('=== 컨텐츠 링크 삭제 실패 ===');
    }
  }

  // 채널 목록을 드롭다운에 채우기
  function loadChannelOptions() {
    console.log('loadChannelOptions 호출됨');
    const channelSelect = document.getElementById('channel-select');
    
    if (!channelSelect) {
      console.error('channel-select 엘리먼트를 찾을 수 없습니다');
      return;
    }
    
    if (!channelsData || channelsData.length === 0) {
      console.warn('channelsData가 아직 로드되지 않았거나 비어있습니다');
      // 1초 후 재시도 (최대 3회)
      const retryCount = channelSelect.dataset.retryCount || 0;
      if (retryCount < 3) {
        channelSelect.dataset.retryCount = parseInt(retryCount) + 1;
        setTimeout(() => {
          if (channelsData && channelsData.length > 0) {
            console.log('channelsData 로드 완료, 재시도');
            loadChannelOptions();
          } else {
            console.log(`재시도 ${retryCount + 1}회 수행`);
            loadChannelOptions();
          }
        }, 1000);
      } else {
        console.log('최대 재시도 횟수 초과, 빈 채널 목록 표시');
        showEmptyChannelOptions(channelSelect);
      }
      return;
    }
    
    console.log('채널 데이터:', channelsData);
    
    // 기존 옵션 제거 (첫 번째 기본 옵션 제외)
    while (channelSelect.children.length > 1) {
      channelSelect.removeChild(channelSelect.lastChild);
    }
    
    // 승인된 채널만 표시 (approved 또는 active 상태)
    const approvedChannels = channelsData.filter(channel => 
      channel.status === 'approved' || channel.status === 'active'
    );
    
    console.log('승인된 채널 수:', approvedChannels.length);
    
    if (approvedChannels.length === 0) {
      // 승인된 채널이 없는 경우 모든 채널 표시 (디버깅용)
      console.log('승인된 채널이 없음, 모든 채널 표시');
      const allChannels = channelsData;
      
      allChannels.forEach(channel => {
        const option = document.createElement('option');
        option.value = channel.id;
        
        // 채널 URL 표시 (originalUrl 또는 url 사용)
        const channelUrl = channel.originalUrl || channel.channelUrl || channel.url || '채널 URL 없음';
        const platformName = getPlatformName(channel.platform || 'youtube');
        const statusText = channel.status || '상태 없음';
        
        option.textContent = `${channelUrl} (${platformName}) - ${statusText}`;
        channelSelect.appendChild(option);
        
        console.log('채널 추가됨:', option.textContent);
      });
      
      if (allChannels.length === 0) {
        showEmptyChannelOptions(channelSelect);
      }
    } else {
      // 승인된 채널 표시
      approvedChannels.forEach(channel => {
        const option = document.createElement('option');
        option.value = channel.id;
        
        // 채널 URL 표시 (originalUrl 또는 url 사용)
        const channelUrl = channel.originalUrl || channel.channelUrl || channel.url || '채널 URL 없음';
        const platformName = getPlatformName(channel.platform || 'youtube');
        
        option.textContent = `${channelUrl} (${platformName})`;
        channelSelect.appendChild(option);
        
        console.log('승인된 채널 추가됨:', option.textContent);
      });
    }
    
    console.log('채널 옵션 로드 완료, 총 옵션 수:', channelSelect.children.length);
    
    // 재시도 카운트 초기화
    channelSelect.removeAttribute('data-retry-count');
  }
  
  // 빈 채널 옵션 표시 함수
  function showEmptyChannelOptions(channelSelect) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '등록된 채널이 없습니다';
    option.disabled = true;
    channelSelect.appendChild(option);
    
    console.log('빈 채널 옵션 표시됨');
  }

  // Firestore track_new 컬렉션에서 음원 목록 가져오기
  let allTracks = [];
  
  async function loadAudionyxTracks() {
    try {
      console.log('[loadAudionyxTracks] Firestore track_new 컬렉션에서 음원 목록 로드 시작');
      
      const trackSnapshot = await getDocs(collection(db, 'track_new'));
      
      if (trackSnapshot.empty) {
        console.warn('[loadAudionyxTracks] track_new 컬렉션에 데이터가 없습니다');
        allTracks = [];
        return;
      }
      
      allTracks = [];
      trackSnapshot.forEach((doc) => {
        const data = doc.data();
        
        // 새로운 스키마에 맞게 데이터 매핑
        const trackTitle = data['Track Title'] || '';
        const isrc = data['ISRC'] || '';
        const artist = data['Primary Artist'] || '';
        
        if (trackTitle) {
          allTracks.push({
            id: doc.id,
            title: trackTitle,
            cid: isrc, // ISRC를 CID로 사용
            artist: artist,
            // 검색을 위한 추가 정보
            mood1: data['mood 1'] || '',
            mood2: data['mood 2'] || '',
            usecase1: data['usecase1'] || '',
            usecase2: data['usecase2'] || '',
            usecase3: data['usecase3'] || '',
            releaseTitle: data['Release Title'] || ''
          });
        }
      });
      
      // 제목순으로 정렬
      allTracks.sort((a, b) => a.title.localeCompare(b.title));
      
      console.log(`[loadAudionyxTracks] 음원 목록 로드 완료: ${allTracks.length}개`);
      console.log('[loadAudionyxTracks] 로드된 트랙 샘플:', allTracks.slice(0, 3));
      
    } catch (error) {
      console.error('[loadAudionyxTracks] 음원 목록 로드 중 오류:', error);
      
      // 오류 발생 시 빈 배열로 초기화
      allTracks = [];
      
      // 사용자에게 알림 (선택적)
      showNotification('음원 목록을 불러오는 중 오류가 발생했습니다.', 'error');
    }
  }

  // 음원 자동완성 기능
  function setupAudioTrackAutocomplete() {
    const audioTrackInput = document.getElementById('audio-track');
    const suggestionsContainer = document.getElementById('audio-track-suggestions');
    
    if (!audioTrackInput || !suggestionsContainer) return;
    
    let currentHighlight = -1;
    
    audioTrackInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      if (query.length < 2) {
        hideSuggestions();
        return;
      }
      
      const filteredTracks = filterTracks(query);
      showSuggestions(filteredTracks, query);
    });
    
    audioTrackInput.addEventListener('keydown', (e) => {
      const suggestions = suggestionsContainer.querySelectorAll('.audio-track-suggestion');
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentHighlight = Math.min(currentHighlight + 1, suggestions.length - 1);
        updateHighlight(suggestions);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentHighlight = Math.max(currentHighlight - 1, -1);
        updateHighlight(suggestions);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentHighlight >= 0 && suggestions[currentHighlight]) {
          selectSuggestion(suggestions[currentHighlight]);
        }
      } else if (e.key === 'Escape') {
        hideSuggestions();
      }
    });
    
    audioTrackInput.addEventListener('blur', () => {
      // 약간의 지연을 두어 클릭 이벤트가 처리되도록 함
      setTimeout(() => hideSuggestions(), 150);
    });
    
    function filterTracks(query) {
      const lowercaseQuery = query.toLowerCase();
      return allTracks.filter(track => 
        track.title.toLowerCase().includes(lowercaseQuery) ||
        track.cid.toLowerCase().includes(lowercaseQuery) ||
        track.artist.toLowerCase().includes(lowercaseQuery) ||
        track.mood1.toLowerCase().includes(lowercaseQuery) ||
        track.mood2.toLowerCase().includes(lowercaseQuery) ||
        track.usecase1.toLowerCase().includes(lowercaseQuery) ||
        track.usecase2.toLowerCase().includes(lowercaseQuery) ||
        track.usecase3.toLowerCase().includes(lowercaseQuery)
      ).slice(0, 8); // 최대 8개만 표시
    }
    
    function showSuggestions(tracks, query) {
      if (tracks.length === 0) {
        suggestionsContainer.innerHTML = '<div class="suggestions-no-results">검색 결과가 없습니다</div>';
        suggestionsContainer.style.display = 'block';
        return;
      }
      
      suggestionsContainer.innerHTML = tracks.map(track => {
        const highlightedTitle = highlightMatch(track.title, query);
        const highlightedCid = highlightMatch(track.cid, query);
        const highlightedArtist = highlightMatch(track.artist, query);
        
        return `
          <div class="audio-track-suggestion" data-title="${track.title}" data-cid="${track.cid}" data-artist="${track.artist}">
            <div class="suggestion-title">${highlightedTitle}</div>
            <div class="suggestion-artist" style="font-size: 0.8rem; color: rgba(255, 255, 255, 0.6); margin: 2px 0;">by ${highlightedArtist}</div>
            <div class="suggestion-cid" style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5);">CID: ${highlightedCid}</div>
          </div>
        `;
      }).join('');
      
      // 클릭 이벤트 추가
      suggestionsContainer.querySelectorAll('.audio-track-suggestion').forEach(item => {
        item.addEventListener('click', () => selectSuggestion(item));
      });
      
      suggestionsContainer.style.display = 'block';
      currentHighlight = -1;
    }
    
    function highlightMatch(text, query) {
      const regex = new RegExp(`(${query})`, 'gi');
      return text.replace(regex, '<span class="suggestion-match">$1</span>');
    }
    
    function hideSuggestions() {
      suggestionsContainer.style.display = 'none';
      currentHighlight = -1;
    }
    
    function updateHighlight(suggestions) {
      suggestions.forEach((item, index) => {
        item.classList.toggle('highlighted', index === currentHighlight);
      });
    }
    
    function selectSuggestion(item) {
      const title = item.dataset.title;
      const cid = item.dataset.cid;
      const artist = item.dataset.artist;
      
      // 아티스트 정보도 포함하여 표시
      if (artist && artist !== '아티스트 정보 없음') {
        audioTrackInput.value = `${title} by ${artist} (${cid})`;
      } else {
        audioTrackInput.value = `${title} (${cid})`;
      }
      
      hideSuggestions();
    }
  }

  // 컨텐츠 링크 폼 리셋
  function resetContentForm() {
    const form = document.getElementById('content-link-form');
    if (form) {
      form.reset();
      
      // 채널 선택 초기화
      const channelSelect = document.getElementById('channel-select');
      if (channelSelect) {
        channelSelect.selectedIndex = 0;
      }
      
      // 음원 입력 및 자동완성 초기화
      const audioTrackInput = document.getElementById('audio-track');
      const suggestionsContainer = document.getElementById('audio-track-suggestions');
      if (audioTrackInput) {
        audioTrackInput.value = '';
      }
      if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
        suggestionsContainer.innerHTML = '';
      }
      
      updateDetectedPlatform({ platform: null, name: '자동 감지됨', icon: '' });
      
      // 입력 필드 활성화 상태 유지
      const contentUrlInput = document.getElementById('content-url');
      if (contentUrlInput) {
        contentUrlInput.disabled = false;
        contentUrlInput.readOnly = false;
        contentUrlInput.removeAttribute('disabled');
        contentUrlInput.removeAttribute('readonly');
        contentUrlInput.removeAttribute('tabindex');
        
        // 모든 CSS 재설정
        contentUrlInput.style.cssText = `
          width: 100% !important;
          background: rgba(12, 12, 12, 0.9) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #fff !important;
          padding: 14px 16px !important;
          border-radius: 8px !important;
          font-size: 1rem !important;
          pointer-events: auto !important;
          cursor: text !important;
          position: static !important;
          z-index: auto !important;
        `;
      }
    }
  }

  // 이벤트 위임으로 처리하므로 글로벌 함수 노출 불필요
});

// 애니메이션 효과 추가
function addAnimationEffects() {
  // 채널 등록 버튼에 호버 효과
  const registerBtn = document.getElementById('register-channel-btn');
  if(registerBtn) {
    registerBtn.addEventListener('mouseenter', () => {
      registerBtn.style.transform = 'translateY(-3px)';
      registerBtn.style.boxShadow = '0 7px 15px rgba(62, 180, 137, 0.3)';
    });
    
    registerBtn.addEventListener('mouseleave', () => {
      registerBtn.style.transform = '';
      registerBtn.style.boxShadow = '';
    });
    
    registerBtn.addEventListener('mousedown', () => {
      registerBtn.style.transform = 'translateY(0)';
      registerBtn.style.boxShadow = '0 3px 8px rgba(62, 180, 137, 0.2)';
    });
    
    registerBtn.addEventListener('mouseup', () => {
      registerBtn.style.transform = 'translateY(-3px)';
      registerBtn.style.boxShadow = '0 7px 15px rgba(62, 180, 137, 0.3)';
    });
  }
  
  // 복사 버튼에 애니메이션 효과
  document.addEventListener('click', (e) => {
    if(e.target.closest('.btn-copy-key')) {
      const btn = e.target.closest('.btn-copy-key');
      btn.classList.add('clicked');
      
      // 복사 효과 애니메이션
      setTimeout(() => {
        btn.classList.remove('clicked');
      }, 300);
    }
  });
}

// 전역 함수들 (HTML에서 onclick으로 호출)
window.copyChannelKey = function(key) {
  if (!key) {
    console.error('복사할 키가 없습니다.');
    return;
  }
  
  // 모던 네비게이터 API 사용 시도
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(key)
      .then(() => {
        console.log('클립보드 복사 성공 (Navigator API)');
        // showNotification 제거 - 버튼 시각적 피드백만 사용
      })
      .catch(err => {
        console.error('클립보드 API 오류:', err);
        fallbackCopyToClipboard(key);
      });
  } else {
    // 폴백: 전통적인 방식
    fallbackCopyToClipboard(key);
  }
};

// 애니메이션 초기화 함수
function initializeAnimations() {
  // 페이지 로드 시 애니메이션 요소들을 찾아서 관찰
  const animatedElements = document.querySelectorAll('[data-animate]');
  
  if (animatedElements.length === 0) return;
  
  // Intersection Observer 설정
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        const animationType = element.getAttribute('data-animate');
        
        // 애니메이션 클래스 추가
        if (animationType === 'fade-up') {
          element.classList.add('animate-fade-up');
        } else {
          element.classList.add('animate-fade-in');
        }
        
        // 한 번 애니메이션이 실행되면 관찰 중지
        observer.unobserve(element);
      }
    });
  }, observerOptions);
  
  // 모든 애니메이션 요소 관찰 시작
  animatedElements.forEach(element => {
    observer.observe(element);
  });
}

// 중복 채널 검사 함수 - 현재 사용자의 채널만 확인
async function checkDuplicateChannel(url, platform = 'youtube') {
  try {
    console.log('중복 검사 시작:', url, platform);
    
    if (!currentUser || !currentUser.uid) {
      return {
        exists: false,
        message: '사용자 인증이 필요합니다.'
      };
    }
    
    const normalizedUrl = normalizeUrl(url, platform);
    console.log('정규화된 URL로 중복 검사:', normalizedUrl);
    
    // 현재 사용자의 채널 문서 확인
    const userChannelDocRef = doc(db, 'channels', currentUser.uid);
    const userChannelDoc = await getDoc(userChannelDocRef);
    
    if (userChannelDoc.exists()) {
      const userData = userChannelDoc.data();
      const existingChannels = userData.channels || [];
      
      console.log('기존 채널 수:', existingChannels.length);
      
      // 같은 플랫폼과 URL의 채널이 이미 등록되어 있는지 확인
      const duplicateChannel = existingChannels.find(channel => 
        channel.platform === platform && channel.url === normalizedUrl
      );
      
             if (duplicateChannel) {
         console.log('중복 채널 발견됨');
         const registrationDate = duplicateChannel.createdAt ? 
           formatDate(duplicateChannel.createdAt) : '알 수 없음';
        
        const platformNames = {
          youtube: 'YouTube',
          tiktok: 'TikTok', 
          instagram: 'Instagram'
        };
        const platformName = platformNames[platform] || platform;
        
        return {
          exists: true,
          message: `이미 등록한 ${platformName} 채널입니다. (등록일: ${registrationDate})`
        };
      }
      
             // 플랫폼당 여러 채널 허용 - 동일한 URL만 차단
    }
    
    console.log('중복 채널 없음');
    return {
      exists: false,
      message: ''
    };
    
  } catch (error) {
    console.error('중복 검사 중 오류 발생:', error);
    return {
      exists: true,
      message: '중복 검사 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    };
  }
}

// URL 정규화 함수 (플랫폼별 일관된 형태로 변환)
function normalizeUrl(url, platform = 'youtube') {
  try {
    let normalized = url.trim().toLowerCase();
    
    // 공통: 끝의 슬래시 제거
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    // 공통: 쿼리 파라미터 제거
    const questionMarkIndex = normalized.indexOf('?');
    if (questionMarkIndex !== -1) {
      normalized = normalized.substring(0, questionMarkIndex);
    }
    
    // 플랫폼별 정규화
    switch (platform) {
      case 'youtube':
        // @핸들명만 있는 경우 전체 URL로 변환
        if (normalized.startsWith('@')) {
          normalized = `https://www.youtube.com/${normalized}`;
        }
        // Studio 링크는 허용하지 않음: 그대로 두어 검증에서 실패시키기
        // www 추가 (이미 www가 있는지 확인)
        if (normalized.includes('youtube.com/') && !normalized.includes('www.youtube.com/')) {
          normalized = normalized.replace('youtube.com/', 'www.youtube.com/');
        }
        if (normalized.includes('https://youtube.com') && !normalized.includes('https://www.youtube.com')) {
          normalized = normalized.replace('https://youtube.com', 'https://www.youtube.com');
        }
        break;
        
      case 'tiktok':
        // @사용자명만 있는 경우 전체 URL로 변환
        if (normalized.startsWith('@')) {
          normalized = `https://www.tiktok.com/${normalized}`;
        }
        // www 추가 (이미 www가 있는지 확인)
        if (normalized.includes('tiktok.com/') && !normalized.includes('www.tiktok.com/')) {
          normalized = normalized.replace('tiktok.com/', 'www.tiktok.com/');
        }
        if (normalized.includes('https://tiktok.com') && !normalized.includes('https://www.tiktok.com')) {
          normalized = normalized.replace('https://tiktok.com', 'https://www.tiktok.com');
        }
        break;
        
      case 'instagram':
        // 사용자명만 있는 경우 전체 URL로 변환
        if (!normalized.startsWith('http')) {
          normalized = `https://www.instagram.com/${normalized}`;
        }
        // www 추가 (이미 www가 있는지 확인)
        if (normalized.includes('instagram.com/') && !normalized.includes('www.instagram.com/')) {
          normalized = normalized.replace('instagram.com/', 'www.instagram.com/');
        }
        if (normalized.includes('https://instagram.com') && !normalized.includes('https://www.instagram.com')) {
          normalized = normalized.replace('https://instagram.com', 'https://www.instagram.com');
        }
        break;
    }
    
    console.log(`URL 정규화 (${platform}):`, url, '->', normalized);
    return normalized;
  } catch (error) {
    console.error('URL 정규화 중 오류:', error);
    return url.trim().toLowerCase();
  }
}

// === 사용자 가이드 섹션 인터랙션 함수들 ===

// 사용자 가이드 섹션 초기화
function initializeUserGuide() {
  console.log('사용자 가이드 초기화 중...');
  
  // 플랫폼 탭 초기화
  initializePlatformGuideTabs();
  
  // FAQ 아코디언 초기화
  initializeFAQ();
  
  // 단계별 가이드 애니메이션 초기화
  initializeStepGuideAnimations();
  
  // 데모 복사 버튼 초기화
  initializeDemoCopyButton();
  
  // 고객 지원 버튼 초기화
  initializeSupportButton();
}

// 플랫폼 가이드 탭 전환 기능
function initializePlatformGuideTabs() {
  const platformTabs = document.querySelectorAll('.platform-tab');
  const platformInstructions = document.querySelectorAll('.platform-instruction');
  
  if (platformTabs.length === 0) return;
  
  platformTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      
      const platform = tab.dataset.platform;
      if (!platform) return;
      
      // 기존 활성 탭 제거
      platformTabs.forEach(t => t.classList.remove('active'));
      platformInstructions.forEach(inst => inst.classList.remove('active'));
      
      // 새 탭 활성화
      tab.classList.add('active');
      
      // 해당 플랫폼 설명 표시
      const targetInstruction = document.querySelector(`.platform-instruction[data-platform="${platform}"]`);
      if (targetInstruction) {
        targetInstruction.classList.add('active');
      }
      
      // 부드러운 전환 효과
      tab.style.transform = 'scale(0.98)';
      setTimeout(() => {
        tab.style.transform = 'scale(1)';
      }, 150);
    });
  });
}

// FAQ 아코디언 기능
function initializeFAQ() {
  const faqQuestions = document.querySelectorAll('.faq-question');
  
  if (faqQuestions.length === 0) return;
  
  faqQuestions.forEach(question => {
    question.addEventListener('click', (e) => {
      e.preventDefault();
      
      const faqItem = question.closest('.faq-item');
      const faqId = question.dataset.faq;
      const answer = document.querySelector(`.faq-answer[data-faq="${faqId}"]`);
      
      if (!faqItem || !answer) return;
      
      const isActive = faqItem.classList.contains('active');
      
      // 모든 FAQ 닫기
      document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('active');
      });
      
      document.querySelectorAll('.faq-answer').forEach(ans => {
        ans.style.maxHeight = '0';
        ans.style.padding = '0 1rem';
      });
      
      // 클릭한 FAQ가 닫혀있었다면 열기
      if (!isActive) {
        faqItem.classList.add('active');
        answer.style.maxHeight = '200px';
        answer.style.padding = '1rem';
        
        // 스크롤하여 FAQ가 보이도록 조정
        setTimeout(() => {
          const rect = faqItem.getBoundingClientRect();
          const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
          
          if (!isVisible) {
            faqItem.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest',
              inline: 'nearest'
            });
          }
        }, 300);
      }
      
      // 마이크로 인터랙션 효과
      question.style.transform = 'scale(0.98)';
      setTimeout(() => {
        question.style.transform = 'scale(1)';
      }, 150);
    });
  });
}

// 단계별 가이드 애니메이션 효과
function initializeStepGuideAnimations() {
  const stepItems = document.querySelectorAll('.step-guide-item');
  
  if (stepItems.length === 0) return;
  
  // Intersection Observer로 단계별 애니메이션 트리거
  const stepObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const stepItem = entry.target;
        const stepNumber = stepItem.dataset.step;
        
        // 지연 시간을 두고 활성화
        setTimeout(() => {
          stepItem.classList.add('active');
          
          // 단계 완료 시뮬레이션 (데모 목적)
          if (stepNumber === '1') {
            setTimeout(() => {
              simulateStepCompletion(stepItem);
            }, 2000);
          }
        }, parseInt(stepNumber) * 300);
        
        stepObserver.unobserve(stepItem);
      }
    });
  }, {
    threshold: 0.3,
    rootMargin: '0px 0px -100px 0px'
  });
  
  stepItems.forEach(item => {
    stepObserver.observe(item);
  });
}

// 단계 완료 시뮬레이션
function simulateStepCompletion(stepItem) {
  const stepNumber = stepItem.querySelector('.step-number');
  if (!stepNumber) return;
  
  // 완료 체크 마크 효과
  const originalContent = stepNumber.innerHTML;
  stepNumber.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
  stepNumber.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.15) 100%)';
  stepNumber.style.borderColor = '#22c55e';
  stepNumber.style.color = '#22c55e';
  
  // 2초 후 원래 상태로 복원
  setTimeout(() => {
    stepNumber.innerHTML = originalContent;
    stepNumber.style.background = '';
    stepNumber.style.borderColor = '';
    stepNumber.style.color = '';
  }, 2000);
}

// 데모 복사 버튼 기능
function initializeDemoCopyButton() {
  const demoCopyBtn = document.querySelector('.demo-copy-btn');
  
  if (!demoCopyBtn) return;
  
  demoCopyBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    const demoKey = document.querySelector('.demo-key');
    if (!demoKey) return;
    
    const keyValue = demoKey.textContent.trim();
    const originalContent = demoCopyBtn.innerHTML;
    
    // 복사 진행 상태 표시
    demoCopyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>';
    demoCopyBtn.style.opacity = '0.6';
    
    copyToClipboard(keyValue)
      .then(() => {
        // 성공 상태 표시
        demoCopyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
        demoCopyBtn.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.15) 100%)';
        demoCopyBtn.style.color = '#22c55e';
        demoCopyBtn.style.opacity = '1';
        
        // 피드백 메시지 표시
        showNotification('데모 이모지 키가 복사되었습니다! 📋', 'success');
        
        // 키 펄스 효과
        demoKey.style.animation = 'none';
        setTimeout(() => {
          demoKey.style.animation = 'pulseEmoji 1s ease-in-out 3';
        }, 50);
      })
      .catch(() => {
        // 실패 상태 표시
        demoCopyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>';
        demoCopyBtn.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.15) 100%)';
        demoCopyBtn.style.color = '#ef4444';
        demoCopyBtn.style.opacity = '1';
        
        showNotification('복사 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
      })
      .finally(() => {
        // 1.5초 후 원래 상태로 복원
        setTimeout(() => {
          demoCopyBtn.innerHTML = originalContent;
          demoCopyBtn.style.background = '';
          demoCopyBtn.style.color = '';
          demoCopyBtn.style.opacity = '';
        }, 1500);
      });
  });
}

// 고객 지원 버튼 기능
function initializeSupportButton() {
  const supportBtn = document.querySelector('.contact-support-btn');
  
  if (!supportBtn) return;
  
  supportBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    // 마이크로 인터랙션 효과
    supportBtn.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      supportBtn.style.transform = 'scale(1)';
      
      // 실제 환경에서는 고객 지원 채팅이나 메일 등으로 연결
      showNotification('고객 지원 서비스 준비 중입니다. 곧 이용하실 수 있습니다! 🎧', 'info');
      
      // 개발용: FAQ로 스크롤
      const faqSection = document.querySelector('.help-card');
      if (faqSection) {
        faqSection.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }, 150);
  });
}

// 실시간 가이드 업데이트 (채널 등록 상태에 따라)
function updateGuideProgress(channelData) {
  if (!channelData) return;
  
  const timelineItems = document.querySelectorAll('.timeline-item');
  if (timelineItems.length === 0) return;
  
  // 상태에 따른 타임라인 업데이트
  timelineItems.forEach(item => {
    item.classList.remove('active', 'completed');
  });
  
  if (channelData.status === 'pending') {
    // 등록 완료, 검수 중
    timelineItems[0]?.classList.add('completed');
    timelineItems[1]?.classList.add('active');
  } else if (channelData.status === 'verified') {
    // 모든 단계 완료
    timelineItems.forEach(item => {
      item.classList.add('completed');
    });
    timelineItems[2]?.classList.add('active');
  } else if (channelData.status === 'rejected') {
    // 검증 실패
    timelineItems[0]?.classList.add('completed');
    timelineItems[1]?.classList.add('rejected');
  }
}

// 가이드 섹션 가시성 토글
function toggleGuideSection(show = true) {
  const guideSection = document.querySelector('.user-guide-section');
  if (!guideSection) return;
  
  if (show) {
    guideSection.style.display = 'block';
    guideSection.style.opacity = '0';
    guideSection.style.transform = 'translateY(20px)';
    
    // 부드러운 나타나기 효과
    setTimeout(() => {
      guideSection.style.transition = 'all 0.5s ease';
      guideSection.style.opacity = '1';
      guideSection.style.transform = 'translateY(0)';
    }, 100);
  } else {
    guideSection.style.transition = 'all 0.3s ease';
    guideSection.style.opacity = '0';
    guideSection.style.transform = 'translateY(-20px)';
    
    setTimeout(() => {
      guideSection.style.display = 'none';
    }, 300);
  }
}

// 언어 변경 시 토글 라벨 동기화
window.syncDynamicI18n = function() {
  const toggleText = document.getElementById('toggle-content-text');
  const toggleBtn = document.getElementById('toggle-content-links');
  if (!toggleText || !toggleBtn) return;
  const isExpanded = toggleBtn.classList.contains('expanded');
  toggleText.textContent = (window.i18next && window.i18next.t(isExpanded ? 'channelManagement.contentLinks.hideLinks' : 'channelManagement.contentLinks.showLinks')) || toggleText.textContent;
  // 모달 내 도움말 텍스트도 동기화
  const helpText = document.getElementById('help-text');
  if (helpText && window.i18next) {
    helpText.textContent = window.i18next.t('channelManagement.modal.helpText');
  }
};