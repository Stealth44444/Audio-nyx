// WaveSurfer import
import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';
// Firebase Storage 관련 모듈들을 firebase.js에서 가져옵니다.
import { app, db, storage } from './firebase.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';
import { ref, listAll, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-storage.js';
// 인증 관련 기능을 위해 auth.js 모듈 가져오기
import './auth.js';

console.log("[find-music.js] 스크립트 최상단 실행됨"); // 최상단 로그 추가

// Firebase Storage 파일 목록 캐시
let storageTrackFiles = [];

// 전역 변수
let tracks = []; // Firebase에서 가져온 트랙 데이터
let filteredTracks = []; // 필터링된 트랙을 전역적으로 저장 (초기값을 빈 배열로)
let currentPage = 1;
const tracksPerPage = 12; // 페이지 당 트랙 수

let activeWaveSurferInstances = []; //  새로운 전역 인스턴스 배열

// Mini Player 전역 변수 - 중요: 모든 DOM 참조 제거
let miniWavesurfer = null;
let currentMainWavesurferForMiniPlayer = null; // 현재 미니 플레이어와 연결된 메인 WaveSurfer

// 전역 변수에 currentPlayingWavesurfer 추가
let currentPlayingWavesurfer = null;

// 새로운 태그 매핑 시스템 - 영문 태그를 한국어로 매핑
const tagMappings = {
  mood: {
    // 새 태그와 기존 태그 매핑 (storage에서 로드할 때 사용)
    'energetic': ['energetic', 'powerful', 'exciting'],
    'inspiring': ['inspiring', 'hopeful', 'uplifting'],
    'chill': ['chill', 'peaceful', 'carefree', 'calm', 'relaxing'],
    'romantic': ['romantic', 'love', 'sexy'],
    'playful': ['playful', 'funny', 'light-hearted'],
    'groovy': ['groovy', 'sexy', 'funky'],
    'epic': ['epic', 'dramatic', 'cinematic'],
    'dramatic': ['dramatic', 'serious'],
    'dark': ['dark', 'moody', 'gothic'],
    'tense': ['tense', 'suspenseful', 'tension'],
    'aggressive': ['aggressive', 'angry', 'powerful'],
    'mysterious': ['mysterious', 'scary', 'enigmatic']
  },
  usecase: {
    // 새 태그와 기존 태그 매핑
    'docu_education': ['documentary', 'education', 'science', 'study'],
    'travel_aerial': ['travel', 'drone', 'aerial', 'scenic'],
    'fashion_beauty': ['fashion', 'beauty', 'runway', 'lifestyle'],
    'lifestyle_vlog': ['vlog', 'lifestyle', 'daily', 'morning vlog', 'night chill'],
    'gaming_esports': ['gaming', 'esports', 'game', 'competitive'],
    'tech_innovation': ['tech', 'technology', 'innovation', 'unbox', 'review'],
    'animation_narration': ['animation', 'kids', 'cartoon', 'narration'],
    'party_events': ['party', 'event', 'celebration', 'entertainment'],
    'wellness_asmr': ['wellness', 'meditation', 'asmr', 'rain asmr', 'ambient'],
    'sports_motivation': ['sports', 'fitness', 'workout', 'motivation'],
    'pets_nature': ['pets', 'nature', 'animals', 'cute pets'],
    'trailers_branding': ['trailer', 'branding', 'intro', 'logo', 'cinematic'],
    'diy_howto': ['diy', 'tutorial', 'how-to', 'recipe'],
    'holiday_seasonal': ['holiday', 'seasonal', 'christmas', 'halloween'],
    'art_culture': ['art', 'culture', 'creative', 'performance'],
    'news_affairs': ['news', 'current affairs', 'business'],
    'drive': ['drive', 'automotive', 'car', 'transportation']
  }
};

// 태그 매핑 함수 - storage의 영문 태그를 새 시스템에 매핑
function mapTagToNewSystem(originalTag, type) {
  if (!originalTag) return null;
  
  const mappings = tagMappings[type];
  if (!mappings) return null;
  
  const lowerTag = originalTag.toLowerCase();
  
  // 새 태그 시스템에서 매칭되는 것 찾기
  for (const [newTag, oldTags] of Object.entries(mappings)) {
    if (oldTags.some(oldTag => lowerTag.includes(oldTag.toLowerCase()) || oldTag.toLowerCase().includes(lowerTag))) {
      return newTag;
    }
  }
  
  return null;
}

// 영문 태그를 한국어로 변환하는 매핑 시스템 (2025 업데이트)
const tagKoreanMappings = {
  mood: {
    // === 새 태그 매핑 (우선순위) ===
    'joyful': '즐거운/신나는', // 밝고 경쾌한 긍정 에너지
    'energetic': '에너지틱', // BPM 빠르고 활동적인 느낌
    'inspiring': '감동/희망', // 용기·긍정·희망 고조
    'chill': '편안/여유', // 로파이·카페·브이로그용
    'romantic': '로맨틱', // 사랑·달콤·따뜻함
    'playful': '장난/귀여움', // 게임·코믹·키즈
    'groovy': '그루비/펑키', // 리듬·스윙·댄스
    'epic': '웅장/스케일', // 영화 트레일러·게임 OST
    'dramatic': '드라마틱', // 감정 기승전결, 서사
    'dark': '다크', // 음울·딥·고딕
    'tense': '긴장/서스펜스', // 비트·펄스·몰입
    'aggressive': '공격적/분노', // 하드록·트랩·배틀
    'mysterious': '미스터리', // 몽환·SF·퍼즐
    'sad': '슬픔/우울', // 발라드·이별·회상
    
    // === 기존 태그 호환성 매핑 ===
    'powerful': '에너지틱', // → Energetic 매핑
    'exciting': '에너지틱', // → Energetic 매핑
    'hopeful': '감동/희망', // → Inspiring 매핑
    'uplifting': '감동/희망', // → Inspiring 매핑
    'peaceful': '편안/여유', // → Chill 매핑
    'carefree': '편안/여유', // → Chill 매핑
    'love': '로맨틱', // → Romantic 매핑
    'sexy': '로맨틱', // → Romantic 매핑
    'funny': '장난/귀여움', // → Playful 매핑
    'serious': '드라마틱', // → Dramatic 매핑
    'angry': '공격적/분노', // → Aggressive 매핑
    'scary': '미스터리', // → Mysterious (soft) 매핑
    
    // === 추가 호환 태그들 ===
    'calm': '편안/여유',
    'melancholic': '슬픔/우울', // → Sad 매핑
    'nostalgic': '로맨틱',
    'cheerful': '즐거운/신나는', // → Joyful 매핑
    'suspenseful': '긴장/서스펜스',
    'cinematic': '웅장/스케일',
    'ambient': '편안/여유',
    'emotional': '드라마틱',
    'dreamy': '로맨틱',
    'intense': '긴장/서스펜스',
    'gentle': '편안/여유',
    'happy': '즐거운/신나는', // → Joyful 매핑
    'relaxing': '편안/여유',
    'funky': '그루비/펑키',
    'moody': '다크',
    'gothic': '다크',
    'tension': '긴장/서스펜스',
    'enigmatic': '미스터리'
  },
  usecase: {
    // === 새 태그 매핑 (우선순위) ===
    'docu / education & science': '다큐·교육·과학',
    'docu_education': '다큐·교육·과학', // 호환성 유지
    'documentary_education': '다큐·교육·과학',
    'education_science': '다큐·교육·과학',
    
    'travel & aerial scenic': '여행·드론·풍경', 
    'travel_aerial': '여행·드론·풍경', // 호환성 유지
    'aerial_scenic': '여행·드론·풍경',
    
    'fashion & beauty': '패션·뷰티',
    'fashion_beauty': '패션·뷰티', // 호환성 유지
    
    'lifestyle / vlog': 'Vlog·라이프스타일',
    'lifestyle_vlog': 'Vlog·라이프스타일', // 호환성 유지
    'vlog_lifestyle': 'Vlog·라이프스타일',
    
    'gaming & esports': '게이밍·e스포츠',
    'gaming_esports': '게이밍·e스포츠', // 호환성 유지
    'gaming_e-sports': '게이밍·e스포츠',
    
    'tech & innovation': '테크·산업·혁신',
    'tech_innovation': '테크·산업·혁신', // 호환성 유지
    'technology_innovation': '테크·산업·혁신',
    
    'animation & narration': '애니메이션·나레이션',
    'animation_narration': '애니메이션·나레이션', // 호환성 유지
    
    'party, events & entertainment': '파티·이벤트·오락',
    'party_events': '파티·이벤트·오락', // 호환성 유지
    'events_entertainment': '파티·이벤트·오락',
    
    'wellness & asmr': '웰니스·명상·앰비언트',
    'wellness_asmr': '웰니스·명상·앰비언트', // 호환성 유지
    'meditation_asmr': '웰니스·명상·앰비언트',
    
    'motivation & sports': '스포츠·동기부여',
    'sports & motivation': '스포츠·동기부여', // 호환성 유지
    'sports_motivation': '스포츠·동기부여', // 호환성 유지
    
    'pets & nature': '펫·동물·자연',
    'pets_nature': '펫·동물·자연', // 호환성 유지
    'animals_nature': '펫·동물·자연',
    
    'trailers & branding': '트레일러·인트로·로고',
    'trailers_branding': '트레일러·인트로·로고', // 호환성 유지
    'branding_intro': '트레일러·인트로·로고',
    
    'diy & how-to': 'DIY·튜토리얼',
    'diy_howto': 'DIY·튜토리얼', // 호환성 유지
    'tutorial_howto': 'DIY·튜토리얼',
    
    'holiday & seasonal': '홀리데이·시즌별',
    'holiday_seasonal': '홀리데이·시즌별', // 호환성 유지
    'seasonal_holiday': '홀리데이·시즌별',
    
    'art & culture': '예술·문화',
    'art_culture': '예술·문화', // 호환성 유지
    'culture_art': '예술·문화',
    
    'news & current affairs': '뉴스·시사',
    'news_affairs': '뉴스·시사', // 호환성 유지
    'current_affairs': '뉴스·시사',
    
    'drive': '드라이브',
    'automotive': '드라이브',
    'car_review': '드라이브',
    
    // === 기존 단일 태그 호환성 매핑 ===
    'documentary': '다큐·교육·과학',
    'education': '다큐·교육·과학',
    'science': '다큐·교육·과학',
    'study': '다큐·교육·과학',
    'travel': '여행·드론·풍경',
    'drone': '여행·드론·풍경',
    'aerial': '여행·드론·풍경',
    'scenic': '여행·드론·풍경',
    'fashion': '패션·뷰티',
    'beauty': '패션·뷰티',
    'runway': '패션·뷰티',
    'lifestyle': 'Vlog·라이프스타일',
    'vlog': 'Vlog·라이프스타일',
    'daily': 'Vlog·라이프스타일',
    'gaming': '게이밍·e스포츠',
    'esports': '게이밍·e스포츠',
    'game': '게이밍·e스포츠',
    'competitive': '게이밍·e스포츠',
    'tech': '테크·산업·혁신',
    'technology': '테크·산업·혁신',
    'innovation': '테크·산업·혁신',
    'unbox': '테크·산업·혁신',
    'review': '테크·산업·혁신',
    'animation': '애니메이션·나레이션',
    'kids': '애니메이션·나레이션',
    'cartoon': '애니메이션·나레이션',
    'narration': '애니메이션·나레이션',
    'party': '파티·이벤트·오락',
    'event': '파티·이벤트·오락',
    'celebration': '파티·이벤트·오락',
    'entertainment': '파티·이벤트·오락',
    'wellness': '웰니스·명상·앰비언트',
    'meditation': '웰니스·명상·앰비언트',
    'asmr': '웰니스·명상·앰비언트',
    'rain asmr': '웰니스·명상·앰비언트',
    'ambient': '웰니스·명상·앰비언트',
    'sports': '스포츠·동기부여',
    'fitness': '스포츠·동기부여',
    'workout': '스포츠·동기부여',
    'motivation': '스포츠·동기부여',
    'pets': '펫·동물·자연',
    'nature': '펫·동물·자연',
    'animals': '펫·동물·자연',
    'trailer': '트레일러·인트로·로고',
    'branding': '트레일러·인트로·로고',
    'intro': '트레일러·인트로·로고',
    'logo': '트레일러·인트로·로고',
    'cinematic': '트레일러·인트로·로고',
    'diy': 'DIY·튜토리얼',
    'tutorial': 'DIY·튜토리얼',
    'how-to': 'DIY·튜토리얼',
    'recipe': 'DIY·튜토리얼',
    'holiday': '홀리데이·시즌별',
    'seasonal': '홀리데이·시즌별',
    'christmas': '홀리데이·시즌별',
    'halloween': '홀리데이·시즌별',
    'art': '예술·문화',
    'culture': '예술·문화',
    'creative': '예술·문화',
    'performance': '예술·문화',
    'news': '뉴스·시사',
    'current affairs': '뉴스·시사',
    'business': '뉴스·시사',
    'car': '드라이브',
    'transportation': '드라이브'
  }
};

// 영문 태그를 한국어로 변환하는 함수
function convertTagToKorean(tag, type) {
  if (!tag) return '';
  
  const mappings = tagKoreanMappings[type];
  if (!mappings) return tag;
  
  // 직접 매핑 확인
  if (mappings[tag]) {
    return mappings[tag];
  }
  
  // 소문자로 변환해서 확인
  const lowerTag = tag.toLowerCase();
  if (mappings[lowerTag]) {
    return mappings[lowerTag];
  }
  
  // 부분 매칭 확인
  for (const [englishTag, koreanTag] of Object.entries(mappings)) {
    if (lowerTag.includes(englishTag.toLowerCase()) || englishTag.toLowerCase().includes(lowerTag)) {
      return koreanTag;
    }
  }
  
  // 매핑이 없으면 원본 반환
  return tag;
}

// 검색어 자동완성 및 추천을 위한 데이터 구조
let searchSuggestions = {
  moods: new Set(),
  usecases: new Set(),
  titles: new Set()
};

// 검색어 자동완성 및 추천 데이터 초기화
function initializeSearchSuggestions() {
  tracks.forEach(track => {
    if (track.mood) track.mood.forEach(m => searchSuggestions.moods.add(m.toLowerCase()));
    if (track.usecase) track.usecase.forEach(u => searchSuggestions.usecases.add(u.toLowerCase()));
    if (track.title) searchSuggestions.titles.add(track.title.toLowerCase());
  });
}

// 검색어 자동완성 및 추천 데이터 초기화
function generateSearchSuggestions(searchTerm) {
  if (!searchTerm) return [];
  
  const term = searchTerm.toLowerCase();
  const suggestions = new Set();
  
  // 무드 검색
  searchSuggestions.moods.forEach(mood => {
    if (mood.includes(term)) suggestions.add(mood);
  });
  
  // 용도 검색
  searchSuggestions.usecases.forEach(usecase => {
    if (usecase.includes(term)) suggestions.add(usecase);
  });
  
  // 제목 검색
  searchSuggestions.titles.forEach(title => {
    if (title.includes(term)) suggestions.add(title);
  });
  
  return Array.from(suggestions).slice(0, 5); // 최대 5개 추천
}

// 검색어 자동완성 UI 생성
function createSearchAutocomplete() {
  const searchBox = document.querySelector('.findmusic-search-box');
  if (!searchBox) return;
  
  const autocompleteContainer = document.createElement('div');
  autocompleteContainer.className = 'findmusic-search-autocomplete';
  searchBox.appendChild(autocompleteContainer);
  
  const searchInput = document.querySelector('.findmusic-search-input');
  if (!searchInput) return;
  
  let debounceTimer;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const searchTerm = e.target.value.trim();
    
    debounceTimer = setTimeout(() => {
      if (searchTerm.length < 2) {
        autocompleteContainer.style.display = 'none';
        return;
      }
      
      const suggestions = generateSearchSuggestions(searchTerm);
      if (suggestions.length === 0) {
        autocompleteContainer.style.display = 'none';
        return;
      }
      
      autocompleteContainer.innerHTML = suggestions
        .map(suggestion => `
          <div class="autocomplete-item" data-suggestion="${suggestion}">
            <span class="suggestion-text">${suggestion}</span>
          </div>
        `)
        .join('');
      
      autocompleteContainer.style.display = 'block';
      
      // 추천 항목 클릭 이벤트
      autocompleteContainer.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          searchInput.value = item.dataset.suggestion;
          autocompleteContainer.style.display = 'none';
          filterTracks();
        });
      });
    }, 300);
  });
  
  // 검색창 외부 클릭 시 자동완성 닫기
  document.addEventListener('click', (e) => {
    if (!searchBox.contains(e.target)) {
      autocompleteContainer.style.display = 'none';
    }
  });
}

