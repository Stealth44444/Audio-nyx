// js/admin.js
import { db, storage } from './firebase.js';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  signInWithRedirect,
  getRedirectResult
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js';
import {
  ref as storageRef,
  getMetadata,
  uploadBytesResumable,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-storage.js';

const PASSCODE = '6974';
const SESSION_KEY = 'audionyx_admin_unlocked';

const gateEl = document.getElementById('admin-gate');
const appEl = document.getElementById('admin-app');
const passInput = document.getElementById('admin-passcode');
const enterBtn = document.getElementById('admin-enter-btn');
const gateError = document.getElementById('admin-gate-error');
const clearSessionBtn = document.getElementById('btn-clear-session');

const projectIdEl = document.getElementById('project-id');
const collectionInput = document.getElementById('collection-input');
const loadCollectionBtn = document.getElementById('btn-load-collection');
const docListEl = document.getElementById('doc-list');

// 편집 패널 제거됨: 관련 엘리먼트 참조는 안전하게 null 처리
const currentPathEl = null;
const docJsonEl = null;
const newDocIdEl = null;
const createDocBtn = null;
const saveDocBtn = null;
const refreshDocBtn = null;
const deleteDocBtn = null;

let currentCollectionName = '';
let currentDocId = '';
let currentViewMode = 'basic'; // 'basic' or 'table'
let collectionsData = {}; // 캐시된 컬렉션 데이터
const userInfoCache = new Map(); // uid -> { username, nickname, displayName, email }

async function getUserInfoMap(userIds) {
  const result = {};
  const missing = [];
  userIds.forEach((uid) => {
    if (userInfoCache.has(uid)) {
      result[uid] = userInfoCache.get(uid);
    } else {
      missing.push(uid);
    }
  });

  if (missing.length > 0) {
    // 간단히 전체 users 스캔 (데이터 소수 가정). 규모 커지면 where(documentId() in [...])로 최적화 필요
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.forEach((u) => {
      if (missing.includes(u.id)) {
        const ud = u.data();
        const info = {
          username: ud.username || '',
          nickname: ud.nickname || '',
          displayName: ud.displayName || '',
          email: ud.email || ''
        };
        userInfoCache.set(u.id, info);
        result[u.id] = info;
      }
    });
    // 캐시에 못 채운 uid는 uid 자체를 이름으로 설정
    missing.forEach((uid) => {
      if (!result[uid]) {
        const info = { username: '', nickname: '', displayName: '', email: '' };
        userInfoCache.set(uid, info);
        result[uid] = info;
      }
    });
  }
  return result;
}

// 날짜/타임스탬프를 밀리초로 안전 변환
function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      const t = value.toDate().getTime();
      return isNaN(t) ? 0 : t;
    }
    if (typeof value.seconds === 'number') {
      return Math.floor(value.seconds * 1000);
    }
  }
  const d = new Date(value);
  const t = d.getTime();
  return isNaN(t) ? 0 : t;
}

// 안전 키 선택 유틸 (공백 포함 키 지원)
function pick(obj, candidateKeys) {
  if (!obj) return undefined;
  for (const key of candidateKeys) {
    if (key in obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      return obj[key];
    }
  }
  return undefined;
}

function formatDurationSeconds(totalSeconds) {
  if (typeof totalSeconds !== 'number' || !isFinite(totalSeconds) || totalSeconds <= 0) return '-';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDateYYMMDD(date) {
    if (!date || isNaN(date.getTime())) return '-';
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
}

async function assertAdminOrThrow() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('관리자 로그인이 필요합니다. 오른쪽 상단의 "관리자 로그인"으로 로그인하세요.');
  const token = await user.getIdTokenResult();
  const isAdmin = (!!token.claims.admin) || (user.email === 'audionyx369@gmail.com');
  if (!isAdmin) throw new Error('관리자 권한이 없습니다. 관리자 계정으로 로그인해 주세요.');
}

function normalizeBaseName(name) {
  if (!name) return '';
  const noQuery = name.split('?')[0];
  const parts = noQuery.split('/');
  const last = parts[parts.length - 1] || '';
  return (last.replace(/\.[^.]+$/, '')).trim();
}

async function buildTrackIndex() {
  const index = {};
  const snap = await getDocs(collection(db, 'track_new'));
  snap.forEach(d => {
    const t = d.data();
    const candidates = [
      t['Track Title'], t['Release Title'], t.title, t.trackTitle, t.name,
      normalizeBaseName(t.storagePath || t.path || t.filePath || ''),
      normalizeBaseName(t.downloadUrl || t.url || '')
    ].filter(Boolean);
    candidates.forEach(c => {
      const key = c.toString().toLowerCase();
      if (key) index[key] = { id: d.id, data: t };
    });
  });
  return index;
}

function unlock() {
  sessionStorage.setItem(SESSION_KEY, 'true');
  gateEl.style.display = 'none';
  appEl.style.display = 'block';
}

function lock() {
  sessionStorage.removeItem(SESSION_KEY);
  appEl.style.display = 'none';
  gateEl.style.display = 'block';
  passInput.value = '';
}

function initGate() {
  if (sessionStorage.getItem(SESSION_KEY) === 'true') {
    unlock();
  }

  enterBtn.addEventListener('click', () => {
    const value = passInput.value.trim();
    if (value === PASSCODE) {
      gateError.style.display = 'none';
      unlock();
    } else {
      gateError.style.display = 'block';
    }
  });

  passInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      enterBtn.click();
    }
  });

  if (clearSessionBtn) {
    clearSessionBtn.addEventListener('click', () => {
      lock();
    });
  }
}

function initAdminAuth() {
  const auth = getAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const badge = document.getElementById('admin-auth-badge');
  const emailEl = document.getElementById('admin-email');
  const btnLogin = document.getElementById('btn-admin-login');
  const btnLogout = document.getElementById('btn-admin-logout');

  const updateUI = (user) => {
    if (user) {
      emailEl.textContent = user.email || '';
      // 관리자 클레임 검사
      user.getIdTokenResult().then((res) => {
        const isAdmin = (!!res.claims.admin) || (user.email === 'audionyx369@gmail.com');
        badge.textContent = isAdmin ? 'ADMIN: ON' : 'ADMIN: OFF';
        badge.style.background = isAdmin ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)';
        badge.style.color = isAdmin ? '#30d158' : '#ff453a';
      });
      btnLogin.style.display = 'none';
      btnLogout.style.display = 'inline-block';
    } else {
      emailEl.textContent = '';
      badge.textContent = 'ADMIN: OFF';
      badge.style.background = 'rgba(255,69,58,0.15)';
      badge.style.color = '#ff453a';
      btnLogin.style.display = 'inline-block';
      btnLogout.style.display = 'none';
    }
  };

  onAuthStateChanged(auth, updateUI);

  // 처리: 리디렉트 결과 (팝업 차단 환경 대비)
  getRedirectResult(auth).catch(console.error);

  if (btnLogin) btnLogin.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      const code = err?.code || '';
      // 팝업 차단/미지원 환경에서는 리디렉트로 대체
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, provider);
        } catch (e2) {
          console.error(e2);
          alert('로그인에 실패했습니다. 브라우저 팝업 차단 설정을 확인해 주세요.');
        }
      } else {
        console.error(err);
        alert('로그인 중 오류가 발생했습니다. 콘솔을 확인해 주세요.');
      }
    }
  });
  if (btnLogout) btnLogout.onclick = () => signOut(auth).catch(console.error);
}

async function loadCollection(collectionName) {
  currentCollectionName = collectionName;
  currentDocId = '';
  docListEl.innerHTML = '';

  if (!collectionName) return;

  try {
    const snapshot = await getDocs(collection(db, collectionName));
    const items = [];
    const userIds = new Set();
    snapshot.forEach((d) => {
      items.push({ id: d.id });
      userIds.add(d.id);
    });

    // users에서 username 매핑
    const idToUsername = {};
    if (userIds.size > 0) {
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach(u => {
        if (userIds.has(u.id)) {
          const ud = u.data();
          idToUsername[u.id] = ud.username || ud.nickname || ud.displayName || u.id;
        }
      });
    }

    if (items.length === 0) {
      docListEl.innerHTML = '<li class="muted" style="padding:8px;">문서가 없습니다.</li>';
      return;
    }

    for (const item of items) {
      const li = document.createElement('li');
      const left = document.createElement('span');
      const label = idToUsername[item.id] || item.id;
      left.textContent = label;
      const actions = document.createElement('span');
      actions.className = 'doc-actions';

      // 편집 패널 제거: '열기' 버튼 삭제

      const delBtn = document.createElement('button');
      delBtn.textContent = '삭제';
      delBtn.className = 'danger';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`문서 삭제: ${item.id} \n정말 삭제하시겠습니까?`)) return;
        await deleteDoc(doc(db, currentCollectionName, item.id));
        currentDocId = '';
        await loadCollection(currentCollectionName);
      });

      // 열기 버튼 제거됨
      actions.appendChild(delBtn);
      li.appendChild(left);
      li.appendChild(actions);
      docListEl.appendChild(li);
    }
  } catch (err) {
    alert('컬렉션 로드 실패: ' + (err?.message || err));
  }
}

// 편집 패널 제거에 따라 상세 문서 열기 기능은 비활성화

// 문서 생성/편집/저장 UI 제거

// 편집 저장 제거

// 새로고침 제거

// 현재 문서 삭제 UI 제거

function bindEvents() {
  loadCollectionBtn.addEventListener('click', () => {
    loadCollection(collectionInput.value.trim());
  });
  collectionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadCollectionBtn.click();
  });
  // 편집 패널 관련 이벤트 제거
}

function showProjectInfo() {
  // firebase.js에서 콘솔로 projectId를 출력하고 있으므로, location으로 간단히 표기
  try {
    // 프로젝트 ID는 SDK에서 직접 노출 API가 없으므로 알려진 값으로만 표기
    projectIdEl.textContent = '(audionyx-a7b2e)';
  } catch {}
}

// 테이블 뷰 표시 함수
function showTableView(viewId) {
  // 모든 뷰 숨기기
  document.getElementById('basic-view').style.display = 'none';
  document.querySelectorAll('.table-view').forEach(view => {
    view.classList.remove('active');
  });

  // 지정된 테이블 뷰 표시
  const targetView = document.getElementById(`table-view-${viewId}`);
  if (targetView) {
    targetView.classList.add('active');
  }
}

