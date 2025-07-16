// 7월 이벤트 배너 JavaScript - 2025 트렌드 적용
class EventBanner {
    constructor() {
        this.eventEndDate = new Date('2025-07-31T23:59:59').getTime();
        this.checkBannerExpiry();
        this.init();
    }

    // 배너 만료 시간 체크
    checkBannerExpiry() {
        const expiry = localStorage.getItem('eventBannerExpiry');
        if (expiry && new Date().getTime() > parseInt(expiry)) {
            localStorage.removeItem('eventBannerClosed');
            localStorage.removeItem('eventBannerExpiry');
        }
    }

    init() {
        console.log('EventBanner 초기화 시작');
        // 플로팅 배너만 생성 (헤더 배너 제거)
        this.createFloatingBanner();
        this.startCountdown();
        this.initEventListeners();
        console.log('EventBanner 초기화 완료');
    }

    // 헤더 이벤트 배너 생성
    createHeaderBanner() {
        const headerBanner = document.createElement('div');
        headerBanner.className = 'event-header-banner';
        headerBanner.innerHTML = `
            🔥 7월 한정! 신규 채널 등록 시 <a href="event-july-2025.html">로열티 100% 지급 이벤트</a> 🔥
        `;
        
        // 페이지 최상단에 추가
        document.body.insertBefore(headerBanner, document.body.firstChild);
    }