// 페이지 초기화 함수 (기존 DOMContentLoaded 내용)
async function initializePage() {
  console.log("[JS SCRIPT] initializePage 함수 실행 시작.");

  loadHeader(); // 주석 해제
  initializeFilters(); // 주석 해제
  setupSearchAnimation(); // 검색 박스 등장 애니메이션 설정
  console.log("[JS SCRIPT] loadHeader 및 initializeFilters 호출 완료."); // 로그 메시지 변경
  
  try {
    // 로딩 표시 활성화
    const loadingElement = document.getElementById('findmusic-loading');
    if (loadingElement) {
      loadingElement.style.display = 'flex';
      console.log("[JS SCRIPT] 로딩 표시 활성화됨.");
    }
    
    // Firebase에서 트랙 데이터 로드
    console.log("[JS SCRIPT] loadTracksFromFirebase 함수 호출 시도...");
    const loadedTracksFromFirebase = await loadTracksFromFirebase();
    console.log("[JS SCRIPT] loadTracksFromFirebase 함수 완료. 로드된 트랙 수:", loadedTracksFromFirebase.length);
    
    // 로딩 표시 비활성화
    if (loadingElement) {
      loadingElement.style.display = 'none';
      console.log("[JS SCRIPT] 로딩 표시 비활성화됨.");
    }
    
    tracks = loadedTracksFromFirebase; // 전역 tracks 업데이트
    filteredTracks = [...tracks]; // 초기 필터된 트랙은 전체 트랙
    
    // 검색어 자동완성 및 추천 데이터 초기화
    initializeSearchSuggestions();
    createSearchAutocomplete();
    
    setupSorting(); // 주석 해제
    renderTracksPage(currentPage); // 첫 페이지 렌더링
    setupPagination(); // 페이지네이션 UI 설정
    addAnimationEffects(); // 주석 해제
    
    // 화면 크기 변경 시 미니플레이어 숨김 처리
    window.addEventListener('resize', function() {
      if (window.innerWidth <= 768) {
        hideMiniPlayer();
      }
    });
    
    // Track Library 클릭 이벤트 추가
    const trackLibraryTitle = document.querySelector('.findmusic-tracks-title');
    if (trackLibraryTitle) {
      trackLibraryTitle.addEventListener('click', function() {
        // 1페이지로 돌아가기
        currentPage = 1;
        renderTracksPage(currentPage);
        setupPagination();
        
        // 페이지 상단으로 스크롤
        const tracksArea = document.querySelector('.findmusic-tracks-area');
        if (tracksArea) {
          tracksArea.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
    
    console.log("[JS SCRIPT] 초기화 완료."); // 로그 메시지 변경

  } catch (error) {
    console.error("[JS SCRIPT] 초기화 중 오류 발생:", error);
    
    const loadingElement = document.getElementById('findmusic-loading');
    if (loadingElement) {
      loadingElement.innerHTML = `
        <div style="color: #FF5555; text-align: center;">
          <h3>음원 로딩 오류</h3>
          <p>${error.message}</p>
          <p>콘솔(F12)의 '[JS SCRIPT]' 로그를 확인하고, 페이지를 새로고침하거나 관리자에게 문의해주세요.</p>
        </div>
      `;
    }
    const gridContainer = document.getElementById('findmusic-grid');
    if (gridContainer) {
      gridContainer.innerHTML = `
        <div class="findmusic-no-results">
          <p>음원을 불러오는 중 오류가 발생했습니다: ${error.message}</p>
        </div>
      `;
    }
  }
}

// Firebase Storage URL 자동 생성 함수
// Firebase Storage에서 track 폴더의 파일 목록 가져오기
async function getStorageTrackFiles() {
  if (storageTrackFiles.length > 0) {
    console.log('[getStorageTrackFiles] 캐시된 파일 목록 사용:', storageTrackFiles.length, '개');
    return storageTrackFiles;
  }
  
  console.log('[getStorageTrackFiles] 🔍 Firebase Storage에서 track 폴더 파일 목록 가져오기 시작');
  console.log('[getStorageTrackFiles] Storage 객체:', storage);
  console.log('[getStorageTrackFiles] Storage app:', storage.app);
  console.log('[getStorageTrackFiles] Storage bucket:', storage._config?.bucket);
  
  try {
    const trackRef = ref(storage, 'track');
    console.log('[getStorageTrackFiles] Track 참조 생성 완료:', trackRef);
    
    console.log('[getStorageTrackFiles] listAll() 함수 호출 중...');
    const listResult = await listAll(trackRef);
    console.log('[getStorageTrackFiles] listAll() 결과 받음:', {
      items: listResult.items.length,
      prefixes: listResult.prefixes.length
    });
    
    if (listResult.items.length === 0) {
      console.warn('[getStorageTrackFiles] ⚠️ track 폴더에 파일이 하나도 없습니다!');
      console.warn('[getStorageTrackFiles] Firebase Console에서 Storage 확인 필요');
      return [];
    }
    
    storageTrackFiles = listResult.items.map(item => ({
      name: item.name,
      path: item.fullPath,
      normalizedName: normalizeFileName(item.name)
    }));
    
    console.log('[getStorageTrackFiles] ✅ Storage 파일 목록 (총 ' + storageTrackFiles.length + '개):');
    console.log('[getStorageTrackFiles] 처음 5개 파일:', storageTrackFiles.slice(0, 5).map(f => f.name));
    console.log('[getStorageTrackFiles] 마지막 5개 파일:', storageTrackFiles.slice(-5).map(f => f.name));
    
    return storageTrackFiles;
  } catch (error) {
    console.error('[getStorageTrackFiles] ❌ Storage 파일 목록 가져오기 실패:', error);
    console.error('[getStorageTrackFiles] 오류 상세:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return [];
  }
}

// 파일명 정규화 함수
function normalizeFileName(filename) {
  return filename
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // 특수문자 제거
    .replace(/\s+/g, ''); // 공백 제거
}

// 가장 유사한 파일 찾기
function findBestFileMatch(trackTitle, storageFiles) {
  if (!trackTitle || storageFiles.length === 0) return null;
  
  const normalizedTitle = normalizeFileName(trackTitle);
  let bestMatch = null;
  let bestSimilarity = 0;
  
  for (const file of storageFiles) {
    // 파일명에서 확장자 제거
    const fileNameWithoutExt = file.normalizedName.replace(/\.(mp3|wav|m4a)$/i, '');
    const similarity = calculateSimilarity(normalizedTitle, fileNameWithoutExt);
    
    console.log(`[findBestFileMatch] "${trackTitle}" vs "${file.name}" -> 유사도: ${similarity.toFixed(3)}`);
    
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = file;
    }
  }
  
  // 최소 유사도 임계값 (0.6 이상이어야 매칭)
  if (bestSimilarity >= 0.6) {
    console.log(`[findBestFileMatch] 최적 매칭: "${trackTitle}" -> "${bestMatch.name}" (유사도: ${bestSimilarity.toFixed(3)})`);
    return bestMatch;
  }
  
  console.log(`[findBestFileMatch] 유사한 파일 없음: "${trackTitle}" (최고 유사도: ${bestSimilarity.toFixed(3)})`);
  return null;
}

async function getStorageUrl(filePath) {
  if (!filePath || filePath.startsWith('http') || filePath.trim() === '') {
    return filePath || '';
  }

  try {
    const fileRef = ref(storage, filePath);
    const url = await getDownloadURL(fileRef);
    // console.log(`[getStorageUrl] 성공: ${filePath}`);
    return url;
  } catch (error) {
    if (error.code === 'storage/object-not-found') {
      console.warn(`[getStorageUrl] 경고: Storage에 파일 없음: ${filePath}`);
    } else {
      console.error(`[getStorageUrl] 오류: ${filePath} URL 가져오기 실패`, error);
    }
    return ''; // 파일이 없거나 오류 발생 시 빈 문자열 반환
  }
}

// 404 오류 디버깅을 위한 함수
function debugStorageFileNotFound(requestedFile, storageFiles) {
  console.group(`[DEBUG] 404 파일 분석: ${requestedFile}`);
  
  console.log('요청된 파일:', requestedFile);
  console.log('Storage 총 파일 수:', storageFiles.length);
  
  // 파일명만 추출 (경로 제거)
  const requestedFileName = requestedFile.split('/').pop();
  console.log('요청된 파일명:', requestedFileName);
  
  // 유사한 파일명 찾기
  const similarFiles = storageFiles.filter(f => {
    const fileName = f.name.toLowerCase();
    const requested = requestedFileName.toLowerCase();
    return fileName.includes(requested.replace(/\.(mp3|wav|m4a)$/i, '')) ||
           requested.includes(fileName.replace(/\.(mp3|wav|m4a)$/i, ''));
  });
  
  if (similarFiles.length > 0) {
    console.log('유사한 파일들:', similarFiles.map(f => f.name));
  } else {
    console.log('유사한 파일 없음');
    console.log('Storage의 모든 파일명 (처음 10개):');
    storageFiles.slice(0, 10).forEach(f => console.log(`  - ${f.name}`));
  }
  
  console.groupEnd();
}

// Firestore에서 트랙 데이터 로드
async function loadTracksFromFirebase() {
  console.log('[loadTracksFromFirebase] 🚀 Firestore에서 트랙 데이터 불러오기 시작');
  
  // 먼저 Storage에서 실제 파일 목록 가져오기
  console.log('[loadTracksFromFirebase] 📁 getStorageTrackFiles() 함수 호출 시작...');
  
  let storageFiles = [];
  try {
    storageFiles = await getStorageTrackFiles();
    console.log('[loadTracksFromFirebase] ✅ getStorageTrackFiles() 완료, 반환된 결과:', storageFiles.length, '개');
  } catch (error) {
    console.error('[loadTracksFromFirebase] ❌ getStorageTrackFiles() 오류:', error);
    storageFiles = []; // 빈 배열로 초기화
  }
  
  console.log('[loadTracksFromFirebase] Storage 파일 목록 로드 최종 결과:', storageFiles.length, '개');
  
  if (storageFiles.length === 0) {
    console.warn('[loadTracksFromFirebase] ⚠️ Storage에 파일이 하나도 없습니다! Firebase Console을 확인해주세요.');
  }
  
  try {
    const trackSnapshot = await getDocs(collection(db, 'track_new'));
    if (trackSnapshot.empty) {
      console.warn('[loadTracksFromFirebase] Firestore track_new 컬렉션에 데이터가 없습니다.');
      const loadingElement = document.getElementById('findmusic-loading');
      if (loadingElement) {
        loadingElement.innerHTML = `
          <div style="color: orange; text-align: center;">
            <h3>알림</h3>
            <p>트랙 데이터가 없습니다.</p>
            <p>관리자에게 문의해 주세요.</p>
          </div>
        `;
      }
      return [];
    }
    
    console.log(`[loadTracksFromFirebase] ${trackSnapshot.size}개 트랙 데이터 병렬 처리 시작...`);
    
    const trackPromises = trackSnapshot.docs.map(async (doc, idx) => {
      const data = doc.data();
      
      // Mood 배열 생성
      const moods = [data['mood 1'], data['mood 2']]
        .filter(m => m && (typeof m !== 'number' || !isNaN(m)))
        .map(m => m.toString().trim())
        .filter(Boolean);

      // Usecase 배열 생성
      const usecases = [data['usecase1'], data['usecase2'], data['usecase3']]
        .filter(u => u && typeof u === 'string')
        .map(u => u.trim())
        .filter(Boolean);

      const trackTitle = data['Track Title'] || '제목 없음';
      let audioFilePath = '';
      let actualFileName = 'N/A';

      if (data.storagePath && data.storagePath !== 'N/A') {
        const fileName = data.storagePath.split('/').pop();
        if (storageFiles.some(f => f.name === fileName)) {
          audioFilePath = data.storagePath;
          actualFileName = fileName;
        }
      }
      
      if (!audioFilePath) {
        const bestMatch = findBestFileMatch(trackTitle, storageFiles);
        if (bestMatch) {
          audioFilePath = bestMatch.path;
          actualFileName = bestMatch.name;
        } else {
          audioFilePath = `track/${trackTitle}.mp3`; // 최후 fallback
        }
      }
      
      const srcPromise = getStorageUrl(audioFilePath);
      
      // Firestore에 coverUrl이 있으면 우선 사용, 없으면 기본 경로로 찾기
      let coverUrl = data.coverUrl || '';
      if (!coverUrl) {
        try {
          coverUrl = await getStorageUrl(`covers/${trackTitle}-cover.jpg`);
        } catch (error) {
          console.log(`[loadTracksFromFirebase] 커버 이미지를 찾을 수 없음: ${trackTitle}`);
          coverUrl = ''; // 기본값으로 빈 문자열
        }
      }

      const src = await srcPromise;

      let releaseDate = '';
      if (data['Release Date']) {
        if (data['Release Date'].toDate) {
          releaseDate = data['Release Date'].toDate().toLocaleDateString('ko-KR');
        } else {
          releaseDate = data['Release Date'].toString();
        }
      }

      return {
        id: doc.id,
        title: trackTitle,
        artist: data['Primary Artist'] || '아티스트 정보 없음',
        mood: moods,
        usecase: usecases,
        src: src,
        coverUrl: coverUrl,
        album: data['Release Title'] || '',
        ISRC: data['ISRC'] || '',
        releaseDate: releaseDate,
        bpm: data.bpm || data.BPM || '',
        duration: data.duration || 0,
        recommended: !!data.recommended,
        new: !!data.new,
        popularity: data.popularity || 0,
        storagePath: data.storagePath || 'N/A',
        actualFileName: actualFileName,
        trackId: data['Track ID'] || '',
        trackListing: data['Track Listing'] || '',
        cLine: data['C-Line'] || '',
        pLine: data['P-Line'] || '',
        trackPLine: data['Track P-Line'] || '',
        cYear: data['C-Year'] || '',
        pYear: data['P-Year'] || '',
        trackPYear: data['Track P-Year'] || ''
      };
    });

    const loadedTracks = await Promise.all(trackPromises);
    
    console.log(`[loadTracksFromFirebase] 🎵 Firestore에서 최종 로드된 트랙 수: ${loadedTracks.length}`);
    
    if (loadedTracks.length === 0) {
      console.warn('⚠️ 로드된 트랙이 없습니다. track_new 컬렉션을 확인해주세요.');
    }
    
    return loadedTracks.filter(Boolean); // 혹시 모를 null 값 제거
  } catch (error) {
    console.error('[loadTracksFromFirebase] Firestore에서 트랙 데이터 불러오기 오류:', error);
    throw error;
  }
}

// 헤더 로드 함수
function loadHeader() {
  const headerContainer = document.getElementById('site-header'); // 변수명 변경 header -> headerContainer
  if (headerContainer) {
    fetch('../index.html') // js/find-music.js 기준이므로 ../index.html은 루트의 index.html을 가리킴
      .then(response => response.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const siteNav = doc.querySelector('.navbar'); // 변수명 변경 siteHeader -> siteNav
        if (siteNav) {
          // 네비게이션 링크 경로 수정
          const links = siteNav.querySelectorAll('a');
          links.forEach(link => {
            const originalHref = link.getAttribute('href');
            if (originalHref === 'index.html') {
              link.setAttribute('href', '../index.html'); // pages/find-music.html 기준에서 루트 index.html로
            } else if (originalHref === 'pages/find-music.html') {
              // 현재 페이지이므로 그대로 두거나, 명시적으로 find-music.html 또는 ../pages/find-music.html로 설정 가능
              // 일단 그대로 둡니다.
            } else if (originalHref && originalHref.startsWith('pages/')) {
                // pages/다른페이지.html 과 같은 링크가 있다면 ../pages/다른페이지.html 로 수정
                link.setAttribute('href', '../' + originalHref);
            }
            // 다른 절대 URL이나 #으로 시작하는 링크는 변경하지 않음
          });
          headerContainer.innerHTML = siteNav.outerHTML;
        }
      })
      .catch(err => console.error('헤더를 로드하는 데 실패했습니다:', err));
  }
}

// 검색 박스 등장 애니메이션 설정
function setupSearchAnimation() {
  const searchFilters = document.querySelector('.findmusic-search-and-filters');
  if (searchFilters) {
    const observer = new window.IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          searchFilters.classList.add('animate-fade-up');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    observer.observe(searchFilters);
  }
}

// 애니메이션 효과 추가
function addAnimationEffects() {
  // 회전 텍스트 애니메이션
  const rotatingText = document.querySelector('.rotating-text');
  if (rotatingText) {
    const spans = rotatingText.querySelectorAll('span');
    if (spans.length > 1) {
      let current = 0;
      spans[current].classList.add('visible'); // 초기 텍스트 표시

      setInterval(() => {
        const previous = current;
        current = (current + 1) % spans.length;

        spans[previous].classList.remove('visible');
        spans[previous].classList.add('exiting');
        
        spans[current].classList.remove('exiting'); 
        spans[current].classList.add('visible-prepare');

        setTimeout(() => {
          spans[current].classList.add('visible');
          spans[current].classList.remove('visible-prepare');
        }, 50); 

        setTimeout(() => {
          spans[previous].classList.remove('exiting');
        }, 550); 
      }, 3000); 
    }
  }
  
  // 3단계 카드 등장 애니메이션 - 이 부분은 find-music.html에서 주석 처리되었으므로 유지해도 큰 문제는 없음
  const stepCards = document.querySelectorAll('.findmusic-step');
  stepCards.forEach((card, index) => {
    setTimeout(() => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        card.style.transition = 'all 0.5s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 50);
    }, index * 150);
  });
  
  // 트랙 카드 등장 애니메이션 - 이전 카드 클래스 대상이므로 주석 처리
  /*
  const trackCards = document.querySelectorAll('.findmusic-track-card');
  trackCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
      card.style.transition = 'all 0.3s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 50 * index); 
  });
  */
}

// 필터 토글 초기화
function initializeFilters() {
  console.log("[initializeFilters] 필터 초기화 시작");
  
  // 무드 필터 토글 버튼
  const moodFilterToggle = document.querySelector('.findmusic-mood-filter-toggle');
  const moodFilterContent = document.querySelector('.findmusic-mood-filter-content');
  
  console.log("[initializeFilters] 무드 필터 토글 버튼:", moodFilterToggle);
  console.log("[initializeFilters] 무드 필터 컨텐츠:", moodFilterContent);
  
  if (moodFilterToggle && moodFilterContent) {
    // 이벤트 리스너가 이미 등록되어 있는지 확인하고 중복 방지
    if (!moodFilterToggle.hasAttribute('data-event-bound')) {
      moodFilterToggle.setAttribute('data-event-bound', 'true');
      
      moodFilterToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[initializeFilters] 무드 필터 토글 버튼 클릭됨");
        
        const isActive = moodFilterToggle.classList.contains('active');
        console.log("[initializeFilters] 무드 필터 현재 active 상태:", isActive);
        
        moodFilterToggle.classList.toggle('active');
        moodFilterContent.classList.toggle('active');
        
        console.log("[initializeFilters] 무드 필터 토글 후 active 상태:", moodFilterToggle.classList.contains('active'));
        console.log("[initializeFilters] 무드 필터 컨텐츠 active 상태:", moodFilterContent.classList.contains('active'));
      });
      
      console.log("[initializeFilters] 무드 필터 토글 이벤트 리스너 등록 완료");
    }
  } else {
    console.error("[initializeFilters] 무드 필터 토글 요소를 찾을 수 없습니다");
  }
  
  // 용도 필터 토글 버튼
  const usecaseFilterToggle = document.querySelector('.findmusic-usecase-filter-toggle');
  const usecaseFilterContent = document.querySelector('.findmusic-usecase-filter-content');
  
  console.log("[initializeFilters] 용도 필터 토글 버튼:", usecaseFilterToggle);
  console.log("[initializeFilters] 용도 필터 컨텐츠:", usecaseFilterContent);
  
  if (usecaseFilterToggle && usecaseFilterContent) {
    // 이벤트 리스너가 이미 등록되어 있는지 확인하고 중복 방지
    if (!usecaseFilterToggle.hasAttribute('data-event-bound')) {
      usecaseFilterToggle.setAttribute('data-event-bound', 'true');
      
      usecaseFilterToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[initializeFilters] 용도 필터 토글 버튼 클릭됨");
        
        const isActive = usecaseFilterToggle.classList.contains('active');
        console.log("[initializeFilters] 용도 필터 현재 active 상태:", isActive);
        
        usecaseFilterToggle.classList.toggle('active');
        usecaseFilterContent.classList.toggle('active');
        
        console.log("[initializeFilters] 용도 필터 토글 후 active 상태:", usecaseFilterToggle.classList.contains('active'));
        console.log("[initializeFilters] 용도 필터 컨텐츠 active 상태:", usecaseFilterContent.classList.contains('active'));
      });
      
      console.log("[initializeFilters] 용도 필터 토글 이벤트 리스너 등록 완료");
    }
  } else {
    console.error("[initializeFilters] 용도 필터 토글 요소를 찾을 수 없습니다");
  }
  
  // 필터 초기화 버튼
  const resetBtn = document.querySelector('.findmusic-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // 모든 체크박스 해제
      document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
      });
      
      // 검색 입력 필드 초기화
      const searchInput = document.querySelector('.findmusic-search-input');
      if (searchInput) {
        searchInput.value = '';
      }
      
      // 정렬 선택 초기화
      const sortSelect = document.getElementById('sort-select');
      if (sortSelect) {
        sortSelect.value = 'recommended'; // 기본값으로 설정
      }
      
      // 필터 초기화 후 전체 트랙 표시
      filteredTracks = [...tracks];
      currentPage = 1;
      renderTracksPage(currentPage);
      setupPagination();
    });
  }
  
  // 필터 이벤트 리스너
  document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', filterTracks);
  });
  
  // 검색 기능 - 강화된 버전
  const searchInput = document.querySelector('.findmusic-search-input') || document.getElementById('search-input');
  const searchBtn = document.querySelector('.findmusic-search-btn');
  
  console.log("[initializeFilters] 검색 요소 찾기:", { searchInput, searchBtn });
  
  if (searchInput && searchBtn) {
    // 입력 필드가 정상적으로 작동하는지 확인
    console.log("[initializeFilters] 검색 입력 필드 발견:", searchInput);
    console.log("[initializeFilters] 입력 필드 현재 상태:", {
      disabled: searchInput.disabled,
      readonly: searchInput.readOnly,
      style: searchInput.style.cssText,
      tabIndex: searchInput.tabIndex
    });
    
    // 모든 차단 요소 제거 및 강제 활성화
    searchInput.disabled = false;
    searchInput.readOnly = false;
    searchInput.style.pointerEvents = 'auto !important';
    searchInput.style.userSelect = 'text !important';
    searchInput.style.webkitUserSelect = 'text !important';
    searchInput.style.mozUserSelect = 'text !important';
    searchInput.style.msUserSelect = 'text !important';
    searchInput.style.cursor = 'text !important';
    searchInput.tabIndex = 0;
    searchInput.removeAttribute('readonly');
    searchInput.removeAttribute('disabled');
    
    // 강제로 스타일 적용
    setTimeout(() => {
      searchInput.style.setProperty('pointer-events', 'auto', 'important');
      searchInput.style.setProperty('user-select', 'text', 'important');
      console.log("[Search] 스타일 강제 적용 완료");
    }, 100);
    
    // 클릭 이벤트로 포커스 강제 설정
    searchInput.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      searchInput.focus();
      console.log("[Search] 클릭으로 포커스 설정됨");
    });
    
    // 더블클릭 이벤트
    searchInput.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      e.preventDefault();
      searchInput.select();
      console.log("[Search] 더블클릭으로 전체 선택됨");
    });
    
    // 검색 버튼 클릭 이벤트
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log("[Search] 검색 버튼 클릭됨");
      filterTracks();
    });
    
    // 모든 키보드 이벤트 처리
    searchInput.addEventListener('keydown', (e) => {
      console.log("[Search] 키다운 이벤트:", e.key, e.keyCode);
    });
    
    searchInput.addEventListener('keypress', (e) => {
      console.log("[Search] 키프레스 이벤트:", e.key, e.keyCode);
      if (e.key === 'Enter') {
        e.preventDefault();
        console.log("[Search] Enter 키로 검색 시도");
        filterTracks();
      }
    });
    
    searchInput.addEventListener('keyup', (e) => {
      console.log("[Search] 키업 이벤트:", e.key, e.target.value);
    });
    
    // 입력 이벤트 (실시간 검색 준비)
    searchInput.addEventListener('input', (e) => {
      console.log("[Search] 입력 감지:", e.target.value);
    });
    
    // 변경 이벤트
    searchInput.addEventListener('change', (e) => {
      console.log("[Search] 변경 감지:", e.target.value);
    });
    
    // 포커스 이벤트 (디버깅용)
    searchInput.addEventListener('focus', (e) => {
      console.log("[Search] 입력 필드에 포커스됨");
      e.target.style.outline = '2px solid #3eb489';
    });
    
    searchInput.addEventListener('blur', (e) => {
      console.log("[Search] 입력 필드에서 포커스 해제됨");
      e.target.style.outline = 'none';
    });
    
    // 직접 입력 테스트 함수 추가
    window.testSearchInput = function() {
      searchInput.value = "테스트 입력";
      searchInput.focus();
      console.log("[Search] 직접 입력 테스트 완료");
    };
    
    console.log("[Search] 모든 이벤트 리스너 등록 완료. 테스트: window.testSearchInput() 실행 가능");
    
  } else {
    console.error("[initializeFilters] 검색 입력 필드 또는 버튼을 찾을 수 없습니다", { searchInput, searchBtn });
  }
}