// 컬렉션별 전용 뷰 관리
function switchView(collectionName) {
  // 모든 뷰 숨기기
  document.getElementById('basic-view').style.display = 'none';
  document.querySelectorAll('.table-view').forEach(view => {
    view.classList.remove('active');
  });

  // 프리셋 버튼 활성화 상태 관리
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector(`[data-collection="${collectionName}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // 해당 컬렉션에 맞는 뷰 표시
  const tableView = document.getElementById(`table-view-${collectionName}`);
  if (tableView) {
    currentViewMode = 'table';
    tableView.classList.add('active');
  } else {
    currentViewMode = 'basic';
    document.getElementById('basic-view').style.display = 'block';
  }

  // 사용자 뷰에서는 편집 패널 숨김, 그 외에는 표시
  const editorPanel = document.getElementById('editor-panel');
  const adminGrid = document.querySelector('.admin-grid');
  const root = document.querySelector('body');
  if (editorPanel) {
    const shouldHideEditor = (
      collectionName === 'users' ||
      collectionName === 'channels' ||
      collectionName === 'contentLinks' ||
      collectionName === 'track_requests' ||
      collectionName === 'user_withdraw_accounts'
    );
    editorPanel.style.display = shouldHideEditor ? 'none' : 'block';
    if (adminGrid) adminGrid.classList.toggle('fullwidth-left', shouldHideEditor);
    if (root) root.classList.toggle('no-editor-mode', shouldHideEditor);
  }
}

// 사용자 테이블 렌더링
async function loadUsersTable() {
  try {
    currentCollectionName = 'users';
    const snapshot = await getDocs(collection(db, 'users'));
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';

    const users = [];
    snapshot.forEach(d => {
      users.push({ id: d.id, ...d.data() });
    });

  // 총 사용자 수 표시
  const usersCountEl = document.getElementById('users-count');
  if (usersCountEl) usersCountEl.textContent = String(users.length);

    // 가입일 기준 최신순 정렬
    users.sort((a, b) => {
      const aDate = a.createdAt?.toDate?.() || new Date(0);
      const bDate = b.createdAt?.toDate?.() || new Date(0);
      return bDate - aDate;
    });

    // 검색/가입방식 필터
    const providerFilter = (document.getElementById('filter-users-provider')?.value || '').trim();
    const keyword = (document.getElementById('filter-users')?.value || '').toLowerCase();
    let filteredUsers = providerFilter ? users.filter(u => (u.provider || '').toLowerCase() === providerFilter.toLowerCase()) : users;
    if (keyword) {
      filteredUsers = filteredUsers.filter(u => (
        (u.displayName || '').toLowerCase().includes(keyword) ||
        (u.nickname || '').toLowerCase().includes(keyword) ||
        (u.username || '').toLowerCase().includes(keyword) ||
        (u.email || '').toLowerCase().includes(keyword) ||
        (u.phone || '').toLowerCase().includes(keyword)
      ));
    }

    filteredUsers.forEach(user => {
      const row = document.createElement('tr');
      const createdAt = user.createdAt?.toDate ? user.createdAt.toDate() : (user.createdAt && user.createdAt.seconds ? new Date(user.createdAt.seconds * 1000) : (typeof user.createdAt === 'string' || typeof user.createdAt === 'number' ? new Date(user.createdAt) : null));
      const createdStr = formatDateYYMMDD(createdAt);
      
      row.innerHTML = `
        <td>${user.nickname || user.displayName || user.username || '-'}</td>
        <td>${user.email || '-'}</td>
        <td>${user.username || '-'}</td>
        <td>${user.phone || '-'}</td>
        <td>${user.provider || '-'}</td>
        <td style="text-align:right; color:#475569; font-weight:600;">${createdStr}</td>
      `;
      tbody.appendChild(row);
    });

    collectionsData.users = users;
  } catch (err) {
    alert('사용자 데이터 로드 실패: ' + (err?.message || err));
  }
}

// 채널 테이블 렌더링
async function loadChannelsTable() {
  try {
    currentCollectionName = 'channels';
    const snapshot = await getDocs(collection(db, 'channels'));
    const tbody = document.getElementById('channels-tbody');
    tbody.innerHTML = '';

    const channelRows = [];
    const channelOwnerIds = new Set();
    snapshot.forEach(d => {
      const data = d.data();
      const channels = data.channels || [];
      channelOwnerIds.add(d.id);
      channels.forEach((channel, index) => {
        channelRows.push({
          userId: d.id,
          channelIndex: index,
          status: channel.status || (channel.key ? '검사중' : '이모지키누락'),
          urlNeedsReview: channel.urlNeedsReview ? true : false,
          key: channel.key || '',
          createdAt: channel.createdAt || data.createdAt || null,
          ...channel
        });
      });
    });
    const ownerMap = await getUserInfoMap(Array.from(channelOwnerIds));

    // 정렬 옵션 적용
    const sortSelect = document.getElementById('filter-channels-sort');
    const statusPriority = {
      '검사중': 1,
      '검사_중': 1,
      '이모지키누락': 2,
      '이모지_키_누락': 2,
      'URL재확인': 3,
      'URL_재확인': 3,
      '검사완료': 4,
      '승인됨': 4,
      '검사실패': 5,
      '검사_실패': 5,
      '거부됨': 5,
      'pending': 6
    };
    const sortMode = sortSelect ? sortSelect.value : 'recent';
    const statusFilter = (document.getElementById('filter-channels-status')?.value || '').trim();
    const keyword = (document.getElementById('filter-channels')?.value || '').toLowerCase();
    let filtered = statusFilter ? channelRows.filter(r => String(r.status).replace(/\s+/g,'_') === statusFilter) : channelRows;
    if (keyword) {
      filtered = filtered.filter(r => {
        const owner = ownerMap[r.userId] || {};
        const ownerCandidates = [
          owner.nickname,
          owner.displayName,
          owner.username,
          owner.name,
          owner.email
        ].filter(Boolean).map(v => String(v).toLowerCase());
        return (
          (r.url || '').toLowerCase().includes(keyword) ||
          (r.originalUrl || '').toLowerCase().includes(keyword) ||
          (r.platform || '').toLowerCase().includes(keyword) ||
          ownerCandidates.some(v => v.includes(keyword))
        );
      });
    }
    if (sortMode === 'status') {
      filtered.sort((a, b) => {
        const ap = statusPriority[a.status] || 999;
        const bp = statusPriority[b.status] || 999;
        if (ap !== bp) return ap - bp;
        const aDate = a.createdAt || new Date(0);
        const bDate = b.createdAt || new Date(0);
        return bDate - aDate;
      });
    } else {
      // 기본: 등록일 최신순
      filtered.sort((a, b) => {
        const aDate = a.createdAt || new Date(0);
        const bDate = b.createdAt || new Date(0);
        return bDate - aDate;
      });
    }

    filtered.forEach(channel => {
      const row = document.createElement('tr');
      const chDate = channel.createdAt ? (channel.createdAt.toDate ? channel.createdAt.toDate() : (channel.createdAt.seconds ? new Date(channel.createdAt.seconds * 1000) : new Date(channel.createdAt))) : null;
      const createdStr = formatDateYYMMDD(chDate);
      const normalizedStatus = channel.status || 'pending';
      const sanitizedStatus = String(normalizedStatus).replace(/\s+/g, '_');
      const statusClass = `status-${sanitizedStatus}`;
      
      const owner = ownerMap[channel.userId] || {};
      const displayName = owner.nickname || owner.displayName || owner.username || owner.email || channel.userId;
      row.innerHTML = `
        <td>${displayName}</td>
        <td><a href="${channel.originalUrl || channel.url}" target="_blank" style="color:#3b82f6;">${(channel.originalUrl || channel.url || '').substring(0, 40)}...</a></td>
        <td>${channel.platform || '-'}</td>
        <td>${channel.key || '-'}</td>
        <td>${createdStr}</td>
        <td>
          <div class="table-actions">
            <button title="검사완료" class="btn-quick btn-y" onclick="updateChannelStatus('${channel.userId}', ${channel.channelIndex}, '검사완료')">Y</button>
            <button title="이모지 키 누락" class="btn-quick btn-e" onclick="updateChannelStatus('${channel.userId}', ${channel.channelIndex}, '이모지키누락')">E</button>
            <button title="URL 재확인" class="btn-quick btn-u" onclick="updateChannelStatus('${channel.userId}', ${channel.channelIndex}, 'URL재확인')">U</button>
          </div>
        </td>
        <td style="text-align:right;"><span class="status-badge ${statusClass}">${normalizedStatus}</span></td>
      `;
      tbody.appendChild(row);
    });

    // 총 채널 수 표시
    const channelsCountEl = document.getElementById('channels-count');
    if (channelsCountEl) channelsCountEl.textContent = String(channelRows.length);

    collectionsData.channels = channelRows;
  } catch (err) {
    alert('채널 데이터 로드 실패: ' + (err?.message || err));
  }
}

// 트랙 요청 테이블 렌더링
async function loadTrackRequestsTable() {
  try {
    currentCollectionName = 'track_requests';
    const snapshot = await getDocs(collection(db, 'track_requests'));
    const tbody = document.getElementById('track-requests-tbody');
    tbody.innerHTML = '';

    const requests = [];
    const uidSet = new Set();
    snapshot.forEach(d => {
      const data = d.data();
      requests.push({ id: d.id, ...data });
      if (data.uid) uidSet.add(data.uid);
    });

    const uidToUser = await getUserInfoMap(Array.from(uidSet));

    if (requests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#6b7280; padding:20px;">등록된 트랙 요청이 없습니다.</td></tr>';
      return;
    }

    // 요청일 기준 최신순 정렬
    requests.sort((a, b) => {
      const am = toMillis(a.createdAt);
      const bm = toMillis(b.createdAt);
      return bm - am;
    });

    // 상단 카운트 배지 갱신
    const totalEl = document.getElementById('track-requests-count');
    const ppEl = document.getElementById('track-payment-pending-count');
    const prodEl = document.getElementById('track-production-count');
    const dpEl = document.getElementById('track-distribution-pending-count');
    const dingEl = document.getElementById('track-distributing-count');
    const dedEl = document.getElementById('track-distributed-count');
    const totalCnt = requests.length;
    const normalize = (s) => (s || '').toString().toLowerCase();
    const ppCnt = requests.filter(r => ['payment-pending','미제작'].includes(r.status)).length;
    const prodCnt = requests.filter(r => ['production','제작중'].includes(r.status)).length;
    const dpCnt = requests.filter(r => ['distribution-pending','제작완료'].includes(r.status)).length;
    const dingCnt = requests.filter(r => ['distributing'].includes(r.status)).length;
    const dedCnt = requests.filter(r => ['distributed','완료'].includes(r.status)).length;
    if (totalEl) totalEl.textContent = String(totalCnt);
    if (ppEl) ppEl.textContent = String(ppCnt);
    if (prodEl) prodEl.textContent = String(prodCnt);
    if (dpEl) dpEl.textContent = String(dpCnt);
    if (dingEl) dingEl.textContent = String(dingCnt);
    if (dedEl) dedEl.textContent = String(dedCnt);

    // 상태 필터 적용 (선택 시)
    const statusFilter = (document.getElementById('filter-track-requests-status')?.value || '').trim();
    const keyword = (document.getElementById('filter-track-requests')?.value || '').toLowerCase();
    let filtered = requests;

    if (statusFilter) {
      const mapLegacy = {
        'payment-pending': ['payment-pending','미제작'],
        'production': ['production','제작중'],
        'distribution-pending': ['distribution-pending','제작완료'],
        'distributing': ['distributing'],
        'distributed': ['distributed','완료']
      };
      const targets = mapLegacy[statusFilter] || [statusFilter];
      filtered = filtered.filter(r => targets.includes(r.status));
    }
    if (keyword) {
      filtered = filtered.filter(r => {
        const owner = uidToUser[r.uid] || {};
        const ownerCandidates = [
          owner.nickname,
          owner.displayName,
          owner.username,
          owner.email
        ].filter(Boolean).map(v => String(v).toLowerCase());

        return (
          (r.description || '').toLowerCase().includes(keyword) ||
          (r.request || '').toLowerCase().includes(keyword) ||
          (r.genre || '').toLowerCase().includes(keyword) ||
          (r.referenceUrl || '').toLowerCase().includes(keyword) ||
          (r.userEmail || '').toLowerCase().includes(keyword) ||
          ownerCandidates.some(v => v.includes(keyword))
        );
      });
    }

    filtered.forEach(request => {
      const row = document.createElement('tr');
      const createdAt = request.createdAt?.toDate?.() || null;
      const createdStr = formatDateYYMMDD(createdAt);
      const normalized = request.status || 'payment-pending';
      
      // 5단계 상태 매핑
      const statusMap = {
        'payment-pending': { class: 'status-payment-pending', text: '입금 대기', color: '#ffc107' },
        'production': { class: 'status-production', text: '제작중', color: '#42a5f5' },
        'distribution-pending': { class: 'status-distribution-pending', text: '유통 대기', color: '#ff9800' },
        'distributing': { class: 'status-distributing', text: '유통중', color: '#9c27b0' },
        'distributed': { class: 'status-distributed', text: '유통 완료', color: '#28a745' },
        // 구 버전 호환
        '미제작': { class: 'status-payment-pending', text: '입금 대기', color: '#ffc107' },
        '제작중': { class: 'status-production', text: '제작중', color: '#42a5f5' },
        '제작완료': { class: 'status-distribution-pending', text: '유통 대기', color: '#ff9800' },
        '완료': { class: 'status-distributed', text: '유통 완료', color: '#28a745' }
      };
      
      const statusConfig = statusMap[normalized] || statusMap['payment-pending'];
      const statusClass = statusConfig.class;
      const statusContent = statusConfig.text;
      
      const refUrl = request.referenceUrl || request.refUrl || request.sampleUrl || '';
      const displayRef = refUrl ? (refUrl.length > 60 ? refUrl.slice(0,60)+'...' : refUrl) : '-';
      const genre = request.genre || request.category || '-';
      const desc = (request.description || request.request || '').toString();
      const displayDesc = desc.length > 60 ? desc.slice(0,60)+'...' : desc;
      const mapped = uidToUser[request.uid] || {};
      const displayName = mapped.nickname || mapped.displayName || mapped.username || mapped.email || request.uid || '-';
      const displayEmail = request.email || request.userEmail || mapped.email || '-';
      const coverUrl = request.coverUrl || request.cover || request.coverImage || request.coverArtUrl || request.imageUrl || request.image || '';
      const hasCover = !!coverUrl;
      
      row.innerHTML = `
        <td>${displayName}</td>
        <td>${displayEmail}</td>
        <td>${createdStr}</td>
        <td>
          <div class="table-actions">
            <button title="제작중" class="btn-quick btn-production" onclick="updateTrackRequestStatus('${request.id}', 'production')">제작중</button>
            <button title="유통대기" class="btn-quick btn-dist-pending" onclick="updateTrackRequestStatus('${request.id}', 'distribution-pending')">유통대기</button>
            <button title="유통중" class="btn-quick btn-distributing" onclick="updateTrackRequestStatus('${request.id}', 'distributing')">유통중</button>
            <button title="유통완료" class="btn-quick btn-distributed" onclick="updateTrackRequestStatus('${request.id}', 'distributed')">완료</button>
            <button title="삭제" class="btn-delete" onclick="deleteTrackRequestWithConfirm('${request.id}')">삭제</button>
          </div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:10px; justify-content:space-between;">
            <span class="status-badge ${statusClass}">${statusContent}</span>
            <span class="muted" title="입금자명" style="font-size:12px; margin-left:auto; margin-right:8px;">${request.depositor || '-'}</span>
            <button title="자세히 보기" class="btn-view-detail" onclick="viewTrackRequestDetail('${request.id}')">자세히</button>
          </div>
        </td>
      `;

      // 테이블에는 레퍼런스 URL/요청 내용 미표시. '자세히' 모달에서만 노출.

      tbody.appendChild(row);
    });

    collectionsData.track_requests = requests;
  } catch (err) {
    console.error('트랙 요청 데이터 로드 오류:', err);
    const tbody = document.getElementById('track-requests-tbody');
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#dc2626; padding:20px;">데이터 로드 실패: ${err?.message || '권한이 없거나 컬렉션이 존재하지 않습니다'}</td></tr>`;
  }
}

