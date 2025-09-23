// js/admin.js
import { db } from './firebase.js';
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

const currentPathEl = document.getElementById('current-path');
const docJsonEl = document.getElementById('doc-json');
const newDocIdEl = document.getElementById('new-doc-id');
const createDocBtn = document.getElementById('btn-create-doc');
const saveDocBtn = document.getElementById('btn-save-doc');
const refreshDocBtn = document.getElementById('btn-refresh-doc');
const deleteDocBtn = document.getElementById('btn-delete-doc');

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
        badge.style.background = isAdmin ? '#dcfce7' : '#fee2e2';
        badge.style.color = isAdmin ? '#166534' : '#b91c1c';
      });
      btnLogin.style.display = 'none';
      btnLogout.style.display = 'inline-block';
    } else {
      emailEl.textContent = '';
      badge.textContent = 'ADMIN: OFF';
      badge.style.background = '#fee2e2';
      badge.style.color = '#b91c1c';
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
  currentPathEl.textContent = '';
  docJsonEl.value = '';
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

      const openBtn = document.createElement('button');
      openBtn.textContent = '열기';
      openBtn.addEventListener('click', () => loadDocument(item.id));

      const delBtn = document.createElement('button');
      delBtn.textContent = '삭제';
      delBtn.className = 'danger';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`문서 삭제: ${item.id} \n정말 삭제하시겠습니까?`)) return;
        await deleteDoc(doc(db, currentCollectionName, item.id));
        if (item.id === currentDocId) {
          currentDocId = '';
          docJsonEl.value = '';
          currentPathEl.textContent = '';
        }
        await loadCollection(currentCollectionName);
      });

      actions.appendChild(openBtn);
      actions.appendChild(delBtn);
      li.appendChild(left);
      li.appendChild(actions);
      docListEl.appendChild(li);
    }
  } catch (err) {
    alert('컬렉션 로드 실패: ' + (err?.message || err));
  }
}

async function loadDocument(docId) {
  if (!currentCollectionName || !docId) return;
  try {
    const ref = doc(db, currentCollectionName, docId);
    const snap = await getDoc(ref);
    currentDocId = docId;
    currentPathEl.textContent = `${currentCollectionName}/${docId}`;
    if (snap.exists()) {
      const data = snap.data();
      docJsonEl.value = JSON.stringify(data, null, 2);
    } else {
      docJsonEl.value = '{}';
    }
  } catch (err) {
    alert('문서 로드 실패: ' + (err?.message || err));
  }
}

async function createDocument() {
  if (!currentCollectionName) {
    alert('먼저 컬렉션을 입력 후 불러오세요.');
    return;
  }
  let json; try { json = docJsonEl.value.trim() ? JSON.parse(docJsonEl.value) : {}; } catch (e) { alert('유효한 JSON이 아닙니다.'); return; }
  const newId = newDocIdEl.value.trim();
  try {
    if (newId) {
      await setDoc(doc(db, currentCollectionName, newId), json, { merge: true });
      currentDocId = newId;
    } else {
      const res = await addDoc(collection(db, currentCollectionName), json);
      currentDocId = res.id;
    }
    newDocIdEl.value = '';
    await loadCollection(currentCollectionName);
    await loadDocument(currentDocId);
  } catch (err) {
    alert('문서 생성 실패: ' + (err?.message || err));
  }
}

async function saveDocument() {
  if (!currentCollectionName || !currentDocId) {
    alert('열린 문서가 없습니다. 먼저 문서를 선택하거나 새로 생성하세요.');
    return;
  }
  let json; try { json = docJsonEl.value.trim() ? JSON.parse(docJsonEl.value) : {}; } catch (e) { alert('유효한 JSON이 아닙니다.'); return; }
  try {
    await setDoc(doc(db, currentCollectionName, currentDocId), json, { merge: true });
    alert('저장되었습니다.');
  } catch (err) {
    alert('저장 실패: ' + (err?.message || err));
  }
}

async function refreshDocument() {
  if (!currentCollectionName || !currentDocId) return;
  await loadDocument(currentDocId);
}

async function deleteCurrentDocument() {
  if (!currentCollectionName || !currentDocId) return;
  if (!confirm(`문서 삭제: ${currentCollectionName}/${currentDocId} \n정말 삭제하시겠습니까?`)) return;
  try {
    await deleteDoc(doc(db, currentCollectionName, currentDocId));
    currentDocId = '';
    docJsonEl.value = '';
    currentPathEl.textContent = '';
    await loadCollection(currentCollectionName);
  } catch (err) {
    alert('삭제 실패: ' + (err?.message || err));
  }
}