    // 2025 트렌드 플로팅 이벤트 배너 생성 - 전환율 최적화
    createFloatingBanner() {
        // 일본어 선택 시 이벤트 배너 표시하지 않음
        if (window.i18next && window.i18next.language === 'ja') {
            console.log('일본어 선택 상태: 이벤트 배너 표시하지 않음');
            return;
        }

        // 배너 표시 조건 체크 (테스트를 위해 localStorage 체크 임시 제거)
        if (document.querySelector('.event-floating-banner') || 
            window.location.pathname.includes('event-july-2025.html')) {
            return;
        }

        // 테스트를 위해 localStorage 초기화
        localStorage.removeItem('eventBannerClosed');
        localStorage.removeItem('eventBannerExpiry');
        console.log('플로팅 배너 생성 시작');

        const floatingBanner = document.createElement('div');
        floatingBanner.className = 'event-floating-banner';
        floatingBanner.innerHTML = `
            <button class="event-floating-banner-close" aria-label="배너 닫기">✕</button>
            <div class="event-banner-content">
                <div class="event-banner-badge">🔥 Limited Time</div>
                <div class="event-banner-title">
                    로열티 <span class="event-royalty-highlight">100%</span>
                </div>
                <div class="event-banner-subtitle">신규 채널 등록하고 지금 바로 혜택을 받으세요!</div>
                <div class="event-banner-timer">
                    <div class="timer-icon">⏱️</div>
                    <div class="timer-label">이벤트 종료까지</div>
                    <div class="event-banner-countdown" id="floating-countdown">
                        <div class="countdown-unit">
                            <span class="event-banner-countdown-item" id="floating-days">00</span>
                            <span class="countdown-label">일</span>
                        </div>
                        <div class="countdown-separator">:</div>
                        <div class="countdown-unit">
                            <span class="event-banner-countdown-item" id="floating-hours">00</span>
                            <span class="countdown-label">시간</span>
                        </div>
                        <div class="countdown-separator">:</div>
                        <div class="countdown-unit">
                            <span class="event-banner-countdown-item" id="floating-minutes">00</span>
                            <span class="countdown-label">분</span>
                        </div>
                        <div class="countdown-separator">:</div>
                        <div class="countdown-unit">
                            <span class="event-banner-countdown-item" id="floating-seconds">00</span>
                            <span class="countdown-label">초</span>
                        </div>
                    </div>
                </div>
                <a href="event-july-2025.html" class="event-banner-cta" id="floating-cta">
                    지금 시작하기
                </a>
            </div>
        `;

        document.body.appendChild(floatingBanner);
        console.log('플로팅 배너가 DOM에 추가되었습니다');

        // 향상된 닫기 버튼 이벤트
        const closeBtn = floatingBanner.querySelector('.event-floating-banner-close');
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeBanner(floatingBanner);
        });

        // CTA 클릭 추적
        const ctaBtn = floatingBanner.querySelector('#floating-cta');
        ctaBtn.addEventListener('click', () => {
            // 클릭 추적 (필요시 분석 도구 연결)
            this.trackEvent('floating_banner_click', {
                source: 'floating_banner',
                campaign: 'july_2025_event'
            });
        });

        // 스마트 표시 로직
        this.smartDisplay(floatingBanner);
    }

    // 스마트 배너 표시 로직 (테스트를 위해 즉시 표시)
    smartDisplay(banner) {
        // 즉시 표시 (테스트용)
        setTimeout(() => {
            banner.classList.add('show');
            console.log('플로팅 배너가 표시되었습니다!');
        }, 1000);

        // 원래 로직 (주석 처리)
        /*
        let scrollCount = 0;
        let timeOnPage = 0;
        
        const timer = setInterval(() => {
            timeOnPage += 1000;
            
            // 3초 후 또는 스크롤 1번 후 표시 (더 빠르게 수정)
            if (timeOnPage >= 3000 || scrollCount >= 1) {
                banner.classList.add('show');
                clearInterval(timer);
            }
        }, 1000);

        // 스크롤 감지
        const handleScroll = () => {
            scrollCount++;
            if (scrollCount >= 1 && timeOnPage >= 2000) {
                banner.classList.add('show');
                clearInterval(timer);
                window.removeEventListener('scroll', handleScroll);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        */
    }

    // 배너 닫기 애니메이션
    closeBanner(banner) {
        banner.style.transform = 'translateY(100px) scale(0.9)';
        banner.style.opacity = '0';
        
        setTimeout(() => {
            banner.remove();
        }, 600);
        
        // 24시간 동안 배너 숨김
        const expireTime = new Date().getTime() + (24 * 60 * 60 * 1000);
        localStorage.setItem('eventBannerClosed', 'true');
        localStorage.setItem('eventBannerExpiry', expireTime.toString());
    }

    // 이벤트 추적 (선택사항)
    trackEvent(eventName, properties = {}) {
        // Google Analytics, Mixpanel 등과 연결 가능
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, properties);
        }
        console.log('Event tracked:', eventName, properties);
    }

    // 메인 이벤트 배너 생성 (메인 페이지용)
    createMainEventBanner() {
        const heroSection = document.querySelector('.hero-section');
        if (!heroSection) return;

        const eventBanner = document.createElement('div');
        eventBanner.className = 'event-banner event-banner-enter';
        eventBanner.innerHTML = `
            <div class="event-banner-content">
                <div class="event-banner-badge">🔥 7월 한정 특별 이벤트</div>
                <div class="event-banner-title">
                    신규 채널 등록 시 로열티 <span class="event-royalty-highlight">100%</span> 지급!
                </div>
                <div class="event-banner-subtitle">
                    기존 80%에서 100%로 업그레이드! 놓치면 후회하는 특별 혜택
                </div>
                <div class="event-banner-timer">
                    ⏰ 이벤트 종료까지
                    <div class="event-banner-countdown" id="main-countdown">
                        <span class="event-banner-countdown-item" id="main-days">00</span>일
                        <span class="event-banner-countdown-item" id="main-hours">00</span>시간
                        <span class="event-banner-countdown-item" id="main-minutes">00</span>분
                        <span class="event-banner-countdown-item" id="main-seconds">00</span>초
                    </div>
                </div>
                <a href="event-july-2025.html" class="event-banner-cta">🚀 지금 바로 참여하기</a>
            </div>
        `;

        // 히어로 섹션 바로 다음에 삽입
        heroSection.insertAdjacentElement('afterend', eventBanner);
    }

    // 컴팩트 이벤트 배너 생성 (다른 페이지용)
    createCompactEventBanner() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        const eventBanner = document.createElement('div');
        eventBanner.className = 'event-banner event-banner-compact event-banner-enter';
        eventBanner.innerHTML = `
            <div class="event-banner-content">
                <div class="event-banner-badge">🔥 7월 한정</div>
                <div class="event-banner-title">
                    신규 채널 로열티 <span class="event-royalty-highlight">100%</span>
                </div>
                <div class="event-banner-subtitle">기존 80%에서 100%로 특별 혜택!</div>
            </div>
            <a href="event-july-2025.html" class="event-banner-cta">참여하기</a>
        `;

        // 네비바 바로 다음에 삽입
        navbar.insertAdjacentElement('afterend', eventBanner);
    }

    // 카운트다운 타이머 시작
    startCountdown() {
        this.updateCountdown();
        setInterval(() => this.updateCountdown(), 1000);
    }

    // 카운트다운 업데이트
    updateCountdown() {
        const now = new Date().getTime();
        const distance = this.eventEndDate - now;

        if (distance > 0) {
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            // 플로팅 배너 카운트다운
            this.updateCountdownElement('floating-days', days);
            this.updateCountdownElement('floating-hours', hours);
            this.updateCountdownElement('floating-minutes', minutes);
            this.updateCountdownElement('floating-seconds', seconds);

            // 메인 배너 카운트다운
            this.updateCountdownElement('main-days', days);
            this.updateCountdownElement('main-hours', hours);
            this.updateCountdownElement('main-minutes', minutes);
            this.updateCountdownElement('main-seconds', seconds);

        } else {
            // 이벤트 종료
            this.onEventEnd();
        }
    }

    // 카운트다운 요소 업데이트 (애니메이션 개선)
    updateCountdownElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            const newValue = value.toString().padStart(2, '0');
            const currentValue = element.textContent;
            
            // 값이 변경될 때만 애니메이션 적용
            if (currentValue !== newValue) {
                element.classList.add('countdown-flip');
                
                setTimeout(() => {
                    element.textContent = newValue;
                    element.classList.remove('countdown-flip');
                }, 150);
            }
        }
    }

    // 이벤트 종료 처리
    onEventEnd() {
        // 모든 이벤트 배너 숨기기
        document.querySelectorAll('.event-banner, .event-floating-banner, .event-header-banner')
            .forEach(banner => {
                banner.style.display = 'none';
            });
    }

    // 이벤트 리스너 초기화
    initEventListeners() {
        // 메인 페이지와 컴팩트 배너 생성 제거 - 플로팅 배너만 사용
        document.addEventListener('DOMContentLoaded', () => {
            // 모든 페이지에서 플로팅 배너만 표시
        });

        // 스크롤 시 플로팅 배너 표시/숨김
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            const floatingBanner = document.querySelector('.event-floating-banner');
            if (!floatingBanner) return;

            clearTimeout(scrollTimeout);
            
            // 스크롤 중일 때 배너 숨기기
            floatingBanner.style.opacity = '0.7';
            
            scrollTimeout = setTimeout(() => {
                floatingBanner.style.opacity = '1';
            }, 150);
        });
    }

    // 배너 수동 생성 (특정 컨테이너에)
    static createBannerInContainer(container, type = 'main') {
        const eventBanner = new EventBanner();
        
        const banner = document.createElement('div');
        banner.className = `event-banner ${type === 'compact' ? 'event-banner-compact' : ''} event-banner-enter`;
        
        if (type === 'compact') {
            banner.innerHTML = `
                <div class="event-banner-content">
                    <div class="event-banner-badge">🔥 7월 한정</div>
                    <div class="event-banner-title">
                        신규 채널 로열티 <span class="event-royalty-highlight">100%</span>
                    </div>
                    <div class="event-banner-subtitle">기존 80%에서 100%로 특별 혜택!</div>
                </div>
                <a href="event-july-2025.html" class="event-banner-cta">참여하기</a>
            `;
        } else {
            banner.innerHTML = `
                <div class="event-banner-content">
                    <div class="event-banner-badge">🔥 7월 한정 특별 이벤트</div>
                    <div class="event-banner-title">
                        신규 채널 등록 시 로열티 <span class="event-royalty-highlight">100%</span> 지급!
                    </div>
                    <div class="event-banner-subtitle">
                        기존 80%에서 100%로 업그레이드! 놓치면 후회하는 특별 혜택
                    </div>
                    <a href="event-july-2025.html" class="event-banner-cta">🚀 지금 바로 참여하기</a>
                </div>
            `;
        }
        
        container.appendChild(banner);
        return banner;
    }
}

// 이벤트 배너 자동 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.eventBannerInstance = new EventBanner();
    });
} else {
    window.eventBannerInstance = new EventBanner();
}

// 전역으로 EventBanner 클래스 노출
window.EventBanner = EventBanner; 