// 트랙 정렬 기능 설정
function setupSorting() {
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      filterTracks();
    });
  }
}

// 문자열 유사도 계산 함수 (Levenshtein 거리 기반)
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // 정확한 일치
  if (s1 === s2) return 1;
  
  // 부분 문자열 포함
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // 단어 단위 비교
  const words1 = s1.split(/[\s-_]+/);
  const words2 = s2.split(/[\s-_]+/);
  
  let maxSimilarity = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2) {
        maxSimilarity = Math.max(maxSimilarity, 0.9);
      } else if (word1.includes(word2) || word2.includes(word1)) {
        maxSimilarity = Math.max(maxSimilarity, 0.7);
      }
    }
  }
  
  return maxSimilarity;
}

// 트랙 필터링 및 정렬 함수
function filterTracks() {
  currentPage = 1;
  let tempFilteredTracks = [...tracks];
  
  // 검색어 필터링
  const searchInput = document.querySelector('.findmusic-search-input');
  if (searchInput && searchInput.value.trim()) {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const SIMILARITY_THRESHOLD = 0.6;
    
    // 검색 결과에 유사도 점수 추가
    tempFilteredTracks = tempFilteredTracks.map(track => {
      let maxSimilarity = 0;
      
      // 제목 검색
      const titleSimilarity = calculateSimilarity(track.title, searchTerm);
      maxSimilarity = Math.max(maxSimilarity, titleSimilarity);
      
      // 무드 검색
      if (track.mood && Array.isArray(track.mood)) {
        track.mood.forEach(mood => {
          const moodSimilarity = calculateSimilarity(mood, searchTerm);
          maxSimilarity = Math.max(maxSimilarity, moodSimilarity);
        });
      }
      
      // 용도 검색
      if (track.usecase && Array.isArray(track.usecase)) {
        track.usecase.forEach(usecase => {
          const usecaseSimilarity = calculateSimilarity(usecase, searchTerm);
          maxSimilarity = Math.max(maxSimilarity, usecaseSimilarity);
        });
      }
      
      return {
        ...track,
        searchSimilarity: maxSimilarity
      };
    }).filter(track => track.searchSimilarity >= SIMILARITY_THRESHOLD);
    
    // 유사도 점수로 정렬
    tempFilteredTracks.sort((a, b) => b.searchSimilarity - a.searchSimilarity);
  }
  
  // 무드 필터링 (새로운 태그 매핑 시스템 사용)
  const selectedMoods = Array.from(document.querySelectorAll('input[name="mood"]:checked'))
    .map(input => input.value.toLowerCase());
  if (selectedMoods.length > 0) {
    tempFilteredTracks = tempFilteredTracks.filter(track => {
      if (!track.mood || !Array.isArray(track.mood)) return false;
      
      return track.mood.some(moodItem => {
        const mappedMood = mapTagToNewSystem(moodItem, 'mood');
        return selectedMoods.includes(moodItem.toLowerCase()) ||
               (mappedMood && selectedMoods.includes(mappedMood));
      });
    });
  }
  
  // 용도 필터링 (새로운 태그 매핑 시스템 사용)
  const selectedUsecases = Array.from(document.querySelectorAll('input[name="usecase"]:checked'))
    .map(input => input.value.toLowerCase());
  if (selectedUsecases.length > 0) {
    tempFilteredTracks = tempFilteredTracks.filter(track => {
      if (!track.usecase || !Array.isArray(track.usecase)) return false;
      
      return track.usecase.some(usecaseItem => {
        const mappedUsecase = mapTagToNewSystem(usecaseItem, 'usecase');
        return selectedUsecases.includes(usecaseItem.toLowerCase()) ||
               (mappedUsecase && selectedUsecases.includes(mappedUsecase));
      });
    });
  }
  
  // 정렬
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    const sortValue = sortSelect.value;
    switch (sortValue) {
      case 'newest':
        tempFilteredTracks.sort((a, b) => (b.id || "").localeCompare(a.id || ""));
        break;
      case 'oldest': // 오래된 순 정렬 추가
        tempFilteredTracks.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
        break;
      case 'popular':
        tempFilteredTracks.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        break;
      case 'relevance':
        // 검색어 관련성은 기본 정렬 순서(필터링된 순서)를 유지하거나, 더 복잡한 로직 필요시 추가
        break;
      default: // 'recommended'
        tempFilteredTracks.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0) || (b.id || "").localeCompare(a.id || "")); // 추천순 같을 시 최신순
        break;
    }
  }
  
  filteredTracks = tempFilteredTracks; // 전역 필터된 트랙 업데이트
  renderTracksPage(currentPage); // 현재 페이지(필터 변경 시 1페이지) 렌더링
  setupPagination(); // 페이지네이션 UI 다시 설정
}