// 콘텐츠링크 테이블 렌더링
async function loadContentLinksTable() {
  try {
    currentCollectionName = 'contentLinks';
    const snapshot = await getDocs(collection(db, 'contentLinks'));
    const tbody = document.getElementById('content-links-tbody');
    tbody.innerHTML = '';

    const linkRows = [];
    const linkOwnerIds = new Set();
    snapshot.forEach(d => {
      const data = d.data();
      const userInfo = data.userInfo || {};
      const contentLinks = data.contentLinks || data.links || [];
      linkOwnerIds.add(d.id);
      
      contentLinks.forEach((link, index) => {
        linkRows.push({
          userId: d.id,
          userDisplayName: userInfo.displayName || userInfo.nickname || d.id,
          linkIndex: index,
          views: link.views || link.viewCount || 0,
          resolvedUrl: link.contentUrl || link.url || link.videoUrl || link.permalink || '',
          ...link
        });
      });
    });

    // 등록일 기준 최신순 정렬 (createdAt fallback)
    linkRows.sort((a, b) => {
      const am = toMillis(a.createdAt);
      const bm = toMillis(b.createdAt);
      return bm - am;
    });

    // 사용자명 매핑
    const linkOwnerMap = await getUserInfoMap(Array.from(linkOwnerIds));

    const cntEl = document.getElementById('content-links-count');
    const keyword = (document.getElementById('filter-content-links')?.value || '').toLowerCase();
    const filtered = keyword ? linkRows.filter(link => {
        const owner = linkOwnerMap[link.userId] || {};
        const ownerCandidates = [
            owner.nickname,
            owner.displayName,
            owner.username,
            owner.email
        ].filter(Boolean).map(v => String(v).toLowerCase());
        return (
            (link.resolvedUrl || '').toLowerCase().includes(keyword) ||
            (link.platform || '').toLowerCase().includes(keyword) ||
            ownerCandidates.some(v => v.includes(keyword))
        );
    }) : linkRows;

    if (cntEl) cntEl.textContent = String(filtered.length);

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#6b7280; padding:20px;">등록된 콘텐츠링크가 없습니다.</td></tr>';
      return;
    }

    filtered.forEach(link => {
      const row = document.createElement('tr');
      const lDate = link.createdAt ? (link.createdAt.toDate ? link.createdAt.toDate() : (link.createdAt.seconds ? new Date(link.createdAt.seconds * 1000) : new Date(link.createdAt))) : null;
      const createdStr = formatDateYYMMDD(lDate);
      const url = link.resolvedUrl || '';
      const displayUrl = url ? (url.length > 80 ? url.slice(0,80) + '...' : url) : '-';
      const lower = (url || '').toLowerCase();
      const platformResolved = (link.platform || (
        lower.includes('youtu') ? 'youtube' :
        lower.includes('instagram') ? 'instagram' :
        lower.includes('tiktok') ? 'tiktok' : ''
      ));
      const icon = getPlatformIconSvg(platformResolved);
      
      const owner = linkOwnerMap[link.userId] || {};
      const displayName = owner.nickname || owner.displayName || owner.username || owner.email || link.userId;
      row.innerHTML = `
        <td>${displayName}</td>
        <td><span class="platform-icon" style="margin-right:6px; display:inline-flex; align-items:center;">${icon}</span><a href="${url || '#'}" target="_blank" style="color:#3b82f6;">${displayUrl}</a></td>
        <td>${platformResolved || '-'}</td>
        <td>${createdStr}</td>
      `;
      tbody.appendChild(row);
    });

    collectionsData.contentLinks = linkRows;
  } catch (err) {
    console.error('콘텐츠링크 데이터 로드 오류:', err);
    const tbody = document.getElementById('content-links-tbody');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#dc2626; padding:20px;">데이터 로드 실패: ${err?.message || '알 수 없는 오류'}</td></tr>`;
  }
}

function getPlatformIconSvg(platform) {
  switch ((platform || '').toLowerCase()) {
    case 'youtube':
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="6" width="20" height="12" rx="3" fill="#FF0000"/><path d="M11 9l5 3-5 3V9z" fill="#FFFFFF"/></svg>';
    case 'instagram':
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="5" fill="url(#ig)"/><defs><linearGradient id="ig" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#F58529"/><stop offset="0.5" stop-color="#DD2A7B"/><stop offset="1" stop-color="#8134AF"/></linearGradient></defs><circle cx="12" cy="12" r="4" stroke="#fff" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="#fff"/></svg>';
    case 'tiktok':
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 3c.5 2.6 2.2 4.3 4.8 4.8V11c-1.9 0-3.7-.7-4.8-1.9V16a5 5 0 11-5-5v3a2 2 0 102 2V3h3z" fill="#000"/><path d="M9 14.5a3.5 3.5 0 106 2.5v2a5.5 5.5 0 11-9.5-3.9A5.5 5.5 0 019 9.5v5z" fill="#25F4EE" opacity=".8"/></svg>';
    default:
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.59 13.41a2 2 0 010-2.82l6-6a2 2 0 112.82 2.82l-6 6a2 2 0 01-2.82 0z" fill="#64748B"/><path d="M13.41 10.59a2 2 0 010 2.82l-6 6a2 2 0 11-2.82-2.82l6-6a2 2 0 012.82 0z" fill="#94A3B8"/></svg>';
  }
}

