// 트랙 제작 페이지 JavaScript
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  where,
  orderBy
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';

import { 
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js';

import { db } from './firebase.js';

// 애니메이션 초기화 함수 (브랜드 소개 페이지와 동일)
function initializeAnimations() {
  const animatedElements = document.querySelectorAll('[data-animate="fade-up"]');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-up');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  animatedElements.forEach(element => {
    observer.observe(element);
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

// 상태 뱃지 렌더링 함수
function renderStatusTag(status) {
  const statusMap = {
    '미제작': 'status-pending',
    '제작중': 'status-working', 
    '제작완료': 'status-done',
    '완료': 'status-done'
  };
  
  const statusTextMap = {
    '미제작': '대기중',
    '제작중': '제작중',
    '제작완료': '완료',
    '완료': '완료'
  };
  
  const className = statusMap[status] || 'status-pending';
  const displayText = statusTextMap[status] || status;
  
  return `<div class="status-tag ${className}">
    <div class="status-dot"></div>
    ${displayText}
  </div>`;
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
  console.log('트랙 제작 페이지 초기화 중...');
  
  // 애니메이션 초기화
  initializeAnimations();
  
  // DOM 요소
  const requestForm = document.getElementById('track-request-form');
  const titleInput = document.getElementById('track-title');
  const bpmInput = document.getElementById('track-bpm');
  const genreSelect = document.getElementById('track-genre');
  const descriptionInput = document.getElementById('track-description');
  const refUrlInput = document.getElementById('track-ref-url');
  const emailInput = document.getElementById('track-email');
  const submitBtn = document.getElementById('submit-request');
  const requestList = document.getElementById('request-list');
  const loadingEl = document.getElementById('request-loading');
  const noRequestsEl = document.getElementById('no-requests');
  
  // 오류 메시지 요소
  const titleError = document.getElementById('title-error');
  const bpmError = document.getElementById('bpm-error');
  const genreError = document.getElementById('genre-error');
  const descriptionError = document.getElementById('description-error');
  const urlError = document.getElementById('url-error');
  const emailError = document.getElementById('email-error');
  
  // Firebase 초기화 확인
  if (!db) {
    console.error('Firebase DB가 초기화되지 않았습니다.');
    showNotification('데이터베이스 연결에 문제가 있습니다. 페이지를 새로고침하거나 나중에 다시 시도해주세요.', true);
    return;
  }
  
  // 인증 상태 확인
  const auth = getAuth();
  let currentUser = { uid: 'anonymous', isAnonymous: true }; // 기본값을 익명 사용자로 설정
  
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user; // 로그인된 사용자로 업데이트
      console.log('로그인된 사용자:', user.uid);
      setupRequestListener(user.uid);
    } else {
      console.log('로그인되지 않은 상태, 익명 사용자로 진행합니다.');
      // 익명 사용자의 경우에도 요청 목록을 표시 (자신이 방금 등록한 것만)
      setupRequestListener(currentUser.uid); 
      // 폼 비활성화 로직 제거 또는 주석 처리
      // loadingEl.style.display = 'none';
      // noRequestsEl.textContent = '트랙 제작 요청은 로그인 후 이용 가능합니다.';
      // noRequestsEl.style.display = 'block';
      // disableForm();
    }
  });
  
  // 폼 제출 처리
  requestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('트랙 요청 폼 제출됨');
    
    // currentUser가 항상 객체를 가지므로 null 체크 불필요
    // if (!currentUser) {
    //   showNotification('로그인 후 이용 가능합니다.', true);
    //   return;
    // }
    
    // 입력값 가져오기
    const title = titleInput.value.trim();
    const bpm = parseInt(bpmInput.value.trim());
    const genre = genreSelect.value;
    const description = descriptionInput.value.trim();
    const refUrl = refUrlInput.value.trim();
    const email = emailInput.value.trim();
    
    // 입력 검증
    resetErrors();
    if (!validateForm(title, bpm, genre, description, refUrl, email)) {
      return;
    }
    
    try {
      // 로딩 상태 표시
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading-spinner"></span> 처리 중...';
      
      console.log('Firestore에 트랙 요청 데이터 추가 시도...');
      
      // Firestore에 요청 추가
      const docRef = await addDoc(collection(db, 'track_requests'), {
        uid: currentUser.uid, // 로그인 사용자 또는 'anonymous'
        title: title,
        bpm: bpm,
        genre: genre,
        description: description,
        refUrl: refUrl || null,
        status: '미제작',
        email: email,
        createdAt: serverTimestamp()
      });
      
      console.log('트랙 요청 추가 성공:', docRef.id);
      
      // 성공 메시지 표시
      showNotification('트랙 제작 요청이 성공적으로 등록되었습니다.');
      
      // 폼 초기화
      resetForm();
      
    } catch (error) {
      console.error('트랙 요청 등록 중 오류 발생:', error);
      showNotification('요청 등록 중 오류가 발생했습니다. 다시 시도해주세요.', true);
    } finally {
      // 버튼 상태 복구
      submitBtn.disabled = false;
      submitBtn.textContent = '요청 제출';
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
        
        // 목록 갱신
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
          
          // 테이블 행 생성
          const row = document.createElement('tr');
          // 애니메이션을 위한 인덱스 속성 추가
          row.style.setProperty('--row-index', index);
          
          row.innerHTML = `
            <td>${request.title}</td>
            <td>${request.genre}</td>
            <td>${request.bpm}</td>
            <td>${renderStatusTag(request.status)}</td>
            <td>${formatDate(createdAt)}</td>
          `;
          
          requestList.appendChild(row);
        });
        
        // 다운로드 버튼 이벤트 핸들러 추가
        // setupDownloadButtons(); // 더 이상 다운로드 버튼이 없으므로 주석 처리 또는 삭제
        
        // 각 행에 애니메이션 지연 클래스 추가
        document.querySelectorAll('#request-list tr').forEach((row, index) => {
          // 행 순서에 따라 애니메이션 지연 시간 설정
          setTimeout(() => {
            row.style.opacity = '1';
          }, (index % 5) * 100);
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
  function validateForm(title, bpm, genre, description, refUrl, email) {
    let isValid = true;
    
    // 제목 검증
    if (!title) {
      showError(titleInput, titleError, '트랙 제목을 입력해주세요.');
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
    
    titleInput.classList.remove('input-error');
    bpmInput.classList.remove('input-error');
    genreSelect.classList.remove('input-error');
    descriptionInput.classList.remove('input-error');
    refUrlInput.classList.remove('input-error');
    emailInput.classList.remove('input-error');
  }
  
  // 폼 초기화
  function resetForm() {
    requestForm.reset();
    resetErrors();
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
}); 