function bindEvents() {
  loadCollectionBtn.addEventListener('click', () => {
    loadCollection(collectionInput.value.trim());
  });
  collectionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadCollectionBtn.click();
  });
  createDocBtn.addEventListener('click', createDocument);
  saveDocBtn.addEventListener('click', saveDocument);
  refreshDocBtn.addEventListener('click', refreshDocument);
  deleteDocBtn.addEventListener('click', deleteCurrentDocument);
}

function showProjectInfo() {
  // firebase.js에서 콘솔로 projectId를 출력하고 있으므로, location으로 간단히 표기
  try {
    // 프로젝트 ID는 SDK에서 직접 노출 API가 없으므로 알려진 값으로만 표기
    projectIdEl.textContent = '(audionyx-a7b2e)';
  } catch {}
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

    // 가입방식 필터
    const providerFilter = (document.getElementById('filter-users-provider')?.value || '').trim();
    const filteredUsers = providerFilter ? users.filter(u => (u.provider || '').toLowerCase() === providerFilter.toLowerCase()) : users;

    filteredUsers.forEach(user => {
      const row = document.createElement('tr');
      const createdAt = user.createdAt?.toDate ? user.createdAt.toDate() : (user.createdAt && user.createdAt.seconds ? new Date(user.createdAt.seconds * 1000) : (typeof user.createdAt === 'string' || typeof user.createdAt === 'number' ? new Date(user.createdAt) : null));
      const createdStr = (createdAt && !isNaN(createdAt.getTime())) ? createdAt.toLocaleDateString('ko-KR') : '-';
      
      row.innerHTML = `
        <td>${user.displayName || user.nickname || '-'}</td>
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
      filtered = filtered.filter(r => (
        (r.url || '').toLowerCase().includes(keyword) ||
        (r.originalUrl || '').toLowerCase().includes(keyword) ||
        (r.platform || '').toLowerCase().includes(keyword)
      ));
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
      const createdStr = (chDate && !isNaN(chDate.getTime())) ? chDate.toLocaleDateString('ko-KR') : '-';
      const normalizedStatus = channel.status || 'pending';
      const sanitizedStatus = String(normalizedStatus).replace(/\s+/g, '_');
      const statusClass = `status-${sanitizedStatus}`;
      
      const owner = ownerMap[channel.userId] || {};
      const displayName = owner.nickname || channel.userId;
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
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#6b7280; padding:20px;">등록된 트랙 요청이 없습니다.</td></tr>';
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
    const inProdEl = document.getElementById('track-inprod-count');
    const notProdEl = document.getElementById('track-notprod-count');
    const totalCnt = requests.length;
    const inProdCnt = requests.filter(r => (r.status === '제작중')).length;
    const notProdCnt = requests.filter(r => (r.status === '미제작')).length;
    if (totalEl) totalEl.textContent = String(totalCnt);
    if (inProdEl) inProdEl.textContent = String(inProdCnt);
    if (notProdEl) notProdEl.textContent = String(notProdCnt);

    // 상태 필터 적용 (선택 시)
    const statusFilter = (document.getElementById('filter-track-requests-status')?.value || '').trim();
    const filtered = statusFilter ? requests.filter(r => (r.status || '').toLowerCase() === statusFilter.toLowerCase()) : requests;

    filtered.forEach(request => {
      const row = document.createElement('tr');
      const createdAt = request.createdAt?.toDate?.() || null;
      const createdStr = createdAt ? createdAt.toLocaleDateString('ko-KR') : '-';
      const normalized = request.status || 'pending';
      let statusClass = `status-${normalized}`;
      if (normalized === '제작중') statusClass = 'status-제작중';
      if (normalized === '미제작') statusClass = 'status-미제작';
      const refUrl = request.referenceUrl || request.refUrl || request.sampleUrl || '';
      const displayRef = refUrl ? (refUrl.length > 60 ? refUrl.slice(0,60)+'...' : refUrl) : '-';
      const genre = request.genre || request.category || '-';
      const desc = (request.description || request.request || '').toString();
      const displayDesc = desc.length > 60 ? desc.slice(0,60)+'...' : desc;
      const mapped = uidToUser[request.uid] || {};
      const displayName = mapped.nickname || request.uid || '-';
      const displayEmail = mapped.email || request.userEmail || '-';
      
      row.innerHTML = `
        <td>${displayName}</td>
        <td>${displayEmail}</td>
        <td>${genre}</td>
        <td>${refUrl ? `<a href="${refUrl}" target="_blank" style="color:#3b82f6;">${displayRef}</a>` : '-'}</td>
        <td>${displayDesc}</td>
        <td>${createdStr}</td>
        <td><span class="status-badge ${statusClass}">${normalized}</span></td>
      `;
      tbody.appendChild(row);
    });

    collectionsData.track_requests = requests;
  } catch (err) {
    console.error('트랙 요청 데이터 로드 오류:', err);
    const tbody = document.getElementById('track-requests-tbody');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#dc2626; padding:20px;">데이터 로드 실패: ${err?.message || '권한이 없거나 컬렉션이 존재하지 않습니다'}</td></tr>`;
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

    // 카운트 표시
    const cntEl = document.getElementById('content-links-count');
    if (cntEl) cntEl.textContent = String(linkRows.length);

    if (linkRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#6b7280; padding:20px;">등록된 콘텐츠링크가 없습니다.</td></tr>';
      return;
    }

    linkRows.forEach(link => {
      const row = document.createElement('tr');
      const lDate = link.createdAt ? (link.createdAt.toDate ? link.createdAt.toDate() : (link.createdAt.seconds ? new Date(link.createdAt.seconds * 1000) : new Date(link.createdAt))) : null;
      const createdStr = (lDate && !isNaN(lDate.getTime())) ? lDate.toLocaleDateString('ko-KR') : '-';
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
      const displayName = owner.nickname || link.userId;
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

    // 등록일 기준 최신순 정렬
    tracks.sort((a, b) => {
      const aDate = a.createdAt?.toDate?.() || new Date(0);
      const bDate = b.createdAt?.toDate?.() || new Date(0);
      return bDate - aDate;
    });

    tracks.forEach(track => {
      const row = document.createElement('tr');
      const createdAt = track.createdAt?.toDate?.() || null;
      const createdStr = createdAt ? createdAt.toLocaleDateString('ko-KR') : '-';
      const duration = track.duration ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}` : '-';
      
      row.innerHTML = `
        <td>${track.title || '-'}</td>
        <td>${track.artist || '-'}</td>
        <td>${track.genre || '-'}</td>
        <td>${duration}</td>
        <td>${createdStr}</td>
        <td>
          <div class="table-actions">
            <button class="btn-edit" onclick="loadDocument('${track.id}')">편집</button>
            <button class="btn-delete" onclick="deleteTrackWithConfirm('${track.id}')">삭제</button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });

    collectionsData.track_new = tracks;
  } catch (err) {
    alert('음원 데이터 로드 실패: ' + (err?.message || err));
  }
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

    accounts.forEach(account => {
      const row = document.createElement('tr');
      const rawDate = account.createdAt || account.updatedAt || null;
      const createdAt = rawDate
        ? (rawDate.toDate ? rawDate.toDate()
           : (rawDate.seconds ? new Date(rawDate.seconds * 1000)
              : (typeof rawDate === 'string' || typeof rawDate === 'number' ? new Date(rawDate) : null)))
        : null;
      const createdStr = (createdAt && !isNaN(createdAt.getTime())) ? createdAt.toLocaleDateString('ko-KR') : '-';
      const owner = ownerMap[account.id] || {};
      const displayName = owner.nickname || account.id;
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

// 전역 함수로 노출 (HTML onclick에서 사용)
window.loadDocument = loadDocument;
window.updateChannelStatus = updateChannelStatus;
window.updateTrackRequestStatus = updateTrackRequestStatus;
window.deleteUserWithConfirm = deleteUserWithConfirm;
window.deleteContentLinkWithConfirm = deleteContentLinkWithConfirm;
window.deleteTrackWithConfirm = deleteTrackWithConfirm;
window.deleteAccountWithConfirm = deleteAccountWithConfirm;

function main() {
  initGate();
  bindEvents();
  bindPresetButtons();
  showProjectInfo();
  initAdminAuth();
}

function bindPresetButtons() {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const collectionName = btn.dataset.collection;
      collectionInput.value = collectionName;
      
      if (collectionName === 'users') {
        await loadUsersTable();
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
      } else if (collectionName === 'track_requests') {
        await loadTrackRequestsTable();
      } else if (collectionName === 'track_new') {
        await loadTracksTable();
      } else if (collectionName === 'user_withdraw_accounts') {
        await loadAccountsTable();
      } else {
        // 기본 컬렉션 로드
        await loadCollection(collectionName);
      }
      
      switchView(collectionName);
    });
  });
}

document.addEventListener('DOMContentLoaded', main);