// 음원 테이블 렌더링
async function loadTracksTable() {
  try {
    currentCollectionName = 'track_new';
    const snapshot = await getDocs(collection(db, 'track_new'));
    const tbody = document.getElementById('tracks-tbody');
    tbody.innerHTML = '';

    const tracks = [];
    snapshot.forEach(d => {
      tracks.push({ id: d.id, ...d.data() });
    });

    // 등록일 기준 최신순 정렬 (다양한 타입 허용)
    tracks.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    // 제목 검색 필터
    const keyword = (document.getElementById('filter-tracks')?.value || '').toLowerCase().trim();
    const filtered = keyword
      ? tracks.filter(t => {
          const storagePath = t.storagePath || t.path || t.filePath || '';
          const fileObj = t.file || t.asset || null;
          const nameCandidates = [
            t['Track Title'], t['Release Title'], t.title, t.trackTitle, t.name,
            fileObj?.name,
            storagePath ? storagePath.split('/').pop() : '',
            (t.url || t.downloadUrl || '').split('?')[0].split('/').pop()
          ].filter(Boolean);
          const titleResolved = (nameCandidates[0] || '').toString().toLowerCase();
          return titleResolved.includes(keyword);
        })
      : tracks;

    // 총 개수 뱃지
    const tracksCountEl = document.getElementById('tracks-count');
    if (tracksCountEl) tracksCountEl.textContent = String(tracks.length);

    filtered.forEach(track => {
      const row = document.createElement('tr');
      // 생성일 파싱
      const createdMs = toMillis(track.createdAt || track.uploadedAt || track.updatedAt);
      const createdStr = createdMs ? new Date(createdMs).toLocaleDateString('ko-KR') : '-';

      // 파일명/경로 추출
      const storagePath = track.storagePath || track.path || track.filePath || '';
      const fileObj = track.file || track.asset || null;
      const nameCandidates = [
        track.fileName,
        track.storageFileName,
        track.originalFileName,
        track.sourceFileName,
        fileObj?.name,
        storagePath ? storagePath.split('/').pop() : '',
        (track.url || track.downloadUrl || '').split('?')[0].split('/').pop()
      ].filter(Boolean);
      let fileName = nameCandidates[0] || '';
      if (!fileName && (track.title || track.trackTitle || track.name)) {
        // 파일명이 없고 제목만 있을 때 제목을 기반으로 유추
        fileName = `${(track.title || track.trackTitle || track.name).toString()}`;
      }
      // 확장자 제거해서 제목 후보로도 사용
      const fileBase = fileName.includes('.') ? fileName.replace(/\.[^.]+$/, '') : fileName;

      // 파일 크기
      const sizeRaw = (
        typeof track.fileSize === 'number' ? track.fileSize :
        typeof track.size === 'number' ? track.size :
        typeof track.bytes === 'number' ? track.bytes :
        (fileObj && typeof fileObj.size === 'number' ? fileObj.size : null)
      );
      const fileSize = (typeof sizeRaw === 'number')
        ? `${(sizeRaw/1024/1024).toFixed(1)} MB`
        : (track.fileSizeLabel || track.sizeLabel || '-');

      // 제목/아티스트/장르 해석 (공백 포함 키 우선)
      const title = (
        track['Track Title'] || track['Release Title'] || track.title || track.trackTitle || track.name || fileBase || '-'
      );
      const artist = (
        track['Primary Artist'] || track['Artist'] || track.artist || track.artistName || track.singer || track.writer || track.uploader ||
        (track.metadata && (track.metadata.artist || track.metadata.artistName)) ||
        (track.meta && (track.meta.artist || track.meta.artistName)) || '-'
      );
      const genre = (
        track['Genre'] || track.genre || track.category || track.tag || (track.metadata && track.metadata.genre) || (track.meta && track.meta.genre) || '-'
      );

      // 재생시간 해석 (seconds/ms/length 등 다양한 필드 지원)
      const durSecCandidates = [
        track.duration,
        track.durationSec,
        track.durationSeconds,
        track.length,
        track.lengthSec,
        track.lengthSeconds,
        (typeof track.durationMs === 'number' ? Math.round(track.durationMs/1000) : null),
        (typeof track.msDuration === 'number' ? Math.round(track.msDuration/1000) : null),
        (track.metadata && typeof track.metadata.duration === 'number' ? track.metadata.duration : null),
        (track.meta && typeof track.meta.duration === 'number' ? track.meta.duration : null),
        // 포맷이 "mm:ss" 형식일 경우
        (typeof track.durationLabel === 'string' && /^\d{1,2}:\d{2}$/.test(track.durationLabel) ? (function(lbl){ const [m,s]=lbl.split(':').map(n=>parseInt(n,10)); return m*60+s; })(track.durationLabel) : null)
      ].filter((v) => typeof v === 'number' && isFinite(v) && v > 0);
      const durSec = durSecCandidates.length ? durSecCandidates[0] : null;
      const duration = (typeof durSec === 'number')
        ? `${Math.floor(durSec / 60)}:${Math.round(durSec % 60).toString().padStart(2, '0')}`
        : '-';
      
      row.innerHTML = `
        <td>${title}</td>
        <td>${artist}</td>
        <td>${duration}</td>
        <td>${fileName || '-'}</td>
        <td>${fileSize}</td>
        <td>${createdStr}</td>
        
      `;
      tbody.appendChild(row);

      // 파일 용량이 없고 storagePath가 있으면 Storage 메타데이터로 채우기
      if ((!sizeRaw || isNaN(sizeRaw)) && storagePath) {
        try {
          const sref = storageRef(storage, storagePath);
          getMetadata(sref).then((meta) => {
            if (meta && typeof meta.size === 'number') {
              const mb = (meta.size / 1024 / 1024).toFixed(1) + ' MB';
              const sizeCell = row.children[4];
              if (sizeCell) sizeCell.textContent = mb;
            }
          }).catch(() => {});
        } catch (_) {}
      }

      // 재생시간이 없고 downloadUrl이 있으면 오디오 메타로 채우기
      if (duration === '-' && (track.downloadUrl || track.url)) {
        try {
          const audio = new Audio();
          audio.preload = 'metadata';
          audio.src = track.downloadUrl || track.url;
          audio.addEventListener('loadedmetadata', () => {
            if (isFinite(audio.duration) && audio.duration > 0) {
              const dCell = row.children[2];
              if (dCell) dCell.textContent = formatDurationSeconds(audio.duration);
            }
          }, { once: true });
          // 에러는 무시
        } catch (_) {}
      }
    });

    collectionsData.track_new = tracks;
  } catch (err) {
    alert('음원 데이터 로드 실패: ' + (err?.message || err));
  }
}

// 업로드 UI 바인딩 및 처리 (Storage로 업로드 후 track_new 문서에 메타만 기록하는 구조로 확장 가능)
function bindTrackUploadUI() {
  const drop = document.getElementById('track-upload-drop');
  const input = document.getElementById('track-upload-input');
  const queue = document.getElementById('track-upload-queue');
  const list = document.getElementById('track-upload-list');
  const mode = document.getElementById('track-bulk-mode');
  const bulkMetaPanel = document.getElementById('bulk-meta-panel');
  const bulkMetaText = null; // 텍스트 붙여넣기 제거
  const btnApplyMeta = null;
  // 새로운 업로드 매니저 UI
  const tracksInput = document.getElementById('bulk-tracks-file');
  const coversInput = document.getElementById('bulk-covers-file');
  const btnValidate = document.getElementById('btn-validate-audio');
  const btnRunUpload = document.getElementById('btn-run-audio-upload');
  const validatePanel = document.getElementById('upload-validate-panel');
  const validateList = document.getElementById('upload-validate-list');
  const excelInput = document.getElementById('bulk-meta-file');
  const progressText = document.getElementById('upload-progress-text');
  const successCountEl = document.getElementById('upload-success-count');
  const failCountEl = document.getElementById('upload-fail-count');
  // 트랙 뷰 존재 여부만 확인 (드롭존 요소는 없어도 동작해야 함)
  if (!document.getElementById('table-view-track_new')) return;

  const openPicker = () => input.click();
  if (drop) {
    drop.addEventListener('click', openPicker);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.style.background = '#eef2ff'; });
    drop.addEventListener('dragleave', () => { drop.style.background = '#f8fafc'; });
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.style.background = '#f8fafc';
      handleFiles(e.dataTransfer.files);
    });
  }
  if (input) {
    input.addEventListener('change', () => handleFiles(input.files));
  }

  if (mode) {
    mode.addEventListener('change', () => {
      const v = mode.value;
      // 파일 input의 accept를 모드별로 변경
      if (v === 'tracks') input.setAttribute('accept', '.mp3,audio/mpeg');
      else if (v === 'covers') input.setAttribute('accept', 'image/*');
      else input.setAttribute('accept', '*/*');
      // 메타 패널 토글
      if (bulkMetaPanel) bulkMetaPanel.style.display = 'none';
    });
  }


  function handleFiles(files) {
    if (!files || !files.length || !queue) return;
    queue.style.display = 'block';
    const currentMode = (mode && mode.value) || 'none';
    Array.from(files).forEach((f) => {
      if (currentMode === 'tracks' && !f.type.startsWith('audio/')) return;
      if (currentMode === 'covers' && !f.type.startsWith('image/')) return;
      const li = document.createElement('li');
      li.style.padding = '6px 8px';
      li.style.border = '1px solid #e2e8f0';
      li.style.borderRadius = '6px';
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.innerHTML = `<span>${f.name} · ${(f.size/1024/1024).toFixed(1)} MB</span><span class="muted">${currentMode==='tracks'?'트랙': currentMode==='covers'?'커버':'대기'}</span>`;
      list.appendChild(li);
    });

    // 업로드 실행
    if (currentMode === 'tracks') {
      batchUploadTracks(files).catch(console.error);
    } else if (currentMode === 'covers') {
      batchUploadCovers(files).catch(console.error);
    }
  }

  // 업로드 매니저: 선택/표시
  // 버튼 제거 → 파일 input 직접 활용

  // 엑셀/CSV → 텍스트로 파싱해서 textarea에 채우기
  if (excelInput) {
    excelInput.addEventListener('change', async () => {
      const file = excelInput.files && excelInput.files[0];
      if (!file) return;
      try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 }); // 2D array
        // 1행을 헤더로 인식
        const headers = (json[0] || []).map(h => String(h).trim());
        const colIndex = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
        const idxTitle = colIndex('title');
        const idxMood = colIndex('mood');
        const idxUse = colIndex('use-case') !== -1 ? colIndex('use-case') : colIndex('usecase');
        const idxISRC = colIndex('ISRC');
        const idxArtist = colIndex('Primary Artist') !== -1 ? colIndex('Primary Artist') : (colIndex('Artist'));
        const idxGenre = colIndex('Genre');
        const idxReleaseDate = colIndex('Release Date');
        // 메모리 보관: lastValidate.metaRows 대체용으로 rows2 저장
        const rows2 = [];
        for (let i = 1; i < json.length; i++) {
          const r = json[i] || [];
          const get = (idx) => (idx>=0 && idx<r.length) ? String(r[idx] ?? '').trim() : '';
          const item = {
            title: get(idxTitle),
            mood: get(idxMood),
            usecase: get(idxUse),
            ISRC: get(idxISRC),
            artist: get(idxArtist),
            genre: get(idxGenre),
            releaseDate: get(idxReleaseDate)
          };
          if (item.title) rows2.push(item);
        }
        excelInput.dataset.parsed = JSON.stringify(rows2);
      } catch (e) {
        console.error(e);
        alert('엑셀/CSV 파싱 중 오류가 발생했습니다.');
      }
    });
  }

  let lastValidate = null;
  if (btnValidate && btnRunUpload && validatePanel && validateList) {
    btnValidate.onclick = async () => {
      validateList.innerHTML = '';
      const logs = [];
      const trackFiles = Array.from((tracksInput && tracksInput.files) ? tracksInput.files : []);
      const coverFiles = Array.from((coversInput && coversInput.files) ? coversInput.files : []);
      const parsed = excelInput?.dataset?.parsed ? JSON.parse(excelInput.dataset.parsed) : [];
      if (!trackFiles.length) logs.push('트랙 파일이 선택되지 않았습니다.');
      if (!coverFiles.length) logs.push('커버 이미지가 선택되지 않았습니다.');
      if (!parsed.length) logs.push('메타데이터 파일이 비어 있거나 헤더를 찾을 수 없습니다.');
      const titlesFromMeta = new Set(parsed.map(r => (r.title||'').toLowerCase()).filter(Boolean));
      // 파일명 정규화 매핑
      const trackBaseSet = new Set(trackFiles.map(f => normalizeBaseName(f.name).toLowerCase()));
      const coverBaseSet = new Set(coverFiles.map(f => normalizeBaseName(f.name).toLowerCase()));
      // 교집합 체크
      const missingForTracks = [...titlesFromMeta].filter(t => !trackBaseSet.has(t));
      const missingForCovers = [...titlesFromMeta].filter(t => !coverBaseSet.has(t));
      if (missingForTracks.length) logs.push(`메타에 있으나 트랙 파일이 없는 항목: ${missingForTracks.slice(0,5).join(', ')}${missingForTracks.length>5?' 외':''}`);
      if (missingForCovers.length) logs.push(`메타에 있으나 커버 파일이 없는 항목: ${missingForCovers.slice(0,5).join(', ')}${missingForCovers.length>5?' 외':''}`);
      if (!logs.length) logs.push('검증 통과: 업로드 가능합니다.');
      logs.forEach(line => {
        const li = document.createElement('li'); li.textContent = line; validateList.appendChild(li);
      });
      validatePanel.style.display = 'block';
      const ok = trackFiles.length>0 && coverFiles.length>0 && parsed.length>0 && missingForTracks.length===0 && missingForCovers.length===0;
      btnRunUpload.disabled = !ok;
      lastValidate = { trackFiles, coverFiles, metaRows: parsed };
    };

    btnRunUpload.onclick = async () => {
      if (!lastValidate) return;
      const { trackFiles, coverFiles, metaRows } = lastValidate;
      let success = 0, fail = 0, total = trackFiles.length + coverFiles.length + metaRows.length;
      const setProgress = () => {
        if (progressText) progressText.textContent = `${Math.round(((success+fail)/Math.max(1,total))*100)}%`;
        if (successCountEl) successCountEl.textContent = String(success);
        if (failCountEl) failCountEl.textContent = String(fail);
      };
      // 1) 트랙 업로드 → 문서 매칭/생성
      try {
        const resTracks = await batchUploadTracks(trackFiles);
        success += (resTracks?.success || 0);
        fail += (resTracks?.fail || 0);
      } catch { fail += trackFiles.length; }
      setProgress();
      // 2) 커버 업로드 → 문서 매칭 갱신
      try {
        const resCovers = await batchUploadCovers(coverFiles);
        success += (resCovers?.success || 0);
        fail += (resCovers?.fail || 0);
      } catch { fail += coverFiles.length; }
      setProgress();
      // 3) 메타 적용 (title, mood, use-case, ISRC)
      // 최신 인덱스로 단 한 번 매핑
      const idx = await buildTrackIndex();
      for (const item of metaRows) {
        try {
          const title = (item.title||'').trim(); if (!title) { fail++; setProgress(); continue; }
          const mood = (item.mood||'').trim();
          const usecase = (item.usecase||'').trim();
          const isrc = (item.ISRC||'').trim();
          const key = title.toLowerCase();
          const match = idx[key];
          if (match) {
            await updateDoc(doc(db, 'track_new', match.id), {
              mood: mood || null,
              usecase: usecase || null,
              ISRC: isrc || null,
              updatedAt: serverTimestamp()
            });
            success++;
          } else { fail++; }
          setProgress();
        } catch { fail++; setProgress(); }
      }
      alert('업로드 및 메타 적용이 완료되었습니다.');
      await loadTracksTable();
    };
  }
}