// 타이틀 포맷 함수 - 파일명을 보기 좋은 제목으로 변환
function formatTitle(filename) {
  // 확장자와 숫자 접미사 제거 (정규식 수정: 특정 확장자 대신 일반적인 확장자 패턴)
  let title = filename.replace(/-\d+(?=\.[^.]+$)|(\.[^.]+)$/i, '');
  
  // 하이픈을 공백으로 변경하고 각 단어의 첫 글자를 대문자로
  return title.split(/[-_]/).map(word =>  // 하이픈 또는 언더스코어를 구분자로 사용
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() // 나머지 글자는 소문자로
  ).join(' ');
}

// 트랙 렌더링 함수
function renderTracks(tracksToRender) {
  const gridContainer = document.getElementById('findmusic-grid');
  if (!gridContainer) return;
  
  gridContainer.innerHTML = '';
  
  if (!tracksToRender || tracksToRender.length === 0) { // tracksToRender null 체크 추가
    gridContainer.innerHTML = `
      <div class="findmusic-no-results">
        <p>검색 결과가 없습니다.</p>
        <p>다른 검색어나 필터 조건을 시도해보세요.</p>
      </div>
    `;
    return;
  }
  
  tracksToRender.forEach(track => {
    const trackCard = document.createElement('div');
    trackCard.className = 'findmusic-track-card';
    trackCard.setAttribute('data-track-id', track.id);
    
    // 그리드 레이아웃에 맞는 카드 형태의 HTML 생성
    trackCard.innerHTML = `
      <div class="findmusic-track-wave" data-src="${track.src}"></div>
      
      <div class="findmusic-track-info">
        <h3 class="findmusic-track-title">
          ${track.title}
        </h3>
        <div class="findmusic-track-meta">
        </div>
        <div class="findmusic-track-actions">
          <span class="findmusic-track-duration">${formatDuration(track.duration || 0)}</span>
          <button class="findmusic-track-play" aria-label="${track.title} 재생">
            <div class="loading-spinner"></div>
          </button>
        </div>
      </div>
      
      ${track.recommended ? '<span class="findmusic-track-badge">추천</span>' : ''}
      ${track.new ? '<span class="findmusic-track-badge new">신규</span>' : ''}
    `;
    
    gridContainer.appendChild(trackCard);
    
    // 웨이브폼 초기화
    initializeWaveform(trackCard.querySelector('.findmusic-track-wave'));
  });
  
  // 카드 등장 애니메이션 추가
  setTimeout(() => {
    addAnimationEffects();
  }, 50);
}

