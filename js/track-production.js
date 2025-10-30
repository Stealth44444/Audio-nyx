// 트랙 제작 페이지 JavaScript
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  where,
  orderBy,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';

import { 
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js';

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-storage.js';

import { db } from './firebase.js';

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

// 토스트 메시지 표시 함수
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// 5단계 상태 뱃지 렌더링 함수
function renderStatusBadge(status) {
  const statusMap = {
    'payment-pending': { class: 'payment-pending', i18nKey: 'trackProduction.status.paymentPending', default: '입금 대기' },
    'production': { class: 'production', i18nKey: 'trackProduction.status.production', default: '제작중' },
    'distribution-pending': { class: 'distribution-pending', i18nKey: 'trackProduction.status.distributionPending', default: '유통 대기' },
    'distributing': { class: 'distributing', i18nKey: 'trackProduction.status.distributing', default: '유통중' },
    'distributed': { class: 'distributed', i18nKey: 'trackProduction.status.distributed', default: '유통 완료' },
    // 구 버전 호환
    '미제작': { class: 'payment-pending', i18nKey: 'trackProduction.status.paymentPending', default: '입금 대기' },
    '제작중': { class: 'production', i18nKey: 'trackProduction.status.production', default: '제작중' },
    '제작완료': { class: 'distribution-pending', i18nKey: 'trackProduction.status.distributionPending', default: '유통 대기' },
    '완료': { class: 'distributed', i18nKey: 'trackProduction.status.distributed', default: '유통 완료' }
  };
  
  const statusConfig = statusMap[status] || statusMap['payment-pending'];
  
  return `<div class="request-card-status-badge status-badge-${statusConfig.class}">
    <div class="status-dot"></div>
    <span data-i18n="${statusConfig.i18nKey}">${statusConfig.default}</span>
  </div>`;
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
  console.log('트랙 제작 페이지 초기화 중...');
  
  // 페이지 애니메이션 초기화
  initPageAnimations();

  
  // DOM 요소
  const requestForm = document.getElementById('track-request-form');
  const titleInput = document.getElementById('track-title');
  const artistInput = document.getElementById('track-artist');
  const bpmInput = document.getElementById('track-bpm');
  const genreSelect = document.getElementById('track-genre');
  const descriptionInput = document.getElementById('track-description');
  const refUrlInput = document.getElementById('track-ref-url');
  const emailInput = document.getElementById('track-email');
  const depositorInput = document.getElementById('track-depositor');
  const coverInput = document.getElementById('track-cover');
  const coverPreview = document.getElementById('cover-preview');
  const coverPreviewImg = document.getElementById('cover-preview-img');
  const removeCoverBtn = document.getElementById('remove-cover');
  const submitBtn = document.getElementById('submit-request');
  const requestList = document.getElementById('request-list');
  const loadingEl = document.getElementById('request-loading');
  const noRequestsEl = document.getElementById('no-requests');
  
  // 제한 관련 DOM 요소
  const requestStatusBar = document.getElementById('request-status-bar');
  const currentRequestCount = document.getElementById('current-request-count');
  const maxRequestsCount = document.getElementById('max-requests-count');
  const limitWarning = document.getElementById('limit-warning');
  const formCard = document.querySelector('.form-card');
  
  // 오류 메시지 요소
  const titleError = document.getElementById('title-error');
  const artistError = document.getElementById('artist-error');
  const bpmError = document.getElementById('bpm-error');
  const genreError = document.getElementById('genre-error');
  const descriptionError = document.getElementById('description-error');
  const urlError = document.getElementById('url-error');
  const emailError = document.getElementById('email-error');
  const coverError = document.getElementById('cover-error');
  const depositorError = document.getElementById('depositor-error');
  
  // 커버 아트 파일 관리
  let selectedCoverFile = null;
  
  // 커버 아트 업로드 처리
  if (coverInput) {
    coverInput.addEventListener('change', async function(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      // 파일 크기 체크 (10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        if (coverError) {
          coverError.textContent = '파일 크기는 10MB를 초과할 수 없습니다.';
          coverError.style.display = 'block';
        }
        coverInput.value = '';
        return;
      }
      
      // 파일 형식 체크
      if (!file.type.match('image/(png|jpeg|jpg)')) {
        if (coverError) {
          coverError.textContent = 'PNG, JPG, JPEG 파일만 업로드 가능합니다.';
          coverError.style.display = 'block';
        }
        coverInput.value = '';
        return;
      }
      
      // 이미지 미리보기
      const reader = new FileReader();
      reader.onload = function(e) {
        coverPreviewImg.src = e.target.result;
        coverPreview.style.display = 'block';
        selectedCoverFile = file;
        if (coverError) coverError.style.display = 'none';
      };
      reader.readAsDataURL(file);
    });
  }
  
  // 번역 강제 동기화 (일부 정적 라벨이 남아있는 경우 대비)
  try {
    if (window.i18next && typeof window.i18next.t === 'function') {
      const syncCoverHints = () => {
        const coverHintEl = document.querySelector('[data-i18n="trackProduction.form.coverHint"]');
        if (coverHintEl) coverHintEl.innerHTML = window.i18next.t('trackProduction.form.coverHint');
        const coverUploadEl = document.querySelector('[data-i18n="trackProduction.form.coverUpload"]');
        if (coverUploadEl) coverUploadEl.innerHTML = window.i18next.t('trackProduction.form.coverUpload');
        const featureEls = [
          ['trackProduction.promo.feature1'],
          ['trackProduction.promo.feature2'],
          ['trackProduction.promo.feature3']
        ];
        featureEls.forEach(([key]) => {
          const el = document.querySelector(`[data-i18n="${key}"]`);
          if (el) el.innerHTML = window.i18next.t(key);
        });
      };
      syncCoverHints();
      // 언어 변경 후에도 동기화되도록 전역 훅 제공
      window.syncDynamicI18n = () => {
        try { syncCoverHints(); } catch (_) {}
      };
    }
  } catch (_) {}

  // 커버 아트 제거
  if (removeCoverBtn) {
    removeCoverBtn.addEventListener('click', function() {
      coverInput.value = '';
      coverPreview.style.display = 'none';
      coverPreviewImg.src = '';
      selectedCoverFile = null;
    });
  }
  
  // Firebase 초기화 확인
  if (!db) {
    console.error('Firebase DB가 초기화되지 않았습니다.');
    showNotification('데이터베이스 연결에 문제가 있습니다. 페이지를 새로고침하거나 나중에 다시 시도해주세요.', true);
    return;
  }
  
  // 인증 상태 확인
  const auth = getAuth();
  let currentUser = null; // 인증 전
  // const MAX_REQUESTS = 2; // 최대 요청 횟수 - 제한 제거
  let userRequestCount = 0; // 사용자 현재 요청 횟수
  // if (maxRequestsCount) {
  //   maxRequestsCount.textContent = MAX_REQUESTS;
  // }

  // 언어 변경 후 동적 텍스트 동기화 훅
  window.syncDynamicI18n = function() {
    // 제출 버튼 라벨
    if (submitBtn && !submitBtn.disabled) {
      submitBtn.textContent = (window.i18next && window.i18next.t('trackProduction.form.submit')) || submitBtn.textContent;
    }
    // 제한 경고 문구
    if (limitWarning && limitWarning.style.display !== 'none') {
      const span = limitWarning.querySelector('span');
      if (span) span.textContent = (window.i18next && window.i18next.t('trackProduction.limit.exceeded')) || span.textContent;
    }
    // 요청 카운트 단위 라벨은 HTML 내 data-i18n로 translate()가 처리
  };
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user; // 로그인 또는 익명 사용자
      console.log('인증된 사용자:', user.uid, 'isAnonymous:', !!user.isAnonymous);
      setupRequestListener(user.uid);
    } else {
      console.log('사용자 인증 없음 → 익명 인증 시도');
      try {
        await signInAnonymously(auth);
        // onAuthStateChanged가 다시 호출되어 리스트너가 설정됩니다.
      } catch (e) {
        console.error('익명 인증 실패:', e);
        // 안전장치: 인증 실패 시 임시 키로 빈 목록 표시
        setupRequestListener('anonymous');
      }
    }
  });
  
  // 요청 횟수 제한 체크 함수 - 제한 제거됨
  function checkRequestLimit(requestCount) {
    userRequestCount = requestCount;
    
    // 제한 없이 항상 요청 가능
    if (requestStatusBar) {
      requestStatusBar.style.display = 'none'; // 상태 바 숨김
    }
    if (limitWarning) {
      limitWarning.style.display = 'none'; // 경고 숨김
    }
    if (formCard) {
      formCard.classList.remove('form-disabled');
    }
    
    return true; // 항상 요청 가능
  }
  
  // 폼 제출 처리 (재확인 모달 선표시)
  requestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('트랙 요청 폼 제출 시도 - 재확인 모달 표시');
    
    // currentUser가 항상 객체를 가지므로 null 체크 불필요
    // if (!currentUser) {
    //   showNotification('로그인 후 이용 가능합니다.', true);
    //   return;
    // }
    
    // 요청 횟수 제한 체크 - 제한 제거됨
    // if (userRequestCount >= MAX_REQUESTS) {
    //   showNotification('최대 요청 횟수(2회)에 도달했습니다.', true);
    //   return;
    // }
    
    // 입력값 가져오기
    const title = titleInput.value.trim();
    const artist = artistInput.value.trim();
    const bpm = parseInt(bpmInput.value.trim());
    const genre = genreSelect.value;
    const description = descriptionInput.value.trim();
    const refUrl = refUrlInput.value.trim();
    const email = emailInput.value.trim();
    const depositor = depositorInput ? depositorInput.value.trim() : '';
    
    // 입력 검증
    resetErrors();
    if (!validateForm(title, artist, bpm, genre, description, refUrl, email, depositor)) {
      return;
    }
    
    // 재확인 모달 표시
    const confirmModal = document.getElementById('confirm-submit-modal');
    const confirmClose = document.getElementById('confirm-modal-close');
    const confirmCancel = document.getElementById('confirm-cancel');
    const confirmAgree = document.getElementById('confirm-agree');
    const confirmTermsAgree = document.getElementById('confirm-terms-agree');
    const confirmSubmit = document.getElementById('confirm-submit');

    if (!confirmModal) return;
    
    function openConfirm() {
      confirmModal.style.display = 'flex';
      setTimeout(() => confirmModal.classList.add('show'), 10);
    }
    function closeConfirm() {
      confirmModal.classList.remove('show');
      setTimeout(() => confirmModal.style.display = 'none', 200);
    }

    openConfirm();

    // 두 개의 체크박스 모두 체크해야 버튼 활성화
    function checkAllAgreements() {
      const allChecked = confirmAgree && confirmAgree.checked && 
                        confirmTermsAgree && confirmTermsAgree.checked;
      if (confirmSubmit) {
        confirmSubmit.disabled = !allChecked;
      }
    }

    if (confirmAgree && confirmTermsAgree) {
      confirmAgree.checked = false;
      confirmTermsAgree.checked = false;
      confirmSubmit.disabled = true;
      
      confirmAgree.addEventListener('change', checkAllAgreements);
      confirmTermsAgree.addEventListener('change', checkAllAgreements);
    }

    // 닫기/취소
    if (confirmClose) confirmClose.addEventListener('click', closeConfirm, { once: true });
    if (confirmCancel) confirmCancel.addEventListener('click', closeConfirm, { once: true });

    // 확정 제출 핸들러
    if (confirmSubmit) {
      confirmSubmit.addEventListener('click', async () => {
        if (!confirmAgree || !confirmAgree.checked || 
            !confirmTermsAgree || !confirmTermsAgree.checked) {
          showNotification('모든 항목에 동의해주세요.', true);
          return;
        }
        closeConfirm();
        try {
          // 로딩 상태 표시
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span class="loading-spinner"></span> ${(window.i18next && window.i18next.t('common.loading')) || '처리 중...'}`;
          console.log('Firestore에 트랙 요청 데이터 추가 시도...');

          // 사용자 정보 가져오기
          let userInfo = { nickname: '', phone: '' };
          try {
            if (currentUser && !currentUser.isAnonymous) {
              const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                userInfo.nickname = userData.nickname || '';
                userInfo.phone = userData.phone || '';
              }
            }
          } catch (userError) {
            console.error('사용자 정보 가져오기 오류:', userError);
          }

          // 커버 아트 업로드 처리
          let coverArtUrl = null;
          let coverArtMetadata = null;
          
          if (selectedCoverFile) {
            try {
              console.log('커버 아트 업로드 시작:', selectedCoverFile.name);
              console.log('현재 사용자 UID:', (currentUser && currentUser.uid) || 'unknown');
              console.log('파일 크기:', selectedCoverFile.size, '바이트');
              console.log('파일 타입:', selectedCoverFile.type);
              
              const storage = getStorage();
              const timestamp = Date.now();
              // 파일명에서 특수문자 제거
              const sanitizedFileName = selectedCoverFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
              const fileName = `cover_arts/${(currentUser && currentUser.uid) || 'anonymous'}/${timestamp}_${sanitizedFileName}`;
              const storageRef = ref(storage, fileName);
              
              console.log('업로드 경로:', fileName);
              
              // 파일 업로드
              const snapshot = await uploadBytes(storageRef, selectedCoverFile, {
                contentType: selectedCoverFile.type,
                customMetadata: {
                  uploadedBy: currentUser.uid,
                  uploadedAt: new Date().toISOString(),
                  originalName: selectedCoverFile.name
                }
              });
              console.log('커버 아트 업로드 완료:', snapshot.metadata.fullPath);
              
              // 다운로드 URL 가져오기
              coverArtUrl = await getDownloadURL(storageRef);
              console.log('커버 아트 URL 생성 완료:', coverArtUrl);
              
              coverArtMetadata = {
                name: selectedCoverFile.name,
                sanitizedName: sanitizedFileName,
                size: selectedCoverFile.size,
                type: selectedCoverFile.type,
                path: fileName,
                uploadedAt: new Date().toISOString()
              };
              
              console.log('커버 아트 메타데이터:', coverArtMetadata);
            } catch (uploadError) {
              console.error('커버 아트 업로드 오류:', uploadError);
              console.error('오류 코드:', uploadError.code);
              console.error('오류 메시지:', uploadError.message);
              
              if (uploadError.code === 'storage/unauthorized') {
                console.error('Firebase Storage 권한 오류 - Storage 규칙을 확인하세요');
                showNotification('커버 아트 업로드 권한이 없습니다. 관리자에게 문의하세요.', true);
              } else {
                showNotification('커버 아트 업로드 중 오류가 발생했습니다. 커버 아트 없이 계속 진행합니다.', false);
              }
              
              // 커버 아트 없이 계속 진행
              coverArtUrl = null;
              coverArtMetadata = null;
            }
          }

          const uidForWrite = (currentUser && currentUser.uid) || 'anonymous';
          const docRef = await addDoc(collection(db, 'track_requests'), {
            uid: uidForWrite,
            title,
            artist,
            bpm,
            genre,
            description,
            refUrl: refUrl || null,
            status: '미제작',
            email,
            depositor,
            coverArtUrl: coverArtUrl,
            coverArtMetadata: coverArtMetadata,
            hasCoverArt: !!selectedCoverFile,
            userNickname: userInfo.nickname,
            userPhone: userInfo.phone,
            createdAt: serverTimestamp()
          });
          console.log('트랙 요청 추가 성공:', docRef.id);
          showNotification('트랙 제작 요청이 성공적으로 등록되었습니다.');
          
          resetForm();
        } catch (error) {
          console.error('트랙 요청 등록 중 오류 발생:', error);
          showNotification('요청 등록 중 오류가 발생했습니다. 다시 시도해주세요.', true);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = (window.i18next && window.i18next.t('trackProduction.form.submit')) || '요청 제출';
        }
      }, { once: true });
    }
  });
  
  // 실시간 요청 목록 리스너 설정
  function setupRequestListener(userId) {
    console.log('사용자 요청 목록 리스너 설정 시작 - User ID:', userId);
    try {
      const requestsQuery = query(
        collection(db, 'track_requests'),
        where('uid', '==', userId),
        orderBy('createdAt', 'desc') // 최신순 정렬
      );
      
      onSnapshot(requestsQuery, (snapshot) => {
        console.log('요청 목록 업데이트 수신 - Snapshot empty:', snapshot.empty, 'Size:', snapshot.size);
        // 로딩 상태 숨기기
        loadingEl.style.display = 'none';
        
        // 요청 횟수 제한 체크
        const requestCount = snapshot.size;
        checkRequestLimit(requestCount);
        
        if (snapshot.empty) {
          // 요청이 없는 경우
          console.log('등록된 요청 없음 - User ID:', userId);
          requestList.innerHTML = '';
          noRequestsEl.style.display = 'block';
          return;
        }
        
        // 요청이 있는 경우
        console.log(`${snapshot.size}개의 요청 데이터 수신 - User ID:`, userId);
        noRequestsEl.style.display = 'none';
        
        // 목록 갱신 - 최신 카드 형식
        requestList.innerHTML = '';
        snapshot.forEach((doc, index) => {
          const request = doc.data();
          const requestId = doc.id;
          const createdAt = request.createdAt?.toDate() || new Date();
          
          // 날짜 포맷팅 (YYYY-MM-DD 형식)
          const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };
          
          // 카드 생성
          const card = document.createElement('div');
          card.className = 'request-card';
          card.style.opacity = '0';
          card.style.transform = 'translateY(10px)';
          
          card.innerHTML = `
            <div class="request-card-header">
              <div class="request-card-title-area">
                <h3 class="request-card-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 18V5l12-2v13" stroke-width="2"/>
                    <circle cx="6" cy="18" r="3" stroke-width="2"/>
                    <circle cx="18" cy="16" r="3" stroke-width="2"/>
                  </svg>
                  ${request.title || '제목 없음'}
                </h3>
                <div class="request-card-artist">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke-width="2"/>
                    <circle cx="12" cy="7" r="4" stroke-width="2"/>
                  </svg>
                  ${request.artist || '아티스트 미정'}
                </div>
              </div>
              ${renderStatusBadge(request.status || 'payment-pending')}
            </div>
            <div class="request-card-body">
              <div class="request-card-meta-item">
                <div class="request-card-meta-label" data-i18n="trackProduction.table.genre">장르</div>
                <div class="request-card-meta-value">${request.genre || '-'}</div>
              </div>
              <div class="request-card-meta-item">
                <div class="request-card-meta-label" data-i18n="trackProduction.table.bpm">BPM</div>
                <div class="request-card-meta-value">${request.bpm || '-'}</div>
              </div>
              <div class="request-card-meta-item">
                <div class="request-card-meta-label" data-i18n="trackProduction.table.requestDate">요청일</div>
                <div class="request-card-meta-value">${formatDate(createdAt)}</div>
              </div>
              <div class="request-card-meta-item">
                <div class="request-card-meta-label">이메일</div>
                <div class="request-card-meta-value" style="font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis;">${request.email || '-'}</div>
              </div>
            </div>
          `;
          
          requestList.appendChild(card);
          
          // 애니메이션
          setTimeout(() => {
            card.style.transition = 'all 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, index * 80);
        });
      }, (error) => {
        console.error("요청 목록 조회 중 오류 - User ID:", userId, error);
        loadingEl.style.display = 'none';
        showNotification('요청 목록을 불러오는 중 오류가 발생했습니다.', true);
      });
    } catch (setupError) {
      console.error('요청 리스너 설정 중 오류 - User ID:', userId, setupError);
      loadingEl.style.display = 'none';
      showNotification('요청 목록 조회 설정 중 오류가 발생했습니다.', true);
    }
  }
  
  // 다운로드 버튼 렌더링 함수는 더 이상 필요하지 않으므로 주석 처리 또는 삭제
  /* 
  function renderDownloadButton(mp3Url, status) {
    // mp3Url은 더 이상 사용하지 않습니다.
    if (status === '제작완료') {
      return `<span class="email-status-sent">발송 완료</span>`;
    } else if (status === '미제작' || status === '제작중') {
      return `<span class="email-status-pending">발송 전</span>`;
    } else {
      // 기타 상태 (예: 오류 등)는 그대로 표시하거나 다른 적절한 메시지 표시
      return `<span>${status}</span>`; 
    }
  }
  */
  
  // 다운로드 버튼 이벤트 핸들러 함수도 더 이상 필요하지 않으므로 주석 처리 또는 삭제
  /*
  function setupDownloadButtons() {
    document.querySelectorAll('.download-btn:not(.download-btn-disabled)').forEach(btn => {
      btn.addEventListener('click', function(e) {
        // 이미 a 태그로 다운로드가 처리되지만, 추가 로직이 필요하면 여기에 구현
        console.log('다운로드 클릭:', this.getAttribute('data-url'));
        showNotification('다운로드가 시작됩니다.');
      });
    });
  }
  */
  
  // 입력 검증 함수
  function validateForm(title, artist, bpm, genre, description, refUrl, email, depositor) {
    let isValid = true;
    
    // 제목 검증
    if (!title) {
      showError(titleInput, titleError, '트랙 제목을 입력해주세요.');
      isValid = false;
    }
    
    // 아티스트명 검증
    if (!artist) {
      showError(artistInput, artistError, '아티스트 명을 입력해주세요.');
      isValid = false;
    }
    
    // BPM 검증
    if (isNaN(bpm) || bpm < 60 || bpm > 200) {
      showError(bpmInput, bpmError, 'BPM은 60에서 200 사이의 숫자여야 합니다.');
      isValid = false;
    }
    
    // 장르 검증
    if (!genre) {
      showError(genreSelect, genreError, '장르를 선택해주세요.');
      isValid = false;
    }
    
    // 설명 검증
    if (!description) {
      showError(descriptionInput, descriptionError, '설명/요청 사항을 입력해주세요.');
      isValid = false;
    }
    
    // URL 검증 (선택 사항이므로 비어있지 않을 때만 검증)
    if (refUrl && !isValidUrl(refUrl)) {
      showError(refUrlInput, urlError, '유효한 URL을 입력해주세요. (예: https://www.youtube.com/...)');
      isValid = false;
    }
    
    // 이메일 검증
    if (!email) {
      showError(emailInput, emailError, '이메일 주소를 입력해주세요.');
      isValid = false;
    } else if (!isValidEmail(email)) {
      showError(emailInput, emailError, '유효한 이메일 주소를 입력해주세요.');
      isValid = false;
    }

    // 입금자명 검증
    if (depositorInput && !depositor) {
      showError(depositorInput, depositorError, '입금자 명을 입력해주세요.');
      isValid = false;
    }
    
    return isValid;
  }
  
  // 이메일 유효성 검사 함수
  function isValidEmail(email) {
    // 간단한 이메일 정규식
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // URL 유효성 검사
  function isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  // 오류 표시 함수
  function showError(inputElement, errorElement, message) {
    console.log('오류 표시:', message);
    errorElement.textContent = message;
    inputElement.classList.add('input-error');
    
    // 입력 필드에 포커스
    inputElement.focus();
    
    // 잠시 후 에러 표시 제거
    setTimeout(() => {
      inputElement.classList.remove('input-error');
    }, 3000);
  }
  
  // 오류 메시지 초기화
  function resetErrors() {
    titleError.textContent = '';
    bpmError.textContent = '';
    genreError.textContent = '';
    descriptionError.textContent = '';
    urlError.textContent = '';
    emailError.textContent = '';
    if (depositorError) depositorError.textContent = '';
    
    titleInput.classList.remove('input-error');
    bpmInput.classList.remove('input-error');
    genreSelect.classList.remove('input-error');
    descriptionInput.classList.remove('input-error');
    refUrlInput.classList.remove('input-error');
    emailInput.classList.remove('input-error');
    if (depositorInput) depositorInput.classList.remove('input-error');
  }
  
  // 폼 초기화
  function resetForm() {
    requestForm.reset();
    resetErrors();
    // 커버 아트 미리보기 초기화
    if (coverPreview) coverPreview.style.display = 'none';
    if (coverPreviewImg) coverPreviewImg.src = '';
    selectedCoverFile = null;
  }
  
  // 폼 비활성화 (로그인 필요 시)
  function disableForm() {
    titleInput.disabled = true;
    bpmInput.disabled = true;
    genreSelect.disabled = true;
    descriptionInput.disabled = true;
    refUrlInput.disabled = true;
    submitBtn.disabled = true;
    
    // 안내 메시지 추가 로직도 제거하거나 주석 처리
    // const formContainer = document.querySelector('.form-container');
    // const loginMessage = document.createElement('div');
    // loginMessage.classList.add('login-required-message');
    // loginMessage.textContent = '트랙 제작 요청은 로그인 후 이용 가능합니다.';
    // formContainer.prepend(loginMessage);
  }
  
  // 알림 표시 함수
  function showNotification(message, isError = false) {
    console.log('알림 표시:', message);
    
    // 기존 알림 제거
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => {
      document.body.removeChild(notif);
    });
    
    // 임시 알림 생성
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : ''}`;
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
  
  console.log('트랙 제작 페이지 초기화 완료');
  // i18n이 먼저/나중에 초기화돼도 본문 번역이 확실히 적용되도록 재동기화
  try {
    const reapply = () => {
      if (window.i18next && typeof window.i18next.changeLanguage === 'function') {
        const lang = window.i18next.language || 'ja';
        window.i18next.changeLanguage(lang, () => {
          if (typeof window.syncDynamicI18n === 'function') {
            window.syncDynamicI18n();
          }
        });
      }
    };
    // DOM 준비 직후 1회, 그리고 약간의 지연으로 한 번 더 시도
    reapply();
    setTimeout(reapply, 200);
  } catch (e) {
    console.warn('i18n 재적용 중 경고:', e);
  }
}); 