// 간단한 i18next 대체 구현
class SimpleI18n {
  constructor() {
    this.language = 'ko';
    this.translations = {};
    this.fallbackLng = 'ko';
  }

  async init(options) {
    console.log('SimpleI18n 초기화 시작...');
    
    this.language = options.lng || 'ko';
    this.fallbackLng = options.fallbackLng || 'ko';
    
    // 번역 파일 로드
    await this.loadTranslations(this.language);
    
    console.log('SimpleI18n 초기화 완료, 현재 언어:', this.language);
    return this;
  }

  async loadTranslations(lang) {
    try {
      console.log(`번역 파일 로드 시도: ${lang}`);
      
      // 현재 경로에 따라 locales 폴더 경로 결정
      const isInSubfolder = window.location.pathname.includes('/pages/');
      const localesPath = isInSubfolder ? '../locales' : './locales';
      
      const response = await fetch(`${localesPath}/${lang}/common.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.translations[lang] = data;
      
      console.log(`번역 파일 로드 성공: ${lang}`, data);
    } catch (error) {
      console.error(`번역 파일 로드 실패: ${lang}`, error);
      
      // 폴백 번역 데이터
      if (lang === 'ko') {
        this.translations[lang] = {
          navbar: { home: "홈", brand: "브랜드 소개", withdraw: "계좌 등록", findMusic: "음원 찾기", channel: "채널 관리", track: "트랙 제작", login: "로그인", producer: "Audionyx 프로듀서", faq: "FAQ", logout: "로그아웃" },
          hero: { fixed: "FREE TRACKS + EARN", main: "쇼츠에 음원 수익을 더하세요.", desc: "유튜브가 저작권자에게 지급한 음악 라이선스 비용을 AUDIONYX가 크리에이터에게 제공하는 방식으로 음원 수익이 발생합니다.", cta: "지금 시작하기" },
          footer: { tagline: "쇼츠 음원 수익화 플랫폼", service: "서비스", company: "회사", contact: "연락처", copy: "© 2025 AUDIONYX Music, Inc. All rights reserved.", loc: "Seoul, Korea" },
          mobile: { home: "홈", music: "음원", channel: "채널", withdraw: "정산", production: "제작" },
          brand: { title: "브랜드 소개", heroTitle: "브랜드 소개", heroSubtitle: "크리에이터를 위한 음원 수익화 플랫폼", heroCta: "Go Tracks", aboutTitle: "Audionyx란?", aboutHeadline: "음원 수익도, 영상 수익도<br>Audionyx 하나로 모두 가져가세요", whyTitle: "Why Audionyx?", whySubtitle: "Audionyx와 함께 시작하는 새로운 수익 창출의 3가지 핵심" }
        };
      } else if (lang === 'ja') {
        this.translations[lang] = {
          navbar: { home: "ホーム", brand: "ブランド紹介", withdraw: "口座登録", findMusic: "音源検索", channel: "チャンネル管理", track: "トラック制作", login: "ログイン", producer: "Audionyx プロデューサー", faq: "FAQ", logout: "ログアウト" },
          hero: { fixed: "FREE TRACKS + EARN", main: "ショートに音源収益をプラス。", desc: "YouTubeが著作権者に支払った音楽ライセンス費用をAUDIONYXがクリエイターに提供する方式で音源収益が発生します。", cta: "今すぐ始める" },
          footer: { tagline: "ショート音源収益化プラットフォーム", service: "サービス", company: "会社", contact: "連絡先", copy: "© 2025 AUDIONYX Music, Inc. All rights reserved.", loc: "Seoul, Korea" },
          mobile: { home: "ホーム", music: "音源", channel: "チャンネル", withdraw: "精算", production: "制作" },
          brand: { title: "ブランド紹介", heroTitle: "ブランド紹介", heroSubtitle: "クリエイター向け音源収益化プラットフォーム", heroCta: "Go Tracks", aboutTitle: "Audionyxとは？", aboutHeadline: "音源収益も、動画収益も<br>Audionyx一つで全て手に入れましょう", whyTitle: "Why Audionyx?", whySubtitle: "Audionyxと共に始める新しい収益創出の3つの核心" }
        };
      }
      console.log(`폴백 번역 데이터 사용: ${lang}`);
    }
  }

  t(key) {
    const keys = key.split('.');
    let value = this.translations[this.language];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }
    
    // 폴백 언어에서 찾기
    if (value === undefined && this.language !== this.fallbackLng) {
      let fallbackValue = this.translations[this.fallbackLng];
      for (const k of keys) {
        if (fallbackValue && typeof fallbackValue === 'object') {
          fallbackValue = fallbackValue[k];
        } else {
          fallbackValue = undefined;
          break;
        }
      }
      value = fallbackValue;
    }
    
    return value || key;
  }

  async changeLanguage(lang, callback) {
    console.log('언어 변경 요청:', lang);
    
    try {
      if (!this.translations[lang]) {
        await this.loadTranslations(lang);
      }
      
      this.language = lang;
      console.log('언어 변경 완료:', lang);
      
      if (callback) callback(null, this.t.bind(this));
    } catch (error) {
      console.error('언어 변경 실패:', error);
      if (callback) callback(error);
    }
  }
}

// 전역 i18next 인스턴스
let i18next = new SimpleI18n();

// i18next 초기화 및 설정
async function initI18n() {
  try {
    console.log('i18next 초기화 시작...');
    
    const saved = localStorage.getItem("lang");
    const fallback = navigator.language.startsWith("ja") ? "ja" : "ko";
    const initialLang = saved || fallback;
    
    console.log('초기 언어 설정:', initialLang);

    await i18next.init({
      lng: initialLang,
      fallbackLng: "ko"
    });
    
    // 전역 i18next 참조 설정
    window.i18next = i18next;
    
    // 초기 번역 적용
    translate();
    bindLangToggles();
    updateActive(i18next.language);
    
  } catch (error) {
    console.error('i18next 초기화 실패:', error);
  }
}

function translate() {
  console.log('번역 적용 시작...');
  
  // 일반 텍스트 번역
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    const translation = i18next.t(key);
    
    console.log(`번역: ${key} -> ${translation}`);
    
    if (translation && translation !== key) {
      el.innerHTML = translation;
    }
  });

  // HTML 내용 번역
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.dataset.i18nHtml;
    const translation = i18next.t(key);
    
    console.log(`HTML 번역: ${key} -> ${translation}`);
    
    if (translation && translation !== key) {
      el.innerHTML = translation;
    }
  });

  // placeholder 속성 번역
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    const translation = i18next.t(key);
    
    console.log(`Placeholder 번역: ${key} -> ${translation}`);
    
    if (translation && translation !== key) {
      el.placeholder = translation;
    }
  });

  // aria-label 속성 번역
  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.dataset.i18nAriaLabel;
    const translation = i18next.t(key);
    
    console.log(`Aria-label 번역: ${key} -> ${translation}`);
    
    if (translation && translation !== key) {
      el.setAttribute('aria-label', translation);
    }
  });

  // title 속성 번역
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle;
    const translation = i18next.t(key);
    
    console.log(`Title 번역: ${key} -> ${translation}`);
    
    if (translation && translation !== key) {
      el.setAttribute('title', translation);
    }
  });

  // alt 속성 번역
  document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
    const key = el.dataset.i18nAlt;
    const translation = i18next.t(key);
    
    console.log(`Alt 번역: ${key} -> ${translation}`);
    
    if (translation && translation !== key) {
      el.setAttribute('alt', translation);
    }
  });

  // HTML 내용 번역 (data-i18n-html)
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.dataset.i18nHtml;
    const translation = i18next.t(key);
    
    console.log(`HTML 번역: ${key} -> ${translation}`);
    
    if (translation && translation !== key) {
      el.innerHTML = translation;
    }
  });
  
  console.log('번역 적용 완료');
}

function bindLangToggles() {
  console.log('언어 토글 바인딩 시작...');
  
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    console.log('토글 버튼 발견:', btn.dataset.lang);
    
    btn.onclick = (e) => {
      e.preventDefault();
      const lang = btn.dataset.lang;
      
      console.log('언어 변경 요청:', lang);
      
      i18next.changeLanguage(lang, (err, t) => {
        if (err) {
          console.error('언어 변경 실패:', err);
          return;
        }
        
        console.log('언어 변경 완료:', lang);
        localStorage.setItem("lang", lang);
        translate();
        updateActive(lang);
        // 언어 변경 후 동적으로 제어되는 일부 UI 텍스트 동기화
        try {
          if (typeof window.syncDynamicI18n === 'function') {
            window.syncDynamicI18n();
          }
        } catch (e) { /* no-op */ }
      });
    };
  });
  
  console.log('언어 토글 바인딩 완료');
}

function updateActive(lang) {
  console.log('활성 상태 업데이트:', lang);
  
  document.querySelectorAll("[data-lang]").forEach((el) => {
    const isActive = el.dataset.lang === lang;
    el.classList.toggle("active", isActive);
    console.log(`토글 ${el.dataset.lang}: ${isActive ? '활성' : '비활성'}`);
  });
}

// DOM 로드 완료 시 초기화
document.addEventListener("DOMContentLoaded", () => {
  console.log('DOM 로드 완료, i18next 초기화 시작');
  console.log('현재 페이지 경로:', window.location.pathname);
  initI18n();
});

// 디버깅용 전역 함수
window.debugI18n = function() {
  console.log('=== i18n 디버깅 정보 ===');
  console.log('현재 언어:', i18next.language);
  console.log('로드된 번역:', i18next.translations);
  console.log('data-i18n 요소들:', document.querySelectorAll('[data-i18n]').length);
  console.log('언어 토글 버튼들:', document.querySelectorAll('[data-lang]').length);
};

// 전역 함수로 노출 (기존 코드 호환성)
window.changeLanguage = (lang) => {
  console.log('전역 changeLanguage 호출:', lang);
  
  if (window.i18next) {
    i18next.changeLanguage(lang, (err, t) => {
      if (err) {
        console.error('언어 변경 실패:', err);
        return;
      }
      
      localStorage.setItem("lang", lang);
      translate();
      updateActive(lang);
    });
  } else {
    console.error('i18next가 아직 초기화되지 않았습니다');
  }
}; 