// 현재 페이지 트랙 렌더링 함수
function renderTracksPage(page) {
  const gridContainer = document.getElementById('findmusic-grid');
  if (!gridContainer) return;
  
  gridContainer.innerHTML = ''; // 기존 트랙 지우기
  
  const startIndex = (page - 1) * tracksPerPage;
  const endIndex = startIndex + tracksPerPage;
  const tracksToRender = filteredTracks.slice(startIndex, endIndex); // 전역 filteredTracks 사용

  if (tracksToRender.length === 0) {
    gridContainer.innerHTML = `
      <div class="findmusic-no-results">
        <p>표시할 음원이 없습니다.</p>
        <p>다른 검색어나 필터 조건을 시도해보세요.</p>
      </div>
    `;
    return;
  }
  
  // 순차적 애니메이션 효과를 위해 트랙 아이템을 먼저 생성하고 나중에 추가
  const trackItems = [];
  
  tracksToRender.forEach(track => {
    const trackItem = document.createElement('div'); 
    trackItem.className = 'findmusic-track-list-item'; 
    trackItem.setAttribute('data-track-id', track.id);
    // 초기 상태로 보이지 않게 설정
    trackItem.style.opacity = '0';
    trackItem.style.transform = 'translateY(20px)';
    
    // ISRC를 CID로 사용, 없으면 기본값
    const displayCID = track.ISRC || `AUDNX${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;

    // HTML 구조 및 내용은 기존과 동일
    trackItem.innerHTML = `
      <div class="findmusic-item-thumbnail">
        ${track.coverUrl ? `<img class="findmusic-item-cover" src="${track.coverUrl}" alt="${track.title} 커버" onerror="this.style.display='none'">` : ''}
        <div class="findmusic-thumbnail-waveform" data-findmusic-wave="true">
          <svg class="findmusic-waveform-svg" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
            <path d="M10,30 L15,20 L20,40 L25,15 L30,45 L35,25 L40,35 L45,10 L50,50 L55,20 L60,40 L65,15 L70,45 L75,25 L80,35 L85,10 L90,50 L95,20 L100,30 L105,40 L110,15 L115,45 L120,25 L125,35 L130,10 L135,50 L140,20 L145,40 L150,15 L155,45 L160,25 L165,35 L170,10 L175,50 L180,20 L185,40 L190,30" 
                  stroke="var(--color-primary)" 
                  stroke-width="2" 
                  fill="none" 
                  stroke-linecap="round"/>
          </svg>
        </div>
      </div>

      <button class="findmusic-play-btn" aria-label="${track.title} 재생">
        <div class="loading-spinner" style="display: none;"></div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>

      <div class="findmusic-item-main-group">
        <div class="findmusic-item-title-genre-wrapper">
          <div class="findmusic-item-title-row">
          <h3 class="findmusic-item-title" title="${track.title}">${track.title}</h3>
            <span class="findmusic-item-artist" title="${track.artist || '아티스트 정보 없음'}">by ${track.artist || '아티스트 정보 없음'}</span>
          </div>
          <div class="findmusic-item-tags">
            ${(() => {
              const moods = track.mood ? track.mood.filter(m => m && m !== 'NaN').slice(0, 2) : [];
              const usecases = track.usecase ? track.usecase.filter(u => u && u !== 'NaN').slice(0, 2) : [];
              
              const moodTags = moods.map(mood => ({
                korean: convertTagToKorean(mood, 'mood'),
                type: 'mood'
              }));
              const usecaseTags = usecases.map(usecase => ({
                korean: convertTagToKorean(usecase, 'usecase'),
                type: 'usecase'
              }));
              
              return [...moodTags, ...usecaseTags].map(tag => 
                `<span class="findmusic-item-tag findmusic-tag-${tag.type}" title="${tag.korean}">${tag.korean}</span>`
              ).join('');
            })()}
          </div>
        </div>
        
        <div class="findmusic-item-waveform-container">
          <div class="findmusic-track-wave" data-src="${track.src}"></div>
        </div>
      </div>

      <span class="findmusic-item-duration">${formatDuration(track.duration || 0)}</span>

      <div class="findmusic-item-cid-container">
        <span class="findmusic-cid-label">CID:</span>
        <span class="findmusic-track-cid-text">${displayCID}</span>
        <button class="findmusic-cid-copy-btn" aria-label="Content ID 복사" title="Content ID 복사">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        </button>
      </div>
    `;
    
    // 생성된 트랙 아이템을 배열에 저장
    trackItems.push(trackItem);
  });
  
  // 모든 트랙 아이템을 DOM에 추가
  trackItems.forEach((trackItem, index) => {
    gridContainer.appendChild(trackItem);
    
    // 초기 상태에서 .playing 클래스가 없는지 확인
    trackItem.classList.remove('playing');
    
    // 해당 트랙 아이템의 웨이브폼 초기화
    const waveElement = trackItem.querySelector('.findmusic-track-wave');
    const wavesurfer = initializeWaveform(waveElement);
    
    // 재생 버튼 및 이벤트 설정
    const playBtn = trackItem.querySelector('.findmusic-play-btn'); 
    const playIconSvgPath = playBtn ? playBtn.querySelector('svg path') : null;
    
    if (wavesurfer && playBtn) {
      const updatePlayIcons = (isPlaying) => {
        const iconPath = isPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z';
        if (playIconSvgPath) playIconSvgPath.setAttribute('d', iconPath);
        
        playBtn.classList.toggle('playing', isPlaying);
      };

      wavesurfer.on('play', () => {
        if (playIconSvgPath) playIconSvgPath.setAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z');
        playBtn.classList.add('playing');
      });
      wavesurfer.on('pause', () => {
        if (playIconSvgPath) playIconSvgPath.setAttribute('d', 'M8 5v14l11-7z');
        playBtn.classList.remove('playing');
      });
      wavesurfer.on('finish', () => {
        if (playIconSvgPath) playIconSvgPath.setAttribute('d', 'M8 5v14l11-7z');
        playBtn.classList.remove('playing');
      });
      
      updatePlayIcons(wavesurfer.isPlaying()); 
    } else { 
      if (!wavesurfer) console.warn('[renderTracksPage] wavesurfer가 없습니다 for track:', tracksToRender[index].title);
      if (!playBtn) console.warn('[renderTracksPage] playBtn을 찾을 수 없습니다 for track:', tracksToRender[index].title);
    }
    
    // CID 복사 버튼 설정
    const cidCopyBtn = trackItem.querySelector('.findmusic-cid-copy-btn');
    const cidTextElement = trackItem.querySelector('.findmusic-track-cid-text');

    if (cidCopyBtn && cidTextElement) {
      cidCopyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cidToCopy = cidTextElement.textContent;
        navigator.clipboard.writeText(cidToCopy).then(() => {
          const originalButtonContent = cidCopyBtn.innerHTML;
          cidCopyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
          cidCopyBtn.title = "복사 완료!";
          
          const existingFeedback = cidCopyBtn.parentElement.querySelector('.copy-feedback');
          if (existingFeedback) {
            existingFeedback.remove();
          }

          setTimeout(() => {
            cidCopyBtn.innerHTML = originalButtonContent;
            cidCopyBtn.title = "Content ID 복사";
          }, 1500);
        }).catch(err => {
          console.error('CID 복사 실패:', err);
          const originalButtonContent = cidCopyBtn.innerHTML;
          cidCopyBtn.innerHTML = '실패';
          setTimeout(() => {
            cidCopyBtn.innerHTML = originalButtonContent;
          }, 1500);
        });

      });
    }
    
    // 모바일에서 카드 전체 클릭 시 재생 이벤트 추가
    const isMobile = window.innerWidth <= 768;
    if (isMobile && wavesurfer && playBtn) {
      trackItem.addEventListener('click', (e) => {
        // CID 복사 버튼 클릭은 제외
        if (e.target.closest('.findmusic-cid-copy-btn')) {
          return;
        }
        
        // playTrack 함수 사용 (모바일)
        playTrack(trackItem, wavesurfer);
      });
    }
    
    // 재생 버튼 이벤트는 initializeWaveform에서만 처리하도록 수정
    // (중복 이벤트 리스너 제거)
    
    // 각 트랙 아이템을 순차적으로 페이드인 애니메이션 효과 적용
    setTimeout(() => {
      trackItem.style.transition = 'opacity 0.5s ease, transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      trackItem.style.opacity = '1';
      trackItem.style.transform = 'translateY(0)';
    }, 50 * (index + 1)); // 각 아이템마다 50ms 딜레이를 증가시켜 순차적으로 나타나게 함
  });
}

// 페이지네이션 UI 설정
function setupPagination() {
  const paginationContainer = document.getElementById('findmusic-pagination');
  if (!paginationContainer) return;

  paginationContainer.innerHTML = ''; // 기존 페이지네이션 지우기
  const totalPages = Math.ceil(filteredTracks.length / tracksPerPage);

  if (totalPages <= 1) return; // 페이지가 하나 이하면 페이지네이션 표시 안 함

  const maxPageButtons = 5; // 한 번에 표시할 페이지 버튼 수 (그룹 당 버튼 수)

  // 이전 버튼
  const prevButton = document.createElement('button');
  prevButton.textContent = '이전';
  prevButton.classList.add('pagination-btn', 'prev-btn');
  prevButton.disabled = currentPage === 1;
  prevButton.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTracksPage(currentPage);
      setupPagination();
    }
  });
  paginationContainer.appendChild(prevButton);

  // 페이지 번호 버튼 생성 로직
  // 현재 페이지가 속한 그룹 계산
  const currentGroup = Math.ceil(currentPage / maxPageButtons);
  
  // 현재 그룹의 시작 페이지와 끝 페이지 계산
  let startPageInGroup = (currentGroup - 1) * maxPageButtons + 1;
  let endPageInGroup = Math.min(currentGroup * maxPageButtons, totalPages);

  for (let i = startPageInGroup; i <= endPageInGroup; i++) {
    createPageButton(i, paginationContainer);
  }

  // 다음 버튼
  const nextButton = document.createElement('button');
  nextButton.textContent = '다음';
  nextButton.classList.add('pagination-btn', 'next-btn');
  nextButton.disabled = currentPage === totalPages;
  nextButton.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderTracksPage(currentPage);
      setupPagination();
    }
  });
  paginationContainer.appendChild(nextButton);
}

// 페이지 번호 버튼 생성 헬퍼 함수
function createPageButton(pageNumber, container) {
  const pageButton = document.createElement('button');
  pageButton.textContent = pageNumber;
  pageButton.classList.add('pagination-btn', 'page-num-btn');
  if (pageNumber === currentPage) {
    pageButton.classList.add('active');
  }
  pageButton.addEventListener('click', () => {
    currentPage = pageNumber;
    renderTracksPage(currentPage);
    setupPagination(); // 현재 페이지 표시 업데이트
  });
  container.appendChild(pageButton);
}

// Mini Player 함수
function updateMiniPlayerPlayButton(isPlaying) {
  const miniPlayerPlayBtn = document.getElementById('mini-player-play');
  if (miniPlayerPlayBtn) {
    const svgIcon = miniPlayerPlayBtn.querySelector('svg path'); // SVG path 요소를 가져옵니다.
    if (svgIcon) {
      if (isPlaying) {
        svgIcon.setAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z'); // 일시정지 아이콘 경로
      } else {
        svgIcon.setAttribute('d', 'M8 5v14l11-7z'); // 재생 아이콘 경로
      }
    }
    miniPlayerPlayBtn.setAttribute('aria-label', isPlaying ? '일시정지' : '재생');
    miniPlayerPlayBtn.classList.toggle('playing', isPlaying);
  }
}

function showMiniPlayer(track, mainWavesurfer) {
  // 모바일 환경에서는 미니플레이어 비활성화
  if (window.innerWidth <= 768) {
    console.log("[showMiniPlayer] 모바일 환경에서는 미니플레이어를 표시하지 않습니다.");
    return;
  }
  
  // 필수 요소 참조
  const miniPlayerElement = document.getElementById('mini-player');
  const miniPlayerThumbnail = document.getElementById('mini-player-thumbnail');
  const miniPlayerCover = document.getElementById('mini-player-cover');
  const miniPlayerTitle = document.getElementById('mini-player-title');
  const miniPlayerTags = document.getElementById('mini-player-tags');
  const miniPlayerTime = document.getElementById('mini-player-time');
  const miniPlayerDuration = document.getElementById('mini-player-duration');
  const miniPlayerProgress = document.getElementById('mini-player-progress');
  const miniPlayerCid = document.getElementById('mini-player-cid');
  
  // 필수 요소 검증
  if (!miniPlayerElement || !track || !mainWavesurfer) {
    console.error("[showMiniPlayer] 필수 요소가 없습니다");
    return;
  }

  currentMainWavesurferForMiniPlayer = mainWavesurfer;

  // 썸네일 설정
  if (miniPlayerThumbnail) {
    
    // 커버 이미지 처리
    if (miniPlayerCover && track.coverUrl) {
      miniPlayerCover.src = track.coverUrl;
      miniPlayerCover.style.display = 'block';
      miniPlayerCover.onerror = function() {
        this.style.display = 'none';
      };
    } else if (miniPlayerCover) {
      miniPlayerCover.style.display = 'none';
    }
    
    const thumbWave = miniPlayerThumbnail.querySelector('.findmusic-thumbnail-waveform');
    if (thumbWave) {
      thumbWave.style.display = 'block';
    }
  }

  // 타이틀
  if (miniPlayerTitle) miniPlayerTitle.textContent = track.title;

  // 태그 표시 - 트랙 아이템과 동일한 스타일 적용
  if (miniPlayerTags) {
    const moods = track.mood ? track.mood.filter(m => m && m !== 'NaN').slice(0, 2) : [];
    const usecases = track.usecase ? track.usecase.filter(u => u && u !== 'NaN').slice(0, 2) : [];
    
    const moodTags = moods.map(mood => ({
      korean: convertTagToKorean(mood, 'mood'),
      type: 'mood'
    }));
    const usecaseTags = usecases.map(usecase => ({
      korean: convertTagToKorean(usecase, 'usecase'), 
      type: 'usecase'
    }));
    
    const allTags = [...moodTags, ...usecaseTags];
    
    miniPlayerTags.innerHTML = allTags.length > 0 
      ? allTags.map(tag => 
          `<span class="findmusic-item-tag findmusic-tag-${tag.type}" title="${tag.korean}">${tag.korean}</span>`
        ).join('')
      : '<span class="findmusic-item-tag">태그 없음</span>';
  }
  
  // 시간 정보
  const trackDuration = track.duration || mainWavesurfer.getDuration() || 0;
  const currentTime = mainWavesurfer.getCurrentTime() || 0;
  if (miniPlayerTime) miniPlayerTime.textContent = formatDuration(currentTime);
  if (miniPlayerDuration) miniPlayerDuration.textContent = formatDuration(trackDuration);
  
  // 진행률 게이지 초기화
  if (miniPlayerProgress) {
    const progressPercent = (trackDuration > 0) ? (currentTime / trackDuration * 100) : 0;
    miniPlayerProgress.style.width = `${progressPercent}%`;
  }

  // CID - ISRC 필드 사용
  const displayCID = track.ISRC || `AUDNX${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
  if (miniPlayerCid) miniPlayerCid.textContent = displayCID;

  // CID 복사 버튼 이벤트 연결
  const miniPlayerCidCopyBtn = document.getElementById('mini-player-cid-copy-btn');
  if (miniPlayerCidCopyBtn && miniPlayerCid) {
    // 중복 이벤트 리스너 방지
    if (!miniPlayerCidCopyBtn.hasAttribute('data-event-bound')) {
      miniPlayerCidCopyBtn.setAttribute('data-event-bound', 'true');
      
      miniPlayerCidCopyBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const cidText = miniPlayerCid.textContent;
        if (!cidText) {
          console.warn('CID 텍스트가 없습니다.');
          return;
        }
        
        navigator.clipboard.writeText(cidText)
          .then(() => {
            const originalContent = miniPlayerCidCopyBtn.innerHTML;
            miniPlayerCidCopyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
            miniPlayerCidCopyBtn.classList.add('copied');
            miniPlayerCidCopyBtn.setAttribute('title', '복사됨!');
            
            setTimeout(() => {
              miniPlayerCidCopyBtn.innerHTML = originalContent;
              miniPlayerCidCopyBtn.classList.remove('copied');
              miniPlayerCidCopyBtn.setAttribute('title', 'Content ID 복사');
            }, 1200);
          })
          .catch(err => {
            console.error('CID 복사 실패:', err);
            miniPlayerCidCopyBtn.textContent = '실패';
            setTimeout(() => {
              miniPlayerCidCopyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
            }, 1500);
          });
      });
    }
  }

  // 재생/일시정지 버튼 상태 업데이트 및 이벤트 바인딩
  const miniPlayerPlayBtn = document.getElementById('mini-player-play');
  if (miniPlayerPlayBtn) {
    // 현재 재생 상태에 따라 버튼 업데이트
    const isCurrentlyPlaying = mainWavesurfer.isPlaying();
    updateMiniPlayerPlayButton(isCurrentlyPlaying);
    
    // 중복 이벤트 리스너 방지
    if (!miniPlayerPlayBtn.hasAttribute('data-event-bound')) {
      miniPlayerPlayBtn.setAttribute('data-event-bound', 'true');
      
      miniPlayerPlayBtn.addEventListener('click', () => {
        if (currentMainWavesurferForMiniPlayer) {
          currentMainWavesurferForMiniPlayer.playPause();
        }
      });
    }
  }

  // 닫기 버튼 이벤트 바인딩
  const miniPlayerCloseBtn = document.getElementById('mini-player-close');
  if (miniPlayerCloseBtn) {
    // 중복 이벤트 리스너 방지
    if (!miniPlayerCloseBtn.hasAttribute('data-event-bound')) {
      miniPlayerCloseBtn.setAttribute('data-event-bound', 'true');
      
      miniPlayerCloseBtn.addEventListener('click', hideMiniPlayer);
    }
  }

  // 진행률 업데이트 함수
  function updateProgress() {
    if (!currentMainWavesurferForMiniPlayer) return;
    
    const current = currentMainWavesurferForMiniPlayer.getCurrentTime();
    const total = currentMainWavesurferForMiniPlayer.getDuration();
    
    if (miniPlayerProgress && isFinite(current) && isFinite(total) && total > 0) {
      const percent = (current / total) * 100;
      miniPlayerProgress.style.width = `${percent}%`;
    }
    
    if (miniPlayerTime && isFinite(current)) {
      miniPlayerTime.textContent = formatDuration(current);
    }
  }

  // 진행률 주기적 업데이트 설정
  const progressUpdateInterval = setInterval(updateProgress, 100);
  
  // 객체에 인터벌 ID 저장 (닫을 때 제거하기 위함)
  miniPlayerElement.dataset.progressInterval = progressUpdateInterval;

  // 진행률 직접 클릭으로 탐색 기능
  const progressContainer = document.querySelector('.mini-player-progress-container');
  if (progressContainer) {
    // 중복 이벤트 리스너 방지
    if (!progressContainer.hasAttribute('data-event-bound')) {
      progressContainer.setAttribute('data-event-bound', 'true');
      
      progressContainer.addEventListener('click', function(e) {
        if (!currentMainWavesurferForMiniPlayer) return;
        
        const rect = this.getBoundingClientRect();
        const clickPosition = (e.clientX - rect.left) / rect.width;
        const duration = currentMainWavesurferForMiniPlayer.getDuration();
        
        if (isFinite(clickPosition) && clickPosition >= 0 && clickPosition <= 1 && isFinite(duration)) {
          currentMainWavesurferForMiniPlayer.seekTo(clickPosition);
        }
      });
    }
  }

  // 미니 플레이어 표시
  miniPlayerElement.classList.add('active');
}

// hideMiniPlayer 함수 수정
function hideMiniPlayer() {
  const miniPlayerElement = document.getElementById('mini-player');
  if (!miniPlayerElement) return;
  
  miniPlayerElement.classList.remove('active');
  
  // 진행률 업데이트 인터벌 정리
  if (miniPlayerElement.dataset.progressInterval) {
    clearInterval(parseInt(miniPlayerElement.dataset.progressInterval));
    delete miniPlayerElement.dataset.progressInterval;
  }
  
  // 이벤트 바인딩 상태 초기화
  const miniPlayerCidCopyBtn = document.getElementById('mini-player-cid-copy-btn');
  const miniPlayerPlayBtn = document.getElementById('mini-player-play');
  const miniPlayerCloseBtn = document.getElementById('mini-player-close');
  const progressContainer = document.querySelector('.mini-player-progress-container');
  
  if (miniPlayerCidCopyBtn) miniPlayerCidCopyBtn.removeAttribute('data-event-bound');
  if (miniPlayerPlayBtn) miniPlayerPlayBtn.removeAttribute('data-event-bound');
  if (miniPlayerCloseBtn) miniPlayerCloseBtn.removeAttribute('data-event-bound');
  if (progressContainer) progressContainer.removeAttribute('data-event-bound');
  
  currentMainWavesurferForMiniPlayer = null;
}

// 웨이브폼 초기화 함수
function initializeWaveform(waveContainer) {
  if (!waveContainer || !waveContainer.dataset.src) { 
    console.warn("[initializeWaveform] 웨이브폼 컨테이너 또는 src가 유효하지 않습니다.", waveContainer);
    if(waveContainer) waveContainer.innerHTML = '<div class="findmusic-wave-error">오디오 정보 없음</div>';
    return null; // 오류 시 null 반환 명시
  }
  console.log(`[initializeWaveform] 웨이브폼 초기화 시작: ${waveContainer.dataset.src}`);

  const wavesurfer = WaveSurfer.create({
    container: waveContainer,
    waveColor: 'rgba(255, 255, 255, 0.6)',   // 기본 상태: 흰색
    progressColor: '#ff6b35',                // 진행 시: 플레이버튼 주황색
    height: 36,                            // 더 높게
    barWidth: 2.5,                         // 더 두껍게
    barGap: 1.5,                           // 간격 살짝 넓게
    barRadius: 3,                          // 더 둥글게
    cursorWidth: 0,                        // 커서 제거
    interact: true,                        // 클릭으로 이동 가능
    normalize: true,                       // 진폭 정규화
    partialRender: false,                  // 부분 렌더링 비활성화
    scrollParent: false,                   // 스크롤 비활성화
    staticPeaks: false,                    // 동적 모드로 변경
    fillParent: true,                      // 컨테이너 꽉 채우기
    minPxPerSec: 50,                       // 최소 픽셀 설정
    autoCenter: true,                      // 자동 센터링 활성화
    autoScroll: true,                      // 자동 스크롤 활성화
    responsive: true,                      // 반응형 활성화
    hideScrollbar: true,                   // 스크롤바 숨김
    plugins: []                            // 플러그인 배열 비우기
  });
  
  // WaveSurfer 내부 리사이즈 트리거 찾기
  wavesurfer.on('redraw', () => {
    console.log('[WaveSurfer redraw]', Date.now(), waveContainer.dataset.src);
  });
  
  // 생성된 인스턴스를 전역 배열에 추가
  activeWaveSurferInstances.push(wavesurfer);

  // 인스턴스 파괴 시 배열에서 제거
  wavesurfer.on('destroy', () => {
    activeWaveSurferInstances = activeWaveSurferInstances.filter(instance => instance !== wavesurfer);
  });

  const trackItem = waveContainer.closest('.findmusic-track-list-item'); 
  if (!trackItem) { 
    console.error("[initializeWaveform] 부모 .findmusic-track-list-item 요소를 찾을 수 없습니다.", waveContainer);
    wavesurfer.destroy(); // 인스턴스 정리
    return null;
  }
  // playBtn 선택 로직을 HTML 구조 변경에 맞게 수정: .findmusic-play-btn 클래스를 가진 버튼을 직접 찾음
  const playBtn = trackItem.querySelector('.findmusic-play-btn');
  
  let playIcon = null;
  let loadingSpinner = null;
  if(playBtn){
      playIcon = playBtn.querySelector('svg'); 
      loadingSpinner = playBtn.querySelector('.loading-spinner');
  } else {
      console.error("[initializeWaveform] playBtn을 찾을 수 없습니다.", trackItem);
      // playBtn이 없어도 wavesurfer 자체는 초기화될 수 있도록 destroy 호출 제거 (선택적)
      // wavesurfer.destroy(); 
      // return null; 
  }

  if(playBtn) playBtn.disabled = true; 
  if(loadingSpinner) loadingSpinner.style.display = 'block'; 
  if(playIcon && playBtn) playIcon.style.display = 'none'; // playBtn 존재 유무도 함께 체크

  // 대체 확장자 시도를 위한 변수 (초기화)
  if (!waveContainer.dataset.retryCount) {
    waveContainer.dataset.retryCount = '0';
  }
  const maxRetries = 3;
  const extensions = ['.mp3', '.wav', '.m4a'];

  wavesurfer.load(waveContainer.dataset.src);
  
  wavesurfer.on('error', err => {
    console.error(`[initializeWaveform] ERROR 이벤트 발생: ${waveContainer.dataset.src}`, err);
    
    // 현재 재시도 횟수 가져오기
    const retryCount = parseInt(waveContainer.dataset.retryCount) || 0;
    
    // 404 오류이고 재시도 횟수가 남아있는 경우 다른 확장자 시도
    if ((err && err.status === 404) && retryCount < maxRetries) {
      const currentSrc = waveContainer.dataset.src;
      const trackId = trackItem.getAttribute('data-track-id');
      const trackData = tracks.find(t => t.id === trackId) || filteredTracks.find(t => t.id === trackId);
      
      if (trackData && trackData.title) {
        const newExtension = extensions[retryCount];
        const newSrc = getStorageUrl(`track/${trackData.title}${newExtension}`);
        
        console.log(`[Track ${trackData.title}] 대체 확장자 시도 (${retryCount + 1}/${maxRetries}): ${newExtension}`);
        console.log(`[Track ${trackData.title}] 새 URL: ${newSrc}`);
        
        waveContainer.dataset.retryCount = (retryCount + 1).toString();
        waveContainer.dataset.src = newSrc;
        
        // 새 URL로 다시 로드 시도
        wavesurfer.load(newSrc);
        return; // 이벤트 처리 종료, 재시도 중
      }
    }
    
    // 재시도 실패 또는 다른 오류인 경우
    const errorMessage = err && err.status === 404 ? 
      '오디오 파일을 찾을 수 없습니다' : 
      '오디오 로드 실패';
    
    waveContainer.innerHTML = `<div class="findmusic-wave-error">${errorMessage}</div>`;
    
    // 재생 버튼을 비활성화 상태로 설정
    if(playBtn) {
      playBtn.disabled = true;
      playBtn.classList.add('error');
      playBtn.title = errorMessage;
    } 
    if(loadingSpinner) loadingSpinner.style.display = 'none';
    if(playIcon && playBtn) { // playBtn 존재 유무도 함께 체크
        playIcon.innerHTML = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>'; // 오류 아이콘
        playIcon.style.display = 'block';
        playIcon.style.color = '#ff4444';
    }
    
    // 트랙 데이터에 오류 상태 표시
    const trackId = trackItem.getAttribute('data-track-id');
    const trackData = tracks.find(t => t.id === trackId) || filteredTracks.find(t => t.id === trackId);
    if (trackData) {
      trackData.hasAudioError = true;
      console.warn(`[Track ${trackData.title}] 오디오 로드 완전 실패 - 모든 확장자 시도 완료`);
      console.warn(`[Track ${trackData.title}] 최종 URL: ${waveContainer.dataset.src}`);
      console.warn(`[Track ${trackData.title}] 원본 storagePath: ${trackData.storagePath || 'N/A'}`);
      console.warn(`[Track ${trackData.title}] 매칭된 파일명: ${trackData.actualFileName || 'N/A'}`);
      console.warn(`[Track ${trackData.title}] Storage 매칭 성공 여부: ${trackData.actualFileName !== 'N/A' ? 'Yes' : 'No'}`);
      
      // 404 오류인 경우 디버깅 정보 출력
      if (err && err.status === 404) {
        // Storage 파일 목록 다시 가져오기 (캐시된 것 사용)
        getStorageTrackFiles().then(storageFiles => {
          debugStorageFileNotFound(trackData.storagePath || `track/${trackData.title}.mp3`, storageFiles);
        });
      }
    }
  });
  
  wavesurfer.on('loading', progress => {
    if (progress < 100) {
      if(loadingSpinner && playBtn) loadingSpinner.style.display = 'block'; // playBtn 존재 유무도 함께 체크
      if(playIcon && playBtn) playIcon.style.display = 'none'; // playBtn 존재 유무도 함께 체크
    }
  });
  
  wavesurfer.on('ready', () => {
    console.log(`[initializeWaveform] READY 이벤트 발생: ${waveContainer.dataset.src}`);
    if(playBtn) playBtn.disabled = false;
    if(loadingSpinner && playBtn) loadingSpinner.style.display = 'none'; // playBtn 존재 유무도 함께 체크
    if(playIcon && playBtn) { // playBtn 존재 유무도 함께 체크
        playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>'; // 재생 아이콘
        playIcon.style.display = 'block';
    }
    
    const audioDuration = Math.round(wavesurfer.getDuration());
    const durationEl = trackItem.querySelector('.findmusic-item-duration'); // 클래스명 CSS와 통일
    if (durationEl) {
      durationEl.textContent = formatDuration(audioDuration);
    }
    
    const trackId = trackItem.getAttribute('data-track-id');
    const trackData = tracks.find(t => t.id === trackId) || filteredTracks.find(t => t.id === trackId); 
    if (trackData && (trackData.duration === 180 || trackData.duration === 0)) { 
      trackData.duration = audioDuration;
    }
  });
  
  wavesurfer.on('play', () => {
    activeWaveSurferInstances.forEach(instance => {
        if (instance !== wavesurfer && instance.isPlaying()) {
            instance.pause();
            const parentItem = instance.container.closest('.findmusic-track-list-item');
            if (parentItem) {
                parentItem.classList.remove('playing');
                const pauseBtn = parentItem.querySelector('.findmusic-play-btn');
                if (pauseBtn) {
                    pauseBtn.classList.remove('playing');
                    const btnIcon = pauseBtn.querySelector('svg');
                    if (btnIcon) {
                        btnIcon.innerHTML = '<path d="M8 5v14l11-7z"/>'; 
                    }
                }
            }
        }
    });
    
    trackItem.classList.add('playing');
    if (playBtn) {
        playBtn.classList.add('playing');
        if (playIcon) {
            playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        }
    }
    // 미니 플레이어 표시/업데이트
    const trackId = trackItem.getAttribute('data-track-id');
    const trackData = tracks.find(t => t.id === trackId) || filteredTracks.find(t => t.id === trackId);
    if (trackData) {
        showMiniPlayer(trackData, wavesurfer);
    }
  });
  
  wavesurfer.on('pause', () => {
    trackItem.classList.remove('playing');
    if (playBtn) {
        playBtn.classList.remove('playing');
        if (playIcon) {
            playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        }
    }
    // 미니 플레이어 버튼 업데이트
    if (currentMainWavesurferForMiniPlayer === wavesurfer) {
        updateMiniPlayerPlayButton(false);
    }
  });
  
  wavesurfer.on('finish', () => {
    wavesurfer.seekTo(0); 
    trackItem.classList.remove('playing');
    if (playBtn) {
        playBtn.classList.remove('playing');
        if (playIcon) {
            playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        }
    }
    // 미니 플레이어 버튼 업데이트 및 웨이브폼 초기화
    if (currentMainWavesurferForMiniPlayer === wavesurfer) {
        updateMiniPlayerPlayButton(false);
        if (miniWavesurfer) {
            miniWavesurfer.seekTo(0);
        }
    }
  });

  wavesurfer.on('audioprocess', (currentTime) => {
    if (currentMainWavesurferForMiniPlayer === wavesurfer) {
      // 미니플레이어가 열려있는지 확인
      if (document.getElementById('mini-player').classList.contains('active')) {
        // 시간 표시 업데이트
        const miniPlayerTime = document.getElementById('mini-player-time');
        if (miniPlayerTime) {
          miniPlayerTime.textContent = formatDuration(currentTime);
        }
        
        // 진행률 게이지 업데이트
        const miniPlayerProgress = document.getElementById('mini-player-progress');
        if (miniPlayerProgress) {
          const duration = wavesurfer.getDuration();
          if (isFinite(duration) && duration > 0) {
            const percent = (currentTime / duration) * 100;
            miniPlayerProgress.style.width = `${percent}%`;
          }
        }
      }
    }
  });

  wavesurfer.on('seek', (progress) => {
    // 미니플레이어가 열려있는지 확인
    if (currentMainWavesurferForMiniPlayer === wavesurfer && 
        document.getElementById('mini-player').classList.contains('active')) {
      
      // 진행률 게이지 업데이트
      const miniPlayerProgress = document.getElementById('mini-player-progress');
      if (miniPlayerProgress) {
        miniPlayerProgress.style.width = `${progress * 100}%`;
      }
      
      // 시간 표시도 업데이트
      const currentTime = wavesurfer.getCurrentTime();
      const miniPlayerTime = document.getElementById('mini-player-time');
      if (miniPlayerTime) {
        miniPlayerTime.textContent = formatDuration(currentTime);
      }
    }
  });
  
  if(playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 새로운 playTrack 함수 사용 (변수명 수정)
        playTrack(trackItem, wavesurfer);
      });
  }
  
  return wavesurfer;
}

