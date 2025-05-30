// 채널 관리 페이지 JavaScript
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  doc,
  where,
  getDocs 
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js';

import { db, app } from './firebase.js';

// 현재 사용자 정보를 저장할 변수
let currentUser = null;
let channelUnsubscribe = null; // 채널 리스너 해제 함수

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
  console.log('채널 관리 페이지 초기화 중...');
  
  // Firebase 인증 초기화
  const auth = getAuth(app);
  
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
  
  // Firebase 초기화 확인
  if (!db) {
    console.error('Firebase DB가 초기화되지 않았습니다.');
    showNotification('데이터베이스 연결에 문제가 있습니다. 페이지를 새로고침하거나 나중에 다시 시도해주세요.');
    return;
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
      
      // 채널 목록 실시간 업데이트 설정
      setupChannelListener();
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
  
  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
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
    
    // URL 형식 검증 (YouTube 채널 URL)
    if (!isValidYouTubeUrl(url)) {
      showError('유효한 YouTube 채널 URL을 입력해주세요.');
      return;
    }
    
    // 로그인 상태 확인
    if (!currentUser) {
      showError('채널 등록을 위해 로그인이 필요합니다.');
      return;
    }
    
    try {
      // 로딩 상태 표시
      const submitBtn = document.getElementById('submit-channel');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading-spinner"></span> 처리 중...';
      
      // 중복 검사 수행
      console.log('채널 URL 중복 검사 중...');
      const isDuplicate = await checkDuplicateChannel(url);
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
      
      // URL 정규화
      const normalizedUrl = normalizeUrl(url);
      
      // Firestore에 채널 추가
      const docRef = await addDoc(collection(db, 'channels'), {
        url: normalizedUrl, // 정규화된 URL 저장 (중복 검사용)
        originalUrl: url, // 원본 URL 저장 (표시용)
        key: emojiKey,
        status: '검사중', // 초기 상태: 검사중
        createdAt: serverTimestamp(),
        uid: currentUser.uid // 사용자 UID 추가
      });
      
      // 발급된 키 표시
      document.getElementById('issued-key-container').style.display = 'block';
      document.getElementById('issued-key').textContent = emojiKey;
      
      // 발급된 키 복사 버튼 이벤트 리스너 추가
      document.getElementById('copy-issued-key').addEventListener('click', function() {
        const key = document.getElementById('issued-key').textContent;
        const button = this;
        const originalContent = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg><span>복사됨</span>';
        copyToClipboard(key)
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
            button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg><span>실패</span>';
            button.style.background = 'rgba(220, 53, 69, 0.2)';
            button.style.borderColor = 'rgba(220, 53, 69, 0.4)';
            setTimeout(() => {
              button.innerHTML = originalContent;
              button.style.background = '';
              button.style.borderColor = '';
              button.disabled = false;
            }, 1500);
          });
      });
      
      console.log('채널 추가 성공:', docRef.id);
      
      // 등록 확인 후 모달 닫기
      setTimeout(() => {
      closeModal();
      }, 2000);
      
      // 서버 API 호출 (Cloud Function)
      try {
        console.log('서버 API 호출 시도...');
        const response = await fetch('/api/registerChannel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: docRef.id, url: url }),
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
  
  // Firestore 채널 목록 실시간 리스너 설정
  function setupChannelListener() {
    console.log('채널 목록 리스너 설정 중...');
    
    if (!currentUser) {
      console.log('사용자가 로그인하지 않음, 리스너 설정 건너뜀');
      return;
    }
    
    try {
      // 현재 사용자의 채널만 가져오기 (orderBy 제거하여 인덱스 오류 방지)
      const channelsQuery = query(
        collection(db, 'channels'),
        where('uid', '==', currentUser.uid)
      );
      
      // 실시간 리스너 설정
      channelUnsubscribe = onSnapshot(channelsQuery, (snapshot) => {
        console.log('채널 목록 업데이트됨, 문서 수:', snapshot.size);
        
        // 클라이언트에서 정렬 수행
        const userChannels = snapshot.docs.sort((a, b) => {
          const aTime = a.data().createdAt;
          const bTime = b.data().createdAt;
          
          // createdAt이 없는 경우 처리
          if (!aTime && !bTime) return 0;
          if (!aTime) return 1;
          if (!bTime) return -1;
          
          // Firestore Timestamp 객체인 경우
          if (aTime.toDate && bTime.toDate) {
            return bTime.toDate().getTime() - aTime.toDate().getTime();
          }
          
          // Date 객체인 경우
          if (aTime instanceof Date && bTime instanceof Date) {
            return bTime.getTime() - aTime.getTime();
          }
          
          return 0;
        });
        
        console.log('현재 사용자의 채널 수:', userChannels.length);
        
        // 로딩 숨기기
        if (loadingEl) {
          loadingEl.style.display = 'none';
        }
        
        if (userChannels.length === 0) {
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
          renderChannelTable(userChannels);
          
          // 카드 그리드 렌더링 (모바일)
          renderChannelCards(userChannels);
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
      
      // 복사 버튼에 이벤트 리스너 추가 (시각적 피드백 포함)
      const copyBtn = row.querySelector('.btn-copy-key');
      if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const button = copyBtn;
          const originalContent = button.innerHTML;
          button.disabled = true;
          button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
          copyToClipboard(data.key)
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
        });
      }
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
          <a href="${displayUrl}" target="_blank" class="channel-url-display">${truncateUrl(displayUrl)}</a>
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
      
      // 복사 버튼에 이벤트 리스너 추가 (시각적 피드백 포함)
      const copyBtn = card.querySelector('.btn-copy-key');
      if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const button = copyBtn;
          const originalContent = button.innerHTML;
          button.disabled = true;
          button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
          copyToClipboard(data.key)
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
        });
      }
      
      channelCardsGrid.appendChild(card);
    });
  }
  
  // 날짜 포맷팅 함수 개선
  function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    let date;
    if (timestamp.toDate) {
      // Firestore Timestamp
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
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
      case '검증실패': return 'status-rejected';
      default: return 'status-pending';
    }
  }
  
  function getStatusColor(status) {
    switch(status) {
      case '검사중': 
        return { bg: 'rgba(255, 193, 7, 0.1)', text: '#ffc107', border: 'rgba(255, 193, 7, 0.2)' };
      case '검사완료': 
        return { bg: 'rgba(40, 167, 69, 0.1)', text: '#28a745', border: 'rgba(40, 167, 69, 0.2)' };
      case '검증실패': 
        return { bg: 'rgba(220, 53, 69, 0.1)', text: '#dc3545', border: 'rgba(220, 53, 69, 0.2)' };
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
    if (status === '검사중') {
      return `<span class="tag-pending">검사중</span>`;
    } else if (status === '검사완료') {
      return `<span class="tag-verified">검사완료</span>`;
    } else if (status === '검증실패') {
      return `<span class="tag-rejected">검증실패</span>`;
    } else {
      return `<span>${status}</span>`;
    }
  }
  
  function openModal() {
    console.log('모달 열기');
    modal.style.display = 'flex';
    urlInput.value = '';
    urlError.textContent = '';
    
    // 발급된 키 컨테이너 숨기기
    const issuedKeyContainer = document.getElementById('issued-key-container');
    if (issuedKeyContainer) {
      issuedKeyContainer.style.display = 'none';
    }

    // 모달 내용 애니메이션 초기화
    modalContent.classList.remove('closing');
    
    // 포커스를 주기 전에 모달이 표시되도록 약간의 지연 추가
    setTimeout(() => {
      urlInput.focus();
    }, 100);
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
  
  function isValidYouTubeUrl(url) {
    // YouTube 채널 URL 검증 (개선된 버전)
    const patterns = [
      /youtube\.com\/channel\//i,
      /youtube\.com\/c\//i,
      /youtube\.com\/@/i,
      /youtube\.com\/user\//i,
      /youtu\.be\//i
    ];
    
    return patterns.some(pattern => pattern.test(url));
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

// 중복 채널 검사 함수
async function checkDuplicateChannel(url) {
  try {
    // 정규화된 URL로 변환 (일관성을 위해)
    const normalizedUrl = normalizeUrl(url);
    
    // 전체 채널 컬렉션에서 해당 URL 검색
    const duplicateQuery = query(
      collection(db, 'channels'),
      where('url', '==', normalizedUrl)
    );
    
    const querySnapshot = await getDocs(duplicateQuery);
    
    if (!querySnapshot.empty) {
      // 중복된 채널이 발견됨
      const existingChannel = querySnapshot.docs[0].data();
      const registrationDate = existingChannel.createdAt ? 
        formatDate(existingChannel.createdAt) : '알 수 없음';
      
      // 현재 사용자가 등록한 채널인지 확인
      const isOwnChannel = existingChannel.uid === currentUser.uid;
      
      if (isOwnChannel) {
        return {
          exists: true,
          message: `이미 등록한 채널입니다. (등록일: ${registrationDate})`
        };
      } else {
        return {
          exists: true,
          message: `이미 등록된 채널입니다. (등록일: ${registrationDate})`
        };
      }
    }
    
    return { exists: false };
    
  } catch (error) {
    console.error('중복 검사 중 오류 발생:', error);
    // 중복 검사 실패 시에도 등록을 허용하지 않음
    return {
      exists: true,
      message: '채널 중복 검사 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    };
  }
}

// URL 정규화 함수 (일관된 형태로 변환)
function normalizeUrl(url) {
  try {
    // URL 끝의 슬래시 제거, 소문자 변환
    let normalized = url.trim().toLowerCase();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    // YouTube URL 패턴별 정규화
    // @username 형태를 channel 형태로 통일하지 않고 그대로 유지
    // (YouTube에서 @username과 /channel/은 다른 형태이므로)
    
    return normalized;
  } catch (error) {
    console.error('URL 정규화 중 오류:', error);
    return url.trim().toLowerCase();
  }
} 