async function batchUploadTracks(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('audio/'));
  if (!files.length) return { success: 0, fail: 0 };
  await assertAdminOrThrow();
  const index = await buildTrackIndex();
  let success = 0, fail = 0;
  for (const f of files) {
    try {
      const base = normalizeBaseName(f.name);
      const dest = `track/${f.name}`;
      const sref = storageRef(storage, dest);
      await uploadBytesResumable(sref, f);
      const url = await getDownloadURL(sref);
      const key = base.toLowerCase();
      const match = index[key];
      if (match) {
        await updateDoc(doc(db, 'track_new', match.id), {
          storagePath: dest,
          downloadUrl: url,
          fileName: f.name,
          fileSize: f.size,
          'Track Title': match.data['Track Title'] || match.data.trackTitle || match.data.title || base,
          updatedAt: serverTimestamp()
        });
        success++;
      } else {
        await addDoc(collection(db, 'track_new'), {
          'Track Title': base,
          storagePath: dest,
          downloadUrl: url,
          fileName: f.name,
          fileSize: f.size,
          createdAt: serverTimestamp()
        });
        success++;
      }
    } catch (e) { console.error('트랙 업로드 실패', f.name, e); fail++; }
  }
  await loadTracksTable();
  return { success, fail };
}

async function batchUploadCovers(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (!files.length) return { success: 0, fail: 0 };
  await assertAdminOrThrow();
  const index = await buildTrackIndex();
  let success = 0, fail = 0;
  for (const f of files) {
    try {
      const base = normalizeBaseName(f.name);
      const dest = `track/covers/${f.name}`;
      const sref = storageRef(storage, dest);
      await uploadBytesResumable(sref, f);
      const url = await getDownloadURL(sref);
      const key = base.toLowerCase();
      const match = index[key];
      if (match) {
        await updateDoc(doc(db, 'track_new', match.id), {
          coverUrl: url,
          updatedAt: serverTimestamp()
        });
        success++;
      }
    } catch (e) { console.error('커버 업로드 실패', f.name, e); fail++; }
  }
  await loadTracksTable();
  return { success, fail };
}

// 계좌 정보 테이블 렌더링
async function loadAccountsTable() {
  try {
    currentCollectionName = 'user_withdraw_accounts';
    const snapshot = await getDocs(collection(db, 'user_withdraw_accounts'));
    const tbody = document.getElementById('accounts-tbody');
    tbody.innerHTML = '';

    const accounts = [];
    const ownerIds = new Set();
    snapshot.forEach(d => {
      const data = d.data();
      accounts.push({ id: d.id, ...data });
      ownerIds.add(d.id);
    });

    // 사용자 닉네임 매핑
    const ownerMap = await getUserInfoMap(Array.from(ownerIds));

    if (accounts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#6b7280; padding:20px;">등록된 계좌 정보가 없습니다.</td></tr>';
      return;
    }

    // 등록일 기준 최신순 정렬 (createdAt || updatedAt)
    accounts.sort((a, b) => {
      const am = Math.max(toMillis(a.createdAt), toMillis(a.updatedAt));
      const bm = Math.max(toMillis(b.createdAt), toMillis(b.updatedAt));
      return bm - am;
    });

    // 콘텐츠 링크 맵 (uid -> 링크 배열)
    const contentLinksSnap = await getDocs(collection(db, 'contentLinks'));
    const uidToLinks = {};
    contentLinksSnap.forEach(docSnap => {
      const d = docSnap.data();
      const arr = (d.contentLinks || d.links || []).map(l => l.contentUrl || l.url || l.videoUrl || l.permalink).filter(Boolean);
      uidToLinks[docSnap.id] = arr;
    });

    const keyword = (document.getElementById('filter-accounts')?.value || '').toLowerCase();
    const filtered = keyword ? accounts.filter(account => {
        const owner = ownerMap[account.id] || {};
        const ownerCandidates = [
            owner.nickname,
            owner.displayName,
            owner.username,
            owner.email
        ].filter(Boolean).map(v => String(v).toLowerCase());
        return (
            (account.bank || '').toLowerCase().includes(keyword) ||
            (account.accountHolder || '').toLowerCase().includes(keyword) ||
            (account.accountNumber || '').toLowerCase().includes(keyword) ||
            ownerCandidates.some(v => v.includes(keyword))
        );
    }) : accounts;

    // 총 계좌 개수 뱃지
    const accountsCountEl = document.getElementById('accounts-count');
    if (accountsCountEl) accountsCountEl.textContent = String(filtered.length);

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#6b7280; padding:20px;">등록된 계좌 정보가 없습니다.</td></tr>';
      return;
    }

    filtered.forEach(account => {
      const row = document.createElement('tr');
      const rawDate = account.createdAt || account.updatedAt || null;
      const createdAt = rawDate
        ? (rawDate.toDate ? rawDate.toDate()
           : (rawDate.seconds ? new Date(rawDate.seconds * 1000)
              : (typeof rawDate === 'string' || typeof rawDate === 'number' ? new Date(rawDate) : null)))
        : null;
      const createdStr = formatDateYYMMDD(createdAt);
      const owner = ownerMap[account.id] || {};
      const displayName = owner.nickname || owner.displayName || owner.username || owner.email || account.id;
      const links = uidToLinks[account.id] || [];
      const options = links.length
        ? ['<option value="" disabled selected>링크 선택</option>'].concat(
            links.map((u, i) => {
              let label = u;
              try { const h = new URL(u).hostname.replace('www.',''); label = `${h} · ${u.length>48?u.slice(0,48)+'...':u}`; } catch(e) { label = (u.length>60?u.slice(0,60)+'...':u); }
              return `<option value="${u}">${i+1}. ${label}</option>`;
            })
          ).join('')
        : '<option value="" disabled selected>연결된 링크 없음</option>';
      const bankLabel = account.bank || (account.bankCode ? `${account.bankCode}` : '-');
      const composedAcctNum = account.accountNumber || account.account || (account.accountNumber && account.branchCode ? `${account.bankCode||''}-${account.branchCode}-${account.accountNumber}` : (account.accountNumberJP || ''));
      const acctNum = composedAcctNum || '-';
      const holder = account.accountHolder || account.holder || account.accountHolderKana || '-';
      const typeLabel = account.accountType || account.type || '';
      
      row.innerHTML = `
        <td>${displayName}</td>
        <td>${bankLabel}</td>
        <td>${acctNum}${typeLabel ? ` (${typeLabel})` : ''}</td>
        <td>${holder}</td>
        <td>${createdStr}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge" title="연결된 링크 수" style="${links.length===0 ? 'background:#fee2e2;color:#b91c1c;' : ''}">${links.length}</span>
            <select style="padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; background:#fff;" onchange="if(this.value) window.open(this.value, '_blank')">${options}</select>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });

    collectionsData.user_withdraw_accounts = accounts;
  } catch (err) {
    console.error('계좌 데이터 로드 오류:', err);
    const tbody = document.getElementById('accounts-tbody');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#dc2626; padding:20px;">데이터 로드 실패: ${err?.message || '권한이 없거나 컬렉션이 존재하지 않습니다'}</td></tr>`;
  }
}

// 채널 상태 업데이트
async function updateChannelStatus(userId, channelIndex, newStatus) {
  try {
    // 관리자 클레임 확인
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('관리자 로그인이 필요합니다');
    const token = await user.getIdTokenResult();
    const isAdmin = (!!token.claims.admin) || (user.email === 'audionyx369@gmail.com');
    if (!isAdmin) throw new Error('관리자 권한이 없습니다');

    const channelRef = doc(db, 'channels', userId);
    const channelDoc = await getDoc(channelRef);
    if (!channelDoc.exists()) return;

    const data = channelDoc.data();
    const channels = [...(data.channels || [])];
    if (channels[channelIndex]) {
      channels[channelIndex].status = newStatus;
      await updateDoc(channelRef, { channels, updatedAt: serverTimestamp() });
      await loadChannelsTable(); // 테이블 새로고침
      alert(`채널 상태가 "${newStatus}"로 변경되었습니다.`);
    }
  } catch (err) {
    alert('채널 상태 업데이트 실패: ' + (err?.message || err));
  }
}

// 트랙 요청 상태 업데이트
async function updateTrackRequestStatus(requestId, newStatus) {
  try {
    const requestRef = doc(db, 'track_requests', requestId);
    await updateDoc(requestRef, { status: newStatus });
    await loadTrackRequestsTable(); // 테이블 새로고침
    alert(`트랙 요청 상태가 "${newStatus}"로 변경되었습니다.`);
  } catch (err) {
    alert('트랙 요청 상태 업데이트 실패: ' + (err?.message || err));
  }
}

// 사용자 삭제 확인
async function deleteUserWithConfirm(userId) {
  if (!confirm(`사용자 삭제: ${userId}\n정말 삭제하시겠습니까?`)) return;
  try {
    await deleteDoc(doc(db, 'users', userId));
    await loadUsersTable();
    alert('사용자가 삭제되었습니다.');
  } catch (err) {
    alert('사용자 삭제 실패: ' + (err?.message || err));
  }
}

// 콘텐츠링크 삭제 확인
async function deleteContentLinkWithConfirm(userId, linkIndex) {
  if (!confirm(`콘텐츠링크 삭제\n정말 삭제하시겠습니까?`)) return;
  try {
    const linkRef = doc(db, 'contentLinks', userId);
    const linkDoc = await getDoc(linkRef);
    if (!linkDoc.exists()) return;

    const data = linkDoc.data();
    const contentLinks = [...(data.contentLinks || [])]; // links -> contentLinks로 수정
    if (contentLinks[linkIndex]) {
      contentLinks.splice(linkIndex, 1);
      await updateDoc(linkRef, { contentLinks }); // links -> contentLinks로 수정
      await loadContentLinksTable();
      alert('콘텐츠링크가 삭제되었습니다.');
    }
  } catch (err) {
    alert('콘텐츠링크 삭제 실패: ' + (err?.message || err));
  }
}

// 음원 삭제 확인
async function deleteTrackWithConfirm(trackId) {
  if (!confirm(`음원 삭제: ${trackId}\n정말 삭제하시겠습니까?`)) return;
  try {
    await deleteDoc(doc(db, 'track_new', trackId));
    await loadTracksTable();
    alert('음원이 삭제되었습니다.');
  } catch (err) {
    alert('음원 삭제 실패: ' + (err?.message || err));
  }
}

// 계좌 삭제 확인
async function deleteAccountWithConfirm(accountId) {
  if (!confirm(`계좌 정보 삭제: ${accountId}\n정말 삭제하시겠습니까?`)) return;
  try {
    await deleteDoc(doc(db, 'user_withdraw_accounts', accountId));
    await loadAccountsTable();
    alert('계좌 정보가 삭제되었습니다.');
  } catch (err) {
    alert('계좌 삭제 실패: ' + (err?.message || err));
  }
}

// ISRC 업데이트 함수
async function updateTrackRequestISRC(requestId, isrcValue) {
  try {
    const requestRef = doc(db, 'track_requests', requestId);
    await updateDoc(requestRef, { 
      ISRC: isrcValue.trim() || null,
      updatedAt: serverTimestamp()
    });
    
    // 테이블 새로고침
    await loadTrackRequestsTable();
    
    if (isrcValue.trim()) {
      alert(`ISRC가 "${isrcValue.trim()}"로 저장되었습니다.`);
    } else {
      alert('ISRC가 삭제되었습니다.');
    }
  } catch (err) {
    alert('ISRC 업데이트 실패: ' + (err?.message || err));
    console.error('ISRC 업데이트 오류:', err);
  }
}

// CD Baby 리포트 파싱 관련 변수
let selectedCDBabyFile = null;
let parsedCDBabyData = null;

// CD Baby 리포트 파일 선택 처리
function handleCDBabyFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  selectedCDBabyFile = file;
  
  // 파일 정보 표시
  const fileInfo = document.getElementById('selected-file-info');
  const processingOptions = document.getElementById('processing-options');
  
  fileInfo.style.display = 'block';
  fileInfo.innerHTML = `
    <strong>선택된 파일:</strong> ${file.name} 
    <span style="color: #64748b;">(${(file.size / 1024).toFixed(1)} KB)</span>
  `;
  
  processingOptions.style.display = 'block';
}

