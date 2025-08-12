// === Firebase 및 Firestore 모듈 Import ===
import { app, db } from './firebase.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';

// === 2024 모바일 UI/UX 트렌드 적용 - 터치 최적화 및 성능 개선 ===
document.addEventListener('DOMContentLoaded', function() {
    // 모바일 터치 최적화
    function setupMobileTouchOptimization() {
        // 터치 디바이스 감지
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        if (isTouchDevice) {
            // 2024 트렌드: 터치 피드백 최적화
            document.body.addEventListener('touchstart', function(e) {
                const target = e.target.closest('.feature-card, .track-card, .flow, .btn-primary, .copy-cid-btn, .track-play-btn');
                if (target) {
                    target.style.transform = 'scale(0.98)';
                    target.style.transition = 'transform 0.1s ease';
                }
            }, { passive: true });
            
            document.body.addEventListener('touchend', function(e) {
                const target = e.target.closest('.feature-card, .track-card, .flow, .btn-primary, .copy-cid-btn, .track-play-btn');
                if (target) {
                    setTimeout(() => {
                        target.style.transform = '';
                        target.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                    }, 100);
                }
            }, { passive: true });
            
            // 모바일용 스크롤 성능 최적화
            let ticking = false;
            function updateScrollElements() {
                // 스크롤 위치에 따른 엘리먼트 최적화
                const scrollY = window.pageYOffset;
                
                // 패럴랙스 효과 최적화 (모바일에서는 제한적 적용)
                const heroOverlay = document.querySelector('.brand-hero-overlay');
                if (heroOverlay && scrollY < window.innerHeight) {
                    heroOverlay.style.transform = `translateY(${scrollY * 0.2}px)`;
                }
                
                ticking = false;
            }
            
            function requestScrollUpdate() {
                if (!ticking) {
                    requestAnimationFrame(updateScrollElements);
                    ticking = true;
                }
            }
            
            // 패시브 스크롤 리스너로 성능 최적화
            window.addEventListener('scroll', requestScrollUpdate, { passive: true });
        }
    }
    
    // 2024 트렌드: 다크모드 시스템 색상 대응
    function setupDarkModeOptimization() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        
        function updateThemeColor(e) {
            const themeColorMeta = document.querySelector('meta[name="theme-color"]');
            if (themeColorMeta) {
                themeColorMeta.content = e.matches ? '#0c0c0c' : '#16171B';
            }
        }
        
        prefersDark.addEventListener('change', updateThemeColor);
        updateThemeColor(prefersDark);
    }
    
    // 2024 트렌드: 레이지 로딩 최적화
    function setupPerformanceOptimization() {
        // Intersection Observer로 성능 최적화
        const lazyElements = document.querySelectorAll('.feature-card, .track-card, .flow');
        
        const lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    lazyObserver.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '50px 0px',
            threshold: 0.1
        });
        
        lazyElements.forEach(el => lazyObserver.observe(el));
        
        // 메모리 누수 방지
        window.addEventListener('beforeunload', () => {
            lazyObserver.disconnect();
        });
    }
    
    // 현재 페이지 네비게이션 메뉴 활성화
    function activateCurrentPageNavItem() {
        // 현재 페이지 URL 가져오기
        const currentUrl = window.location.href;
        const menuItems = document.querySelectorAll('.menu-area ul li a');
        
        // 모든 메뉴 항목에서 active 클래스 제거
        document.querySelectorAll('.menu-area ul li').forEach(item => {
            item.classList.remove('active');
        });
        
        // 현재 URL과 일치하는 메뉴 항목 찾기
        menuItems.forEach(item => {
            // 전체 URL이 아닌 마지막 경로 부분으로 비교
            const itemPath = item.getAttribute('href');
            
            // 브랜드 소개 페이지는 페이지/brand.html에 있으므로 해당 경로 확인
            if (currentUrl.includes('brand.html') && itemPath.includes('brand.html')) {
                item.parentElement.classList.add('active');
            }
        });
    }
    
    // 초기화 함수 실행 (DOM 로딩 완료 후)
    setupMobileTouchOptimization();
    setupDarkModeOptimization();
    setupPerformanceOptimization();
    
    // 네비게이션 메뉴 활성화 실행
    activateCurrentPageNavItem();
    
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
    
    // 정적 미리보기 섹션 애니메이션만 설정 (Firestore 로딩 제거)
    setupPreviewSectionAnimations();

    
    // 인사이트 섹션 애니메이션
    function setupInsightsAnimations() {
        const insightsTitle = document.querySelector('.insights-title-container');
        const graphCards = document.querySelectorAll('.graph-card');
        
        // 인터섹션 옵저버로 스크롤 애니메이션
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animated');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });
        
        // 타이틀과 그래프 카드 관찰 시작
        if (insightsTitle) {
            observer.observe(insightsTitle);
        }
        
        graphCards.forEach(card => {
            observer.observe(card);
        });
    }
    
    // 핵심 기능 카드 애니메이션
    function setupFeatureCardsAnimation() {
        const featureCards = document.querySelectorAll('.feature-card');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, 100 * Array.from(featureCards).indexOf(entry.target));
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        
        featureCards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            observer.observe(card);
        });
    }
    
    // 플로우 섹션 애니메이션
    function setupFlowAnimation() {
        const flowItems = document.querySelectorAll('.flow');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animated');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });
        
        flowItems.forEach(item => {
            observer.observe(item);
        });
    }
    
    // 조회수별 실수익 비교 그래프 복원 (Chart.js)
    function renderTotalRevenueChart() {
        const ctx = document.getElementById('totalRevenueChart');
        if (!ctx) return;
        
        // 현재 언어 감지
        const currentLanguage = window.i18next && window.i18next.language ? window.i18next.language : 'ko';
        
        // 언어별 라벨 설정
        const labels = {
            ko: {
                withAudionyx: 'Audionyx 사용',
                withoutAudionyx: 'Audionyx 미사용',
                viewCounts: ['100만','300만','500만','700만','1000만','3000만','5000만'],
                currency: '₩',
                difference: '차이 금액',
                increaseRate: '증가율'
            },
            ja: {
                withAudionyx: 'Audionyx使用',
                withoutAudionyx: 'Audionyx未使用',
                viewCounts: ['100万','300万','500万','700万','1000万','3000万','5000万'],
                currency: '¥',
                difference: '差額',
                increaseRate: '増加率'
            }
        };

        const currentLabels = labels[currentLanguage] || labels.ko;
        
        // ===== 새 단가 기준 =====
        const AVG_PREMIUM_UNIT = 0.6038;     // FAQ 평균 (원 / 프리미엄 뷰)
        const PREMIUM_RATIO    = 0.2933;     // 프리미엄 뷰 비율
        const basePerView      = AVG_PREMIUM_UNIT * PREMIUM_RATIO;           // 0.1771
        const Rpm              = (basePerView * 1000) / 0.36;                // 491.7
        const audionyxPerView  = basePerView + 0.16 * (Rpm / 1000);          // 0.2558

        const viewsList = [1e6, 3e6, 5e6, 7e6, 1e7, 3e7, 5e7];
        const baselineData = viewsList.map(v => Math.round(v * basePerView));
        const audionyxData = viewsList.map(v => Math.round(v * audionyxPerView));

        // 각 조회수에서 증가하는 금액 계산
        const increasedAmounts = viewsList.map((v, index) => {
            return audionyxData[index] - baselineData[index];
        });

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: currentLabels.viewCounts,
                datasets: [
                    {
                        label: currentLabels.withAudionyx,
                        data: audionyxData,
                        borderColor: '#3EB489',
                        backgroundColor: 'rgba(62,180,137,0.10)',
                        borderWidth: 1.5,
                        pointRadius: 4,
                        pointBackgroundColor: '#3EB489',
                        tension: 0.35,
                        fill: true,
                        pointHoverRadius: 9,
                        pointHoverBorderColor: '#fff',
                        pointHoverBorderWidth: 3,
                    },
                    {
                        label: currentLabels.withoutAudionyx,
                        data: baselineData,
                        borderColor: '#ffffff',
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1.5,
                        pointRadius: 3,
                        pointBackgroundColor: '#fff',
                        tension: 0.35,
                        fill: false,
                        pointHoverRadius: 7,
                        pointHoverBorderColor: '#3EB489',
                        pointHoverBorderWidth: 3,
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#fff', font: { weight: 'bold' } }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#111',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#3EB489',
                        borderWidth: 1.5,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label;
                                const value = context.parsed.y;
                                return `${label}: ${currentLabels.currency}${value.toLocaleString()}`;
                            },
                            afterBody: function(tooltipItems) {
                                if (tooltipItems.length === 2) {
                                    const audionyxValue = tooltipItems.find(item => item.dataset.label === currentLabels.withAudionyx)?.parsed.y || 0;
                                    const baseValue = tooltipItems.find(item => item.dataset.label === currentLabels.withoutAudionyx)?.parsed.y || 0;
                                    const difference = audionyxValue - baseValue;
                                    const increaseRate = baseValue > 0 ? ((difference / baseValue) * 100).toFixed(1) : 0;
                                    
                                    return [
                                        '',
                                        `${currentLabels.difference}: +${currentLabels.currency}${difference.toLocaleString()}`,
                                        `${currentLabels.increaseRate}: +${increaseRate}%`
                                    ];
                                }
                                return [];
                            }
                        }
                    }
                },
                layout: {
                    padding: { left: 10, right: 10, top: 10, bottom: 40 }
                },
                scales: {
                    x: {
                        ticks: { 
                            color: '#fff', 
                            font: { weight: 'bold' }
                        },
                        grid: { color: 'rgba(40,40,40,0.7)' }
                    },
                    y: {
                        ticks: { 
                            color: '#fff', 
                            font: { weight: 'bold' },
                            callback: function(value) {
                                return currentLabels.currency + value.toLocaleString();
                            }
                        },
                        grid: { color: 'rgba(40,40,40,0.7)' }
                    }
                },
                backgroundColor: '#111',
                hover: {
                    mode: 'nearest',
                    intersect: true,
                    animationDuration: 400
                },
                animation: {
                    duration: 700,
                    easing: 'easeOutQuart',
                }
            },
        });
        // 그래프 카드 네온 효과 토글
        const graphCard = ctx.closest('.main-graph-card');
        if (graphCard) {
            ctx.addEventListener('mouseenter', () => graphCard.classList.add('neon-hover'));
            ctx.addEventListener('mouseleave', () => graphCard.classList.remove('neon-hover'));
        }
    }
    
    // === 핵심 기능 아이콘 SVG 애니메이션 ===
    function animateFeatureIcons() {
        const featureCards = document.querySelectorAll('.feature-card');
        featureCards.forEach(card => {
            const svg = card.querySelector('.feature-icon');
            if (!svg) return;
            // 모든 path, rect, circle에 애니메이션 클래스 부여
            svg.querySelectorAll('path, rect, circle').forEach(el => {
                el.classList.add('svg-animate-stroke');
                // 초기값
                el.style.strokeDasharray = el.getTotalLength ? el.getTotalLength() : 100;
                el.style.strokeDashoffset = el.getTotalLength ? el.getTotalLength() : 100;
                el.style.opacity = 0.7;
            });
        });

        // 카드 등장 시 SVG 선 그리기 애니메이션
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const svg = entry.target.querySelector('.feature-icon');
                    if (svg) {
                        svg.querySelectorAll('path, rect, circle').forEach((el, idx) => {
                            setTimeout(() => {
                                el.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1), opacity 0.7s';
                                el.style.strokeDashoffset = 0;
                                el.style.opacity = 1;
                            }, idx * 180);
                        });
                    }
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        featureCards.forEach(card => observer.observe(card));
    }
    
    // === 대시보드 카운트업 애니메이션 ===
    function animateDashboardCounters() {
        const dataValues = document.querySelectorAll('.data-value');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const dataValue = entry.target;
                    const text = dataValue.textContent;
                    
                    // 숫자 추출 (예: "124,589" -> 124589)
                    const targetNumber = parseInt(text.replace(/[^\d]/g, ''));
                    
                    if (targetNumber > 0) {
                        // 카운트업 애니메이션
                        animateCounter(dataValue, 0, targetNumber, text);
                    }
                    
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        
        dataValues.forEach(value => observer.observe(value));
    }

    function animateCounter(element, start, end, originalText) {
        const duration = 2000; // 2초
        const startTime = performance.now();
        
        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // easeOutQuart 이징
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            const currentValue = Math.floor(start + (end - start) * easeProgress);
            
            // 원본 텍스트 포맷에 맞춰 표시
            if (originalText.includes('₩')) {
                element.textContent = `₩${currentValue.toLocaleString()}`;
            } else {
                element.textContent = currentValue.toLocaleString();
            }
            
            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        }
        
        requestAnimationFrame(updateCounter);
    }
    
    // === 플로우(3단계) 각 박스별 등장 애니메이션 ===
    function animateFlowSteps() {
        const flowSteps = document.querySelectorAll('.flows-container .flow');
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fade-up');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        flowSteps.forEach(step => {
            step.classList.remove('animate-fade-up');
            observer.observe(step);
        });
    }
    
    // === 모바일 스와이프 플로우 인터랙션 ===
    function setupMobileFlowInteraction() {
        const container = document.getElementById('mobile-flows-container');
        const progressDots = document.querySelectorAll('.mobile-progress-dot');
        const swipeHint = document.querySelector('.mobile-swipe-hint');
        
        if (!container || !progressDots.length) return;

        let currentStep = 1;
        let startX = 0;
        let scrollLeft = 0;
        let isDown = false;
        let hasInteracted = false;

        // 프로그레스 도트 업데이트
        function updateProgress(step) {
            progressDots.forEach(dot => {
                const dotStep = parseInt(dot.getAttribute('data-step'));
                dot.classList.toggle('active', dotStep === step);
            });
            currentStep = step;
        }

        // 스크롤 위치에 따른 현재 스텝 계산
        function getCurrentStepFromScroll() {
            const scrollLeft = container.scrollLeft;
            const cardWidth = container.querySelector('.mobile-flow-card').offsetWidth + 24; // gap 포함
            return Math.round(scrollLeft / cardWidth) + 1;
        }

        // 스와이프 힌트 숨기기
        function hideSwipeHint() {
            if (!hasInteracted && swipeHint) {
                hasInteracted = true;
                swipeHint.style.opacity = '0';
                swipeHint.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    swipeHint.style.display = 'none';
                }, 300);
            }
        }

        // 터치 이벤트 (모바일)
        container.addEventListener('touchstart', (e) => {
            hideSwipeHint();
            startX = e.touches[0].pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
            isDown = true;
        }, { passive: true });

        container.addEventListener('touchend', () => {
            isDown = false;
            const newStep = getCurrentStepFromScroll();
            if (newStep !== currentStep) {
                updateProgress(newStep);
                
                // 햅틱 피드백 (지원되는 기기에서)
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.touches[0].pageX - container.offsetLeft;
            const walk = (x - startX) * 2;
            container.scrollLeft = scrollLeft - walk;
        });

        // 마우스 이벤트 (데스크톱에서 테스트용)
        container.addEventListener('mousedown', (e) => {
            hideSwipeHint();
            isDown = true;
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
            container.style.cursor = 'grabbing';
        });

        container.addEventListener('mouseleave', () => {
            isDown = false;
            container.style.cursor = 'grab';
        });

        container.addEventListener('mouseup', () => {
            isDown = false;
            container.style.cursor = 'grab';
            const newStep = getCurrentStepFromScroll();
            if (newStep !== currentStep) {
                updateProgress(newStep);
            }
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 2;
            container.scrollLeft = scrollLeft - walk;
        });

        // 스크롤 이벤트로 프로그레스 동기화
        container.addEventListener('scroll', () => {
            const newStep = getCurrentStepFromScroll();
            if (newStep !== currentStep) {
                updateProgress(newStep);
            }
        }, { passive: true });

        // 프로그레스 도트 클릭으로 해당 스텝으로 이동
        progressDots.forEach(dot => {
            dot.addEventListener('click', () => {
                hideSwipeHint();
                const targetStep = parseInt(dot.getAttribute('data-step'));
                const cardWidth = container.querySelector('.mobile-flow-card').offsetWidth + 24;
                const targetScrollLeft = (targetStep - 1) * cardWidth;
                
                container.scrollTo({
                    left: targetScrollLeft,
                    behavior: 'smooth'
                });
                
                updateProgress(targetStep);
            });
        });

        // 카드 내부 버튼 인터랙션
        setupMobileCardInteractions();
    }

    // === 모바일 카드 내부 인터랙션 ===
    function setupMobileCardInteractions() {
        // Step 1: Copy CID 버튼
        const mobileCopyBtn = document.querySelector('.mobile-copy-button');
        if (mobileCopyBtn) {
            mobileCopyBtn.addEventListener('click', () => {
                // 성공 피드백
                mobileCopyBtn.textContent = 'Copied!';
                mobileCopyBtn.style.background = '#2fcc80';
                
                // 파티클 효과
                createMobileCopyEffect(mobileCopyBtn);
                
                // 햅틱 피드백
                if (navigator.vibrate) {
                    navigator.vibrate([50, 50, 50]);
                }
                
                setTimeout(() => {
                    mobileCopyBtn.textContent = 'Copy CID';
                    mobileCopyBtn.style.background = '';
                }, 2000);
            });
        }

        // Step 2: 입력 필드 애니메이션
        const mobileInputField = document.querySelector('.mobile-input-field');
        if (mobileInputField) {
            // 타이핑 효과 시뮬레이션
            let typingInterval;
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        startTypingAnimation();
                        observer.unobserve(entry.target);
                    }
                });
            });
            observer.observe(mobileInputField);

            function startTypingAnimation() {
                const text = 'CID: Music_12345';
                let currentText = '';
                let index = 0;
                
                typingInterval = setInterval(() => {
                    if (index < text.length) {
                        currentText += text[index];
                        mobileInputField.textContent = currentText;
                        index++;
                    } else {
                        clearInterval(typingInterval);
                        // 체크 아이콘 애니메이션 트리거
                        const checkIcon = document.querySelector('.mobile-check-icon');
                        if (checkIcon) {
                            checkIcon.style.animation = 'mobileCheckPulse 0.5s ease-out';
                        }
                    }
                }, 150);
            }
        }

        // Step 3: 통계 카운터 애니메이션
        const statValues = document.querySelectorAll('.mobile-stat-value');
        statValues.forEach(value => {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        animateMobileCounter(entry.target);
                        observer.unobserve(entry.target);
                    }
                });
            });
            observer.observe(value);
        });
    }

    // === 모바일 Copy 성공 효과 ===
    function createMobileCopyEffect(button) {
        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: fixed;
                left: ${centerX}px;
                top: ${centerY}px;
                width: 6px;
                height: 6px;
                background: #3EB489;
                border-radius: 50%;
                pointer-events: none;
                z-index: 9999;
                transition: all 1s cubic-bezier(0.4, 0, 0.2, 1);
            `;
            
            document.body.appendChild(particle);
            
            setTimeout(() => {
                const angle = (i / 8) * Math.PI * 2;
                const distance = 50;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                
                particle.style.transform = `translate(${x}px, ${y}px) scale(0)`;
                particle.style.opacity = '0';
            }, 10);
            
            setTimeout(() => {
                document.body.removeChild(particle);
            }, 1000);
        }
    }

    // === 모바일 카운터 애니메이션 ===
    function animateMobileCounter(element) {
        const text = element.textContent;
        const targetNumber = parseInt(text.replace(/[^\d]/g, ''));
        
        if (targetNumber > 0) {
            let currentNumber = 0;
            const increment = targetNumber / 30; // 30프레임으로 나누어 애니메이션
            const timer = setInterval(() => {
                currentNumber += increment;
                if (currentNumber >= targetNumber) {
                    currentNumber = targetNumber;
                    clearInterval(timer);
                }
                
                if (text.includes('₩')) {
                    element.textContent = `₩${Math.floor(currentNumber).toLocaleString()}`;
                } else {
                    element.textContent = Math.floor(currentNumber).toLocaleString();
                }
            }, 50);
        }
    }

    // === 모바일 수익 섹션 애니메이션 ===
    function setupMobileRevenueAnimations() {
        const revenueSection = document.querySelector('.mobile-revenue-section');
        if (!revenueSection) return;

        // 수익 금액 카운트업 애니메이션
        const revenueAmounts = document.querySelectorAll('.mobile-revenue-amount');
        const vsAmounts = document.querySelectorAll('.mobile-vs-amount');
        
        const revenueObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateRevenueNumber(entry.target);
                    revenueObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        // 수익 금액들에 관찰자 설정
        revenueAmounts.forEach(amount => revenueObserver.observe(amount));
        vsAmounts.forEach(amount => revenueObserver.observe(amount));

        // 비교 카드 순차 등장 애니메이션
        const comparisonCards = document.querySelectorAll('.mobile-comparison-card, .mobile-vs-card');
        comparisonCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        });

        const cardObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const cardIndex = Array.from(comparisonCards).indexOf(entry.target);
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, cardIndex * 200);
                    cardObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });

        comparisonCards.forEach(card => cardObserver.observe(card));

        // 혜택 카드 그리드 애니메이션
        const benefitCards = document.querySelectorAll('.mobile-benefit-card');
        benefitCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px) scale(0.9)';
            card.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        });

        const benefitObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const cardIndex = Array.from(benefitCards).indexOf(entry.target);
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0) scale(1)';
                    }, cardIndex * 100);
                    benefitObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        benefitCards.forEach(card => benefitObserver.observe(card));

        // 카드 호버 효과 (터치 디바이스에서는 탭)
        setupMobileCardTouchInteractions();
    }

    // === 수익 숫자 카운트업 애니메이션 ===
    function animateRevenueNumber(element) {
        const text = element.textContent;
        const isKoreanWon = text.includes('₩');
        const isPercentage = text.includes('%');
        const targetNumber = parseInt(text.replace(/[^\d]/g, ''));
        
        if (targetNumber > 0) {
            let currentNumber = 0;
            const duration = 2000; // 2초
            const increment = targetNumber / (duration / 50); // 50ms 간격으로 업데이트
            
            const timer = setInterval(() => {
                currentNumber += increment;
                if (currentNumber >= targetNumber) {
                    currentNumber = targetNumber;
                    clearInterval(timer);
                }
                
                if (isKoreanWon) {
                    if (text.includes('+')) {
                        element.textContent = `+₩${Math.floor(currentNumber).toLocaleString()}`;
                    } else {
                        element.textContent = `₩${Math.floor(currentNumber).toLocaleString()}`;
                    }
                } else if (isPercentage) {
                    element.textContent = `${Math.floor(currentNumber)}% 증가`;
                } else if (text.includes('만원')) {
                    element.textContent = `월 ${Math.floor(currentNumber)}만원+`;
                } else {
                    element.textContent = Math.floor(currentNumber).toLocaleString();
                }
            }, 50);
        }
    }

    // === 모바일 카드 터치 인터랙션 ===
    function setupMobileCardTouchInteractions() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        if (isTouchDevice) {
            const interactiveCards = document.querySelectorAll('.mobile-comparison-card, .mobile-benefit-card');
            
            interactiveCards.forEach(card => {
                card.addEventListener('touchstart', function() {
                    this.style.transform = 'translateY(-2px) scale(0.98)';
                }, { passive: true });
                
                card.addEventListener('touchend', function() {
                    setTimeout(() => {
                        this.style.transform = 'translateY(-4px)';
                    }, 100);
                }, { passive: true });
            });
        }
    }
    
    // === 음원 미리보기 섹션 초기화 기능 제거 ===
    // Firestore 로딩 제거 - 정적 HTML 카드만 사용하여 오디오 재생 오류 해결
    
    // === Firestore 브랜드 트랙 로드 기능 제거 ===
    // Firestore 로딩 제거 - 정적 HTML 카드만 사용하여 성능 향상 및 오류 해결
    
    // === 브랜드 트랙 카드 렌더링 기능 제거 ===
    // Firestore 로딩 제거 - 정적 HTML 카드만 사용
    
    // === 음원 미리보기 섹션 애니메이션 ===
    function setupPreviewSectionAnimations() {
        // 트랙 카드들의 순차적 등장 애니메이션
        const trackCards = document.querySelectorAll('.track-card[data-track]');
        
        // 초기 상태 설정
        trackCards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(40px) scale(0.9)';
            card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        });
        
        // IntersectionObserver로 등장 애니메이션
        const trackObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const trackIndex = parseInt(entry.target.getAttribute('data-track'));
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0) scale(1)';
                    }, trackIndex * 200); // 각 카드마다 200ms 지연
                    trackObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });
        
        trackCards.forEach(card => trackObserver.observe(card));
        
        // 웨이브폼 SVG 애니메이션
        setupWaveformAnimations();
        
        // 재생 버튼 인터랙션
        setupPlayButtonInteractions();
        
        // Copy CID 버튼 효과
        setupCopyCIDEffects();
    }
    
    // 웨이브폼 그리기 애니메이션
    function setupWaveformAnimations() {
        const waveformPaths = document.querySelectorAll('.waveform-svg path');
        
        waveformPaths.forEach(path => {
            const pathLength = path.getTotalLength();
            path.style.strokeDasharray = pathLength;
            path.style.strokeDashoffset = pathLength;
            path.style.transition = 'stroke-dashoffset 2s ease-out, filter 0.3s ease';
        });
        
        const waveformObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const paths = entry.target.querySelectorAll('path');
                    paths.forEach((path, index) => {
                        setTimeout(() => {
                            path.style.strokeDashoffset = '0';
                        }, index * 300);
                    });
                    waveformObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        
        document.querySelectorAll('.track-card').forEach(card => {
            waveformObserver.observe(card);
        });
    }
    
    // === 전역 재생 시뮬레이션 변수 ===
    let currentPlayButton = null;
    let currentSimulationTimer = null;
    
    // 재생 버튼 인터랙션 (시뮬레이션 모드)
    function setupPlayButtonInteractions() {
        console.log('[Brand] 🎵 재생 시뮬레이션 모드로 설정됨');
        
        // 이벤트 위임을 사용하여 동적으로 생성된 버튼도 처리
        document.addEventListener('click', function(e) {
            const playButton = e.target.closest('.track-play-btn');
            if (!playButton) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            // 현재 재생 중인 다른 버튼이 있으면 정지
            if (currentPlayButton && currentPlayButton !== playButton) {
                resetPlayButton(currentPlayButton);
                if (currentSimulationTimer) {
                    clearTimeout(currentSimulationTimer);
                }
            }
            
            // 같은 버튼을 다시 클릭한 경우 정지
            if (currentPlayButton === playButton) {
                resetPlayButton(playButton);
                if (currentSimulationTimer) {
                    clearTimeout(currentSimulationTimer);
                }
                currentPlayButton = null;
                currentSimulationTimer = null;
                return;
            }
            
            // 재생 시뮬레이션 시작
            simulateAudioPlayback(playButton);
        });
    }
    
    // 재생 시뮬레이션 함수 (실제 오디오 파일 없이 UI만 변경)
    function simulateAudioPlayback(playButton) {
        const trackName = playButton.closest('.track-card').querySelector('.track-name')?.textContent || '음원';
        console.log(`[Brand] 🎵 "${trackName}" 재생 시뮬레이션 시작`);
        
        currentPlayButton = playButton;
        setPlayingState(playButton, true);
        
        // 30초 후 자동 정지 (실제 트랙 길이 시뮬레이션)
        currentSimulationTimer = setTimeout(() => {
            console.log(`[Brand] 🎵 "${trackName}" 재생 시뮬레이션 완료`);
            if (currentPlayButton === playButton) {
                resetPlayButton(playButton);
                currentPlayButton = null;
                currentSimulationTimer = null;
            }
        }, 30000); // 30초
    }
    
    // 시뮬레이션 모드 - 오디오 관련 함수들 제거됨
    // 실제 오디오 파일 없이 UI 시뮬레이션만 사용
    
    // 재생 상태 설정
    function setPlayingState(playButton, isPlaying) {
        const svg = playButton.querySelector('svg');
        const trackCard = playButton.closest('.track-card');
        const waveformPath = trackCard?.querySelector('.waveform-svg path');
        
        if (isPlaying) {
            playButton.classList.add('playing');
            trackCard?.classList.add('playing');
            
            // 일시정지 아이콘으로 변경
            if (svg) {
                svg.innerHTML = `
                    <rect x="4" y="2" width="4" height="14" fill="currentColor"/>
                    <rect x="10" y="2" width="4" height="14" fill="currentColor"/>
                `;
            }
            
            // 웨이브폼 애니메이션 시작
            if (waveformPath) {
                waveformPath.style.animation = 'waveformPulse 1.5s ease-in-out infinite';
            }
        } else {
            playButton.classList.remove('playing');
            trackCard?.classList.remove('playing');
            
            // 재생 아이콘으로 복원
            if (svg) {
                svg.innerHTML = `
                    <path d="M15 7.26795C16.3333 8.03775 16.3333 9.96225 15 10.7321L3 17.3301C1.66667 18.0999 0 17.1377 0 15.598L0 2.40192C0 0.862305 1.66667 -0.0999451 3 0.669855L15 7.26795Z" fill="currentColor"/>
                `;
            }
            
            // 웨이브폼 애니메이션 정지
            if (waveformPath) {
                waveformPath.style.animation = 'none';
            }
        }
        
        // 클릭 피드백 애니메이션
        playButton.style.transform = 'scale(0.9)';
        setTimeout(() => {
            playButton.style.transform = '';
        }, 150);
    }
    
    // 재생 버튼 리셋
    function resetPlayButton(playButton) {
        if (!playButton) return;
        setPlayingState(playButton, false);
    }
    
    // Copy CID 버튼 효과 (이벤트 위임 사용)
    function setupCopyCIDEffects() {
        // 이벤트 위임을 사용하여 동적으로 생성된 버튼도 처리
        document.addEventListener('click', function(e) {
            const copyButton = e.target.closest('.copy-cid-btn');
            if (!copyButton) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const cid = copyButton.getAttribute('data-cid') || copyButton.textContent.replace('Copy CID', '').trim();
            const originalText = copyButton.textContent;
            
            // 클립보드에 복사
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(cid).then(() => {
                    showCopySuccess(copyButton, originalText);
                }).catch(err => {
                    console.error('[Brand] 클립보드 복사 실패:', err);
                    fallbackCopyTextToClipboard(cid, copyButton, originalText);
                });
            } else {
                // 폴백 방식
                fallbackCopyTextToClipboard(cid, copyButton, originalText);
            }
        });
    }
    
    // 클립보드 복사 폴백 함수
    function fallbackCopyTextToClipboard(text, button, originalText) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showCopySuccess(button, originalText);
            } else {
                console.error('[Brand] 폴백 복사 실패');
            }
        } catch (err) {
            console.error('[Brand] 폴백 복사 오류:', err);
        }
        
        document.body.removeChild(textArea);
    }
    
    // 복사 성공 시 UI 업데이트
    function showCopySuccess(button, originalText) {
        // 클릭 애니메이션
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = '';
        }, 100);
        
        // 성공 메시지 표시
        button.textContent = 'Copied!';
        button.style.background = 'rgba(62, 180, 137, 0.3)';
        button.style.color = '#fff';
        
        // 성공 효과 (파티클 같은 효과)
        createCopySuccessEffect(button);
        
        // 2초 후 원래 상태로 복원
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
            button.style.color = '';
        }, 2000);
    }
    
    // Copy 성공 시 파티클 효과
    function createCopySuccessEffect(button) {
        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        for (let i = 0; i < 6; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'fixed';
            particle.style.left = centerX + 'px';
            particle.style.top = centerY + 'px';
            particle.style.width = '4px';
            particle.style.height = '4px';
            particle.style.background = '#3EB489';
            particle.style.borderRadius = '50%';
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '9999';
            particle.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
            
            document.body.appendChild(particle);
            
            setTimeout(() => {
                const angle = (i / 6) * Math.PI * 2;
                const distance = 40;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                
                particle.style.transform = `translate(${x}px, ${y}px)`;
                particle.style.opacity = '0';
                particle.style.transform += ' scale(0)';
            }, 10);
            
            setTimeout(() => {
                document.body.removeChild(particle);
            }, 800);
        }
    }



    // 언어 변경 시 차트 업데이트 함수
    function updateChartForLanguageChange() {
        const chartCanvas = document.getElementById('totalRevenueChart');
        if (chartCanvas) {
            // 기존 차트 제거
            const existingChart = Chart.getChart(chartCanvas);
            if (existingChart) {
                existingChart.destroy();
            }
            
            // 새로운 언어로 차트 재생성
            setTimeout(() => {
                renderTotalRevenueChart();
            }, 100);
        }
    }

    // 언어 변경 이벤트 리스너 등록
    const languageOptions = document.querySelectorAll('.language-option');
    languageOptions.forEach(option => {
        option.addEventListener('click', function() {
            setTimeout(updateChartForLanguageChange, 200);
        });
    });

    // 모든 애니메이션 설정 실행
    setupInsightsAnimations();
    setupFeatureCardsAnimation();
    setupFlowAnimation();
    renderTotalRevenueChart();
    animateFeatureIcons();
    animateDashboardCounters();
    animateFlowSteps();
    
    // 모바일 관련 애니메이션 및 인터랙션
    setupMobileFlowInteraction();
    setupMobileCardInteractions();
    setupMobileRevenueAnimations();
    setupMobileCardTouchInteractions();

    // ===== 섹션 등장 애니메이션 (IntersectionObserver) =====
    let animatedSections = document.querySelectorAll('[data-animate]');
    const sectionObserver = new window.IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const type = entry.target.getAttribute('data-animate');
          console.log('섹션 등장:', entry.target, type); // 진입 로그
          if (type === 'fade-up') {
            entry.target.classList.add('animate-fade-up');
          } else if (type === 'fade-in') {
            entry.target.classList.add('animate-fade-in');
          }
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01 });
    animatedSections.forEach(section => sectionObserver.observe(section));
    // 혹시라도 동적 삽입된 섹션이 있다면 재탐색
    setTimeout(() => {
      animatedSections = document.querySelectorAll('[data-animate]:not(.animate-fade-up):not(.animate-fade-in)');
      animatedSections.forEach(section => sectionObserver.observe(section));
    }, 500);
}); 