// 초를 분:초 포맷으로 변환하는 함수
function formatDuration(seconds) {
  if (isNaN(seconds) || seconds < 0) return "0:00"; // 유효성 검사 추가
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// DOMContentLoaded 핸들러 또는 즉시 실행 로직
if (document.readyState === 'loading') {
  // 아직 로딩 중이면 이벤트 리스너 추가
  document.addEventListener('DOMContentLoaded', initializePage);
  console.log("[find-music.js] DOMContentLoaded 리스너 등록됨.");
} else {
  // 이미 DOM이 준비되었으면 즉시 실행
  console.log("[find-music.js] DOM이 이미 준비됨. initializePage 직접 호출.");
  initializePage();
}

// 기존 전역 WaveSurfer 인스턴스 관련 부분 제거 또는 주석 처리
/*
if (!WaveSurfer.instances) {
    WaveSurfer.instances = [];
}
WaveSurfer.on('create', (ws) => {
    WaveSurfer.instances.push(ws);
    ws.on('destroy', () => {
        WaveSurfer.instances = WaveSurfer.instances.filter(i => i !== ws);
    });
});
*/

// 콘솔에 폭·overflow 변화 로그 찍기 (문제 진단용)
setTimeout(() => {
  const wrapper = document.querySelector('.scroll > .wrapper');
  const scroll = document.querySelector('.scroll');
  if (wrapper && scroll) {
    new MutationObserver(() => {
      console.log('[DOM 변화]', 'wrapper width:', wrapper.style.width, 
                  'scroll overflow-x:', scroll.style.overflowX, 'time:', Date.now());
    }).observe(wrapper, { attributes: true, attributeFilter: ['style'] });
    
    new MutationObserver(() => {
      console.log('[DOM 변화 scroll]', 'scroll overflow-x:', scroll.style.overflowX, 'time:', Date.now());
    }).observe(scroll, { attributes: true, attributeFilter: ['style'] });
  }
}, 2000); // 2초 후 관찰 시작

// 트랙 재생 함수 개선
function playTrack(trackElement, wavesurfer) {
  if (!trackElement || !wavesurfer) {
    console.error("[playTrack] 필수 매개변수가 없습니다");
    return;
  }

  const trackId = trackElement.getAttribute('data-track-id');
  const trackData = tracks.find(t => t.id === trackId) || filteredTracks.find(t => t.id === trackId);
  
  if (!trackData) {
    console.error("[playTrack] 트랙 데이터를 찾을 수 없습니다:", trackId);
    return;
  }

  // 현재 재생 중인 다른 트랙이 있으면 정지
  if (currentPlayingWavesurfer && currentPlayingWavesurfer !== wavesurfer) {
    currentPlayingWavesurfer.pause();
    
    // 이전 트랙의 UI 상태 초기화
    const prevPlayingItems = document.querySelectorAll('.findmusic-track-list-item.playing');
    prevPlayingItems.forEach(item => {
      item.classList.remove('playing');
      const prevPlayBtn = item.querySelector('.findmusic-play-btn');
      if (prevPlayBtn) {
        prevPlayBtn.classList.remove('playing');
        const prevPlayIcon = prevPlayBtn.querySelector('svg');
        if (prevPlayIcon) {
          prevPlayIcon.setAttribute('d', 'M8 5v14l11-7z'); // 재생 아이콘
        }
      }
    });
  }

  // 새 트랙 재생 시작
  currentPlayingWavesurfer = wavesurfer;
  
  // 트랙 재생/일시정지 토글
  if (wavesurfer.isPlaying()) {
    wavesurfer.pause();
    trackElement.classList.remove('playing');
    hideMiniPlayer();
  } else {
    // 웨이브폼이 준비되었는지 확인
    const isReady = wavesurfer.getDuration() > 0;
    
    if (isReady) {
      // 즉시 재생 가능한 경우
      wavesurfer.play();
      trackElement.classList.add('playing');
      // 재생 시작 후 미니플레이어 표시 (play 이벤트에서 자동 처리됨)
    } else {
      // 웨이브폼이 아직 로드되지 않은 경우
      const playBtn = trackElement.querySelector('.findmusic-play-btn');
      const loadingSpinner = playBtn?.querySelector('.loading-spinner');
      
      if (loadingSpinner) {
        loadingSpinner.style.display = 'block';
      }
      
      // 로드 완료 후 자동 재생
      wavesurfer.once('ready', () => {
        if (loadingSpinner) {
          loadingSpinner.style.display = 'none';
        }
        wavesurfer.play();
        trackElement.classList.add('playing');
      });
    }
  }
  
  console.log(`[playTrack] 트랙 처리: ${trackData.title}`);
}

// 중복된 DOMContentLoaded 이벤트 리스너 제거됨
// 검색 박스 등장 애니메이션은 initializePage 함수 내에서 처리