// CD Baby 리포트 파싱
async function parseCDBabyReport() {
  if (!selectedCDBabyFile) {
    alert('먼저 CD Baby 리포트 파일을 선택해주세요.');
    return;
  }

  try {
    const text = await selectedCDBabyFile.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      alert('파일이 비어있거나 읽을 수 없습니다.');
      return;
    }

    const records = [];
    // 1. 구분자를 탭으로 되돌리고, 2. 헤더를 소문자로 변환하여 대소문자 구분 없앰
    const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      if (values.length < headers.length) continue;
      
      const record = {};
      headers.forEach((header, index) => {
        record[header] = values[index]?.trim() || '';
      });
      records.push(record);
    }

    const mappingResults = await mapCDBabyRecordsToUsers(records);
    
    displayParsingResults(mappingResults);
    
    parsedCDBabyData = mappingResults;
    
  } catch (error) {
    console.error('CD Baby 리포트 파싱 오류:', error);
    alert('파일 파싱 중 오류가 발생했습니다: ' + error.message);
  }
}

// CD Baby 레코드를 사용자와 매핑
async function mapCDBabyRecordsToUsers(records) {
  const results = {
    totalRecords: records.length,
    mappedRecords: [],
    unmappedRecords: [],
    totalEarnings: 0
  };

  const trackRequestsSnap = await getDocs(collection(db, 'track_requests'));
  const isrcToUserMap = new Map();
  
  trackRequestsSnap.forEach(doc => {
    const data = doc.data();
    if (data.ISRC && data.uid) {
      isrcToUserMap.set(data.ISRC, data.uid);
    }
  });

  for (const record of records) {
    // 헤더가 소문자로 변환되었으므로, 소문자 키로 조회
    const isrc = record['isrc'] || '';
    const artist = record['artist_name'] || record['artist'] || '';
    const track_title = record['track_title'] || record['track title'] || '';
    const platform = record['platform'] || record['store'] || '';
    const earnings = parseFloat(record['revenue_share'] || record['earnings'] || record['revenue'] || '0') || 0;
    
    const mappedRecord = {
      artist,
      track_title,
      isrc,
      platform,
      earnings,
      period_end: record['period_end'] || record['period end'],
      mapped: false,
      userId: null,
      userName: null
    };

    if (isrc && isrcToUserMap.has(isrc)) {
      const userId = isrcToUserMap.get(isrc);
      const userInfo = await getUserInfo(userId);
      
      mappedRecord.mapped = true;
      mappedRecord.userId = userId;
      mappedRecord.userName = userInfo.nickname || userInfo.displayName || userInfo.username || userId;
      
      results.mappedRecords.push(mappedRecord);
      results.totalEarnings += earnings;
    } else {
      results.unmappedRecords.push(mappedRecord);
    }
  }

  return results;
}

// 사용자 정보 가져오기 (단일 사용자)
async function getUserInfo(userId) {
  if (userInfoCache.has(userId)) {
    return userInfoCache.get(userId);
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const info = {
        username: userData.username || '',
        nickname: userData.nickname || '',
        displayName: userData.displayName || '',
        email: userData.email || ''
      };
      userInfoCache.set(userId, info);
      return info;
    }
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
  }

  return { username: '', nickname: '', displayName: '', email: '' };
}

// 파싱 결과 표시
function displayParsingResults(results) {
  const resultsPanel = document.getElementById('parsing-results');
  const tbody = document.getElementById('parsing-results-tbody');
  
  // 통계 업데이트
  document.querySelector('#parsing-results > div:nth-child(2) > div:nth-child(1) > div:nth-child(1)').textContent = results.totalRecords;
  document.querySelector('#parsing-results > div:nth-child(2) > div:nth-child(2) > div:nth-child(1)').textContent = results.mappedRecords.length;
  document.querySelector('#parsing-results > div:nth-child(2) > div:nth-child(3) > div:nth-child(1)').textContent = results.unmappedRecords.length;
  document.querySelector('#parsing-results > div:nth-child(2) > div:nth-child(4) > div:nth-child(1)').textContent = `₩${results.totalEarnings.toLocaleString()}`;

  // 상세 결과 테이블 업데이트
  tbody.innerHTML = '';
  
  // 매핑된 레코드 표시
  results.mappedRecords.forEach(record => {
    const row = document.createElement('tr');
    row.style.background = '#f0fdf4';
    row.innerHTML = `
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${record.artist}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${record.isrc}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${record.platform}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">₩${record.earnings.toLocaleString()}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
        <span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
          ✅ ${record.userName}
        </span>
      </td>
    `;
    tbody.appendChild(row);
  });

  // 매핑되지 않은 레코드 표시
  results.unmappedRecords.forEach(record => {
    const row = document.createElement('tr');
    row.style.background = '#fef3c7';
    row.innerHTML = `
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${record.artist}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${record.isrc || '-'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${record.platform}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">₩${record.earnings.toLocaleString()}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
        <span style="background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
          ❌ 매핑 실패
        </span>
      </td>
    `;
    tbody.appendChild(row);
  });

  // 저장 버튼 표시 (매핑된 데이터가 있을 때만)
  const saveButton = document.getElementById('save-parsed-data');
  if (results.mappedRecords.length > 0) {
    saveButton.style.display = 'block';
  } else {
    saveButton.style.display = 'none';
  }

  resultsPanel.style.display = 'block';
}

// CD Baby 리포트 업로드 기록 저장
async function saveCDBabyUploadHistory(results, fileName, uploadedBy, processingMode) {
  try {
    await addDoc(collection(db, 'cdbaby_upload_history'), {
      timestamp: serverTimestamp(),
      fileName: fileName,
      uploadedBy: uploadedBy,
      totalRecords: results.totalRecords,
      mappedRecordsCount: results.mappedRecords.length,
      unmappedRecordsCount: results.unmappedRecords.length,
      totalEarnings: results.totalEarnings,
      processingMode: processingMode
    });
    console.log('[saveCDBabyUploadHistory] 업로드 기록 저장 성공');
  } catch (error) {
    console.error('[saveCDBabyUploadHistory] 업로드 기록 저장 실패:', error);
  }
}

// 파싱된 데이터를 user_earnings 컬렉션에 저장
async function saveParsedCDBabyData() {
  if (!parsedCDBabyData || parsedCDBabyData.mappedRecords.length === 0) {
    alert('저장할 데이터가 없습니다.');
    return;
  }

  try {
    await assertAdminOrThrow();
    const processingMode = document.getElementById('processing-mode').value;
    if (processingMode === 'preview') {
      alert('미리보기 모드에서는 실제 저장이 되지 않습니다. 처리 모드를 "실제 업데이트"로 변경해주세요.');
      return;
    }

    // Group earnings data from the current file by user
    const userEarningsMap = new Map();
    parsedCDBabyData.mappedRecords.forEach(record => {
        if (!userEarningsMap.has(record.userId)) {
            userEarningsMap.set(record.userId, {
                userId: record.userId,
                monthlyEarnings: [],
                totalEarnings: 0, // This will be the total from the file
            });
        }
        const userEarnings = userEarningsMap.get(record.userId);
        let recordMonth = getCurrentMonth();
        if (record.period_end) {
            try {
                const d = new Date(record.period_end);
                recordMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            } catch (e) { /* fallback to current month */ }
        }
        userEarnings.monthlyEarnings.push({
            month: recordMonth,
            amount: record.earnings,
            trackTitle: record.track_title || '',
            artistName: record.artist_name || record.artist || '',
            platform: record.platform || '기타'
        });
        userEarnings.totalEarnings += record.earnings;
    });

    // For each user in the file, perform a read-modify-write operation
    for (const [userId, dataFromFile] of userEarningsMap) {
        const userEarningsRef = doc(db, 'user_earnings', userId);
        const docSnap = await getDoc(userEarningsRef);
        
        const existingData = docSnap.exists() ? docSnap.data() : {};
        
        // 1. Create the new history entry
        const newHistoryEntry = {
            timestamp: new Date(), // Use client-side timestamp
            totalEarnings: dataFromFile.totalEarnings 
        };

        // 2. Update the history array, keeping the last 20 entries
        const existingHistory = existingData.earningsUploadHistory || [];
        const updatedHistory = [...existingHistory, newHistoryEntry].slice(-20); // Keep last 20

        // 3. Recalculate current balance
        let totalPayouts = 0;
        if (existingData.payoutHistory) {
            existingData.payoutHistory.forEach(p => { totalPayouts += p.amount; });
        }
        const newCurrentBalance = dataFromFile.totalEarnings - totalPayouts;

        // 4. Construct the final document
        const finalData = {
            // Overwrite totalRevenue and monthlyEarnings with data from the new file
            totalRevenue: dataFromFile.totalEarnings,
            monthlyEarnings: dataFromFile.monthlyEarnings,
            
            // Update balance and history
            currentBalance: newCurrentBalance,
            earningsUploadHistory: updatedHistory,
            
            // Preserve existing fields
            payoutHistory: existingData.payoutHistory || [],
            userId: userId,
            
            // Set update timestamp
            lastUpdatedAt: serverTimestamp()
        };

        // 5. Save the document
        await setDoc(userEarningsRef, finalData);
    }
    
    alert(`성공적으로 ${userEarningsMap.size}명의 사용자 수익 데이터를 업데이트했습니다.`);
    
    // Save upload history
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (currentUser) {
      const fileName = selectedCDBabyFile ? selectedCDBabyFile.name : 'Unknown File';
      await saveCDBabyUploadHistory(parsedCDBabyData, fileName, currentUser.uid, processingMode);
    }

    // Reset UI
    document.getElementById('parsing-results').style.display = 'none';
    selectedCDBabyFile = null;
    if(document.getElementById('cdbaby-report-file')) {
        document.getElementById('cdbaby-report-file').value = '';
    }
    if(document.getElementById('selected-file-info')) {
        document.getElementById('selected-file-info').style.display = 'none';
    }
    if(document.getElementById('processing-options')) {
        document.getElementById('processing-options').style.display = 'none';
    }

  } catch (error) {
    console.error('데이터 저장 오류:', error);
    alert('데이터 저장 중 오류가 발생했습니다: ' + error.message);
  }
}

// 현재 월 문자열 반환 (YYYY-MM 형식)
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// CD Baby 리포트 관련 이벤트 리스너 설정
function setupCDBabyEventListeners() {
  const fileInput = document.getElementById('cdbaby-report-file');
  const selectButton = document.getElementById('select-cdbaby-file');
  const parseButton = document.getElementById('parse-cdbaby-report');
  const saveButton = document.getElementById('save-parsed-data');

  if (selectButton) {
    selectButton.addEventListener('click', () => {
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', handleCDBabyFileSelect);
  }

  if (parseButton) {
    parseButton.addEventListener('click', parseCDBabyReport);
  }

  if (saveButton) {
    saveButton.addEventListener('click', saveParsedCDBabyData);
  }
}

// 전역 함수로 노출 (HTML onclick에서 사용)
window.updateChannelStatus = updateChannelStatus;
window.updateTrackRequestStatus = updateTrackRequestStatus;
window.updateTrackRequestISRC = updateTrackRequestISRC;
window.deleteUserWithConfirm = deleteUserWithConfirm;
window.deleteContentLinkWithConfirm = deleteContentLinkWithConfirm;
window.deleteTrackWithConfirm = deleteTrackWithConfirm;
window.deleteAccountWithConfirm = deleteAccountWithConfirm;
window.parseCDBabyReport = parseCDBabyReport;
window.saveParsedCDBabyData = saveParsedCDBabyData;
window.viewTrackRequestDetail = viewTrackRequestDetail;
window.previewTrackRequestCover = previewTrackRequestCover;
window.deleteTrackRequestWithConfirm = deleteTrackRequestWithConfirm;
window.saveISRC = saveISRC;
window.saveTrackTitle = saveTrackTitle;
window.saveArtistName = saveArtistName;
window.saveDepositor = saveDepositor;

const modal = document.getElementById('content-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalBody = document.getElementById('modal-body')?.querySelector('pre');

function showModal(content) {
    if (!modal || !modalBody) return;
    modalBody.textContent = content;
    modal.style.display = 'flex';
}

function hideModal() {
    if (!modal) return;
    modal.style.display = 'none';
    if (modalBody) modalBody.textContent = '';
}

function initModal() {
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal();
            }
        });
    }
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', hideModal);
    }
}

// === 트랙 요청: ISRC 저장 ===
async function saveISRC(requestId) {
  try {
    const input = document.getElementById('isrc-edit-input');
    if (!input) {
      alert('ISRC 입력 필드를 찾을 수 없습니다.');
      return;
    }
    const newISRC = input.value.trim();
    if (!newISRC) {
      alert('ISRC를 입력해주세요.');
      input.focus();
      return;
    }
    
    // Firestore 업데이트
    const requestRef = doc(db, 'track_requests', requestId);
    await updateDoc(requestRef, {
      ISRC: newISRC,
      updatedAt: new Date()
    });
    
    alert(`✅ ISRC가 저장되었습니다: ${newISRC}`);
    
    // 테이블 새로고침
    loadTrackRequestsTable();
  } catch (err) {
    console.error('ISRC 저장 오류:', err);
    alert('ISRC 저장 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
  }
}

// === 트랙 요청: 입금자명 저장 ===
async function saveDepositor(requestId) {
  try {
    const input = document.getElementById('depositor-edit-input');
    if (!input) {
      alert('입금자 입력 필드를 찾을 수 없습니다.');
      return;
    }
    const newDepositor = input.value.trim();
    if (!newDepositor) {
      alert('입금자 명을 입력해주세요.');
      input.focus();
      return;
    }
    const requestRef = doc(db, 'track_requests', requestId);
    await updateDoc(requestRef, {
      depositor: newDepositor,
      updatedAt: new Date()
    });
    alert(`✅ 입금자 명이 저장되었습니다: ${newDepositor}`);
    loadTrackRequestsTable();
  } catch (err) {
    console.error('입금자 저장 오류:', err);
    alert('입금자 저장 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
  }
}
// === 트랙 요청: 제목 저장 ===
async function saveTrackTitle(requestId) {
  try {
    const input = document.getElementById('track-title-edit-input');
    if (!input) {
      alert('트랙 제목 입력 필드를 찾을 수 없습니다.');
      return;
    }
    const newTitle = input.value.trim();
    if (!newTitle) {
      alert('트랙 제목을 입력해주세요.');
      input.focus();
      return;
    }
    const requestRef = doc(db, 'track_requests', requestId);
    await updateDoc(requestRef, {
      trackTitle: newTitle,
      title: newTitle,
      updatedAt: new Date()
    });
    alert(`✅ 트랙 제목이 저장되었습니다: ${newTitle}`);
    loadTrackRequestsTable();
  } catch (err) {
    console.error('트랙 제목 저장 오류:', err);
    alert('트랙 제목 저장 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
  }
}

// === 트랙 요청: 아티스트 저장 ===
async function saveArtistName(requestId) {
  try {
    const input = document.getElementById('artist-name-edit-input');
    if (!input) {
      alert('아티스트 입력 필드를 찾을 수 없습니다.');
      return;
    }
    const newArtist = input.value.trim();
    if (!newArtist) {
      alert('아티스트명을 입력해주세요.');
      input.focus();
      return;
    }
    const requestRef = doc(db, 'track_requests', requestId);
    await updateDoc(requestRef, {
      artistName: newArtist,
      artist: newArtist,
      updatedAt: new Date()
    });
    alert(`✅ 아티스트명이 저장되었습니다: ${newArtist}`);
    loadTrackRequestsTable();
  } catch (err) {
    console.error('아티스트 저장 오류:', err);
    alert('아티스트 저장 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
  }
}
// === 트랙 요청: 자세히 보기 ===
async function viewTrackRequestDetail(requestId) {
  try {
    const requestRef = doc(db, 'track_requests', requestId);
    const snap = await getDoc(requestRef);
    if (!snap.exists()) {
      alert('요청 문서를 찾을 수 없습니다.');
      return;
    }
    const data = snap.data();
    const ca = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : (data.createdAt ? new Date(data.createdAt) : null));
    const ua = data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt?.seconds ? new Date(data.updatedAt.seconds * 1000) : (data.updatedAt ? new Date(data.updatedAt) : null));
    const fmt = (d) => (d && !isNaN(d)) ? d.toLocaleString('ko-KR') : '-';
    const detailHtml = `
<div style="display:grid; gap:16px;">
  <div style="display:grid; grid-template-columns: 140px 1fr; gap:12px 16px;">
    <div style="color:#86868b; font-weight:600; font-size:14px;">트랙 제목</div>
    <div style="display:flex; align-items:center; gap:8px;">
      <input 
        type="text" 
        id="track-title-edit-input" 
        value="${(data.trackTitle || data.title || '').toString()}" 
        placeholder="트랙 제목"
        style="flex:1; padding:8px 12px; border:1px solid #e8e8ed; border-radius:8px; font-size:14px; color:#1d1d1f; font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',system-ui,sans-serif; transition:all 0.3s ease;"
        onfocus="this.style.borderColor='#0071e3'; this.style.boxShadow='0 0 0 4px rgba(0,113,227,0.1)';"
        onblur="this.style.borderColor='#e8e8ed'; this.style.boxShadow='none';"
      />
      <button 
        onclick="saveTrackTitle('${requestId}')" 
        style="padding:8px 16px; background:#0071e3; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.3s ease; white-space:nowrap;"
        onmouseover="this.style.background='#0077ed'; this.style.transform='translateY(-1px)'"
        onmouseout="this.style.background='#0071e3'; this.style.transform='translateY(0)'"
      >저장</button>
    </div>
    <div style="color:#86868b; font-weight:600; font-size:14px;">아티스트</div>
    <div style="display:flex; align-items:center; gap:8px;">
      <input 
        type="text" 
        id="artist-name-edit-input" 
        value="${(data.artistName || data.artist || '').toString()}" 
        placeholder="아티스트 명"
        style="flex:1; padding:8px 12px; border:1px solid #e8e8ed; border-radius:8px; font-size:14px; color:#1d1d1f; font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',system-ui,sans-serif; transition:all 0.3s ease;"
        onfocus="this.style.borderColor='#0071e3'; this.style.boxShadow='0 0 0 4px rgba(0,113,227,0.1)';"
        onblur="this.style.borderColor='#e8e8ed'; this.style.boxShadow='none';"
      />
      <button 
        onclick="saveArtistName('${requestId}')" 
        style="padding:8px 16px; background:#0071e3; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.3s ease; white-space:nowrap;"
        onmouseover="this.style.background='#0077ed'; this.style.transform='translateY(-1px)'"
        onmouseout="this.style.background='#0071e3'; this.style.transform='translateY(0)'"
      >저장</button>
    </div>
    <div style="color:#86868b; font-weight:600; font-size:14px;">이메일</div>
    <div style="color:#1d1d1f;">${data.email || data.userEmail || '-'}</div>
    <div style="color:#86868b; font-weight:600; font-size:14px;">장르</div>
    <div style="color:#1d1d1f;">${data.genre || data.category || '-'}</div>
    <div style="color:#86868b; font-weight:600; font-size:14px;">레퍼런스 URL</div>
    <div style="color:#1d1d1f; word-break:break-all;">${data.referenceUrl || data.refUrl || data.sampleUrl || '-'}</div>
    <div style="color:#86868b; font-weight:600; font-size:14px;">ISRC</div>
    <div style="display:flex; align-items:center; gap:8px;">
      <input 
        type="text" 
        id="isrc-edit-input" 
        value="${data.ISRC || ''}" 
        placeholder="ISRC 입력 (예: USRC17607839)"
        style="flex:1; padding:8px 12px; border:1px solid #e8e8ed; border-radius:8px; font-size:14px; color:#1d1d1f; font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',system-ui,sans-serif; transition:all 0.3s ease;"
        onfocus="this.style.borderColor='#0071e3'; this.style.boxShadow='0 0 0 4px rgba(0,113,227,0.1)';"
        onblur="this.style.borderColor='#e8e8ed'; this.style.boxShadow='none';"
      />
      <button 
        onclick="saveISRC('${requestId}')" 
        style="padding:8px 16px; background:#0071e3; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.3s ease; white-space:nowrap;"
        onmouseover="this.style.background='#0077ed'; this.style.transform='translateY(-1px)'"
        onmouseout="this.style.background='#0071e3'; this.style.transform='translateY(0)'"
      >저장</button>
    </div>
    <div style="color:#86868b; font-weight:600; font-size:14px;">입금자 명</div>
    <div style="display:flex; align-items:center; gap:8px;">
      <input 
        type="text" 
        id="depositor-edit-input" 
        value="${(data.depositor || '').toString()}" 
        placeholder="입금자 명"
        style="flex:1; padding:8px 12px; border:1px solid #e8e8ed; border-radius:8px; font-size:14px; color:#1d1d1f; font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',system-ui,sans-serif; transition:all 0.3s ease;"
        onfocus="this.style.borderColor='#0071e3'; this.style.boxShadow='0 0 0 4px rgba(0,113,227,0.1)';"
        onblur="this.style.borderColor='#e8e8ed'; this.style.boxShadow='none';"
      />
      <button 
        onclick="saveDepositor('${requestId}')" 
        style="padding:8px 16px; background:#0071e3; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.3s ease; white-space:nowrap;"
        onmouseover="this.style.background='#0077ed'; this.style.transform='translateY(-1px)'"
        onmouseout="this.style.background='#0071e3'; this.style.transform='translateY(0)'"
      >저장</button>
    </div>
    <div style="color:#86868b; font-weight:600; font-size:14px;">상태</div>
    <div style="color:#1d1d1f;">${data.status || '-'}</div>
    <div style="color:#86868b; font-weight:600; font-size:14px;">요청일</div>
    <div style="color:#1d1d1f;">${fmt(ca)}</div>
    <div style="color:#86868b; font-weight:600; font-size:14px;">갱신일</div>
    <div style="color:#1d1d1f;">${fmt(ua)}</div>
  </div>
  <div style="height:1px; background:#e8e8ed; margin:8px 0;"></div>
  <div>
    <div style="color:#1d1d1f; font-weight:700; margin-bottom:10px; font-size:16px;">상세 요청 내용</div>
    <div style="white-space:pre-wrap; line-height:1.7; color:#1d1d1f; font-size:15px;">${(data.description || data.request || '').toString() || '(내용 없음)'}</div>
  </div>
</div>`;
    if (modal && document.getElementById('modal-body')) {
      document.getElementById('modal-body').innerHTML = detailHtml;
      modal.style.display = 'flex';
    } else {
      alert('모달 요소를 찾을 수 없습니다.');
    }
  } catch (err) {
    console.error('자세히 보기 오류:', err);
    alert('자세히 보기 중 오류가 발생했습니다.');
  }
}

// === 트랙 요청: 커버 미리보기 ===
async function previewTrackRequestCover(requestId) {
  try {
    const requestRef = doc(db, 'track_requests', requestId);
    const snap = await getDoc(requestRef);
    if (!snap.exists()) {
      alert('요청 문서를 찾을 수 없습니다.');
      return;
    }
    const data = snap.data();
    const coverUrl = data.coverUrl || data.cover || data.coverImage || data.coverArtUrl || data.imageUrl || data.image || '';
    if (!coverUrl) {
      alert('커버 이미지가 없습니다.');
      return;
    }
    // 새 탭으로 크게 보기
    window.open(coverUrl, '_blank');
  } catch (err) {
    console.error('커버 미리보기 오류:', err);
    alert('커버 미리보기 중 오류가 발생했습니다.');
  }
}

// === 트랙 요청: 문서 삭제 ===
async function deleteTrackRequestWithConfirm(requestId) {
  try {
    if (!confirm(`트랙 요청 삭제: ${requestId}\n정말 삭제하시겠습니까?`)) return;
    await deleteDoc(doc(db, 'track_requests', requestId));
    await loadTrackRequestsTable();
    alert('트랙 요청이 삭제되었습니다.');
  } catch (err) {
    console.error('트랙 요청 삭제 오류:', err);
    alert('삭제 중 오류가 발생했습니다.');
  }
}

function main() {
  initGate();
  bindEvents();
  bindPresetButtons();
  showProjectInfo();
  initAdminAuth();
  bindTrackUploadUI();
  initModal();
  setupCDBabyEventListeners();
}

// CD Baby 업로드 기록 로드 및 표시
async function loadCDBabyUploadHistory() {
  try {
    const tbody = document.getElementById('cdbaby-upload-history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const snapshot = await getDocs(query(collection(db, 'cdbaby_upload_history'), orderBy('timestamp', 'desc')));
    const historyRecords = [];
    const uids = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      historyRecords.push({ id: doc.id, ...data });
      if (data.uploadedBy) uids.add(data.uploadedBy);
    });

    const userInfoMap = await getUserInfoMap(Array.from(uids));

    if (historyRecords.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#6b7280; padding:20px;">업로드 기록이 없습니다.</td></tr>';
      return;
    }

    historyRecords.forEach(record => {
      const row = document.createElement('tr');
      const uploadDate = record.timestamp?.toDate ? record.timestamp.toDate() : (record.timestamp && record.timestamp.seconds ? new Date(record.timestamp.seconds * 1000) : null);
      const dateStr = uploadDate ? uploadDate.toLocaleString('ko-KR') : '-';
      const uploaderInfo = userInfoMap[record.uploadedBy] || {};
      const uploaderName = uploaderInfo.nickname || uploaderInfo.displayName || uploaderInfo.username || record.uploadedBy || '-';

      row.innerHTML = `
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${dateStr}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${record.fileName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${uploaderName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${record.totalRecords}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${record.mappedRecordsCount}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${record.unmappedRecordsCount}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">₩${record.totalEarnings.toLocaleString()}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('CD Baby 업로드 기록 로드 실패:', err);
    const tbody = document.getElementById('cdbaby-upload-history-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#dc2626; padding:20px;">기록 로드 실패: ${err?.message || '알 수 없는 오류'}</td></tr>`;
  }
}

function bindPresetButtons() {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const collectionName = btn.dataset.collection;
      collectionInput.value = collectionName;
      
      if (collectionName === 'users') {
        await loadUsersTable();
        const providerSelect = document.getElementById('filter-users-provider');
        const searchInput = document.getElementById('filter-users');
        if (providerSelect) providerSelect.onchange = () => loadUsersTable();
        if (searchInput) searchInput.oninput = () => loadUsersTable();
      } else if (collectionName === 'channels') {
        await loadChannelsTable();
        // 정렬 select 변경 시 다시 로드
        const sortSelect = document.getElementById('filter-channels-sort');
        if (sortSelect) {
          sortSelect.onchange = () => loadChannelsTable();
        }
        const statusSelect = document.getElementById('filter-channels-status');
        if (statusSelect) {
          statusSelect.onchange = () => loadChannelsTable();
        }
        const searchInput = document.getElementById('filter-channels');
        if (searchInput) {
          searchInput.oninput = () => loadChannelsTable();
        }
      } else if (collectionName === 'contentLinks') {
        await loadContentLinksTable();
        const searchInput = document.getElementById('filter-content-links');
        if (searchInput) searchInput.oninput = () => loadContentLinksTable();
      } else if (collectionName === 'track_requests') {
        await loadTrackRequestsTable();
        const searchInput = document.getElementById('filter-track-requests');
        if (searchInput) searchInput.oninput = () => loadTrackRequestsTable();
        const statusSelect = document.getElementById('filter-track-requests-status');
        if (statusSelect) statusSelect.onchange = () => loadTrackRequestsTable();
      } else if (collectionName === 'track_new') {
        await loadTracksTable();
        // 제목 검색 oninput 바인딩
        const searchInput = document.getElementById('filter-tracks');
        if (searchInput) searchInput.oninput = () => loadTracksTable();
        // 업로드 UI 재바인딩 (동적 요소 대비)
        bindTrackUploadUI();
      } else if (collectionName === 'user_withdraw_accounts') {
        await loadAccountsTable();
        const searchInput = document.getElementById('filter-accounts');
        if (searchInput) searchInput.oninput = () => loadAccountsTable();
      } else if (collectionName === 'cdbaby-reports') {
        // CD Baby 리포트 섹션 표시 (특별한 데이터 로딩 없음)
        showTableView('cdbaby-reports');
        await loadCDBabyUploadHistory(); // <--- Add this line
      } else {
        // 기본 컬렉션 로드
        await loadCollection(collectionName);
      }
      
      switchView(collectionName);
    });
  });
}

document.addEventListener('DOMContentLoaded', main);


