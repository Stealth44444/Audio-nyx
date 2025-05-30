document.addEventListener('DOMContentLoaded', function() {
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
    
    // 네비게이션 메뉴 활성화 실행
    activateCurrentPageNavItem();
    

    
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

        // 레이블에 증가 금액 추가
        const labelsWithIncrease = [
            `100만\n+₩${increasedAmounts[0].toLocaleString()}`,
            `300만\n+₩${increasedAmounts[1].toLocaleString()}`,
            `500만\n+₩${increasedAmounts[2].toLocaleString()}`,
            `700만\n+₩${increasedAmounts[3].toLocaleString()}`,
            `1000만\n+₩${increasedAmounts[4].toLocaleString()}`,
            `3000만\n+₩${increasedAmounts[5].toLocaleString()}`,
            `5000만\n+₩${increasedAmounts[6].toLocaleString()}`
        ];

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['100만','300만','500만','700만','1000만','3000만','5000만'],
                datasets: [
                    {
                        label: 'Audionyx 사용',
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
                        label: 'Audionyx 미사용',
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
                                return `${label}: ₩${value.toLocaleString()}`;
                            },
                            afterBody: function(tooltipItems) {
                                if (tooltipItems.length === 2) {
                                    const audionyxValue = tooltipItems.find(item => item.dataset.label === 'Audionyx 사용')?.parsed.y || 0;
                                    const baseValue = tooltipItems.find(item => item.dataset.label === 'Audionyx 미사용')?.parsed.y || 0;
                                    const difference = audionyxValue - baseValue;
                                    const increaseRate = baseValue > 0 ? ((difference / baseValue) * 100).toFixed(1) : 0;
                                    
                                    return [
                                        '',
                                        `차이 금액: +₩${difference.toLocaleString()}`,
                                        `증가율: +${increaseRate}%`
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
                                return '₩' + value.toLocaleString();
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
                    onComplete: function() {
                        // 애니메이션 완료 후 커스텀 텍스트 그리기
                        const chart = this;
                        const ctx = chart.ctx;
                        const xAxis = chart.scales.x;
                        
                        // 증가 금액을 다른 색상으로 표시
                        ctx.save();
                        ctx.fillStyle = '#3EB489';
                        ctx.font = 'bold 11px Arial';
                        ctx.textAlign = 'center';
                        
                        xAxis.ticks.forEach((tick, index) => {
                            const x = xAxis.getPixelForTick(index);
                            const y = xAxis.bottom + 25;
                            const increaseAmount = increasedAmounts[index];
                            ctx.fillText(`+₩${increaseAmount.toLocaleString()}`, x, y);
                        });
                        
                        ctx.restore();
                    }
                }
            },
            plugins: [{
                id: 'customText',
                afterDraw: function(chart) {
                    const ctx = chart.ctx;
                    const xAxis = chart.scales.x;
                    
                    // 증가 금액을 다른 색상으로 표시
                    ctx.save();
                    ctx.fillStyle = '#3EB489';
                    ctx.font = 'bold 11px Arial';
                    ctx.textAlign = 'center';
                    
                    xAxis.ticks.forEach((tick, index) => {
                        const x = xAxis.getPixelForTick(index);
                        const y = xAxis.bottom + 25;
                        const increaseAmount = increasedAmounts[index];
                        ctx.fillText(`+₩${increaseAmount.toLocaleString()}`, x, y);
                    });
                    
                    ctx.restore();
                }
            }]
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
    
    // 재생 버튼 인터랙션
    function setupPlayButtonInteractions() {
        const playButtons = document.querySelectorAll('.track-play-btn');
        
        playButtons.forEach(button => {
            let isPlaying = false;
            
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const svg = this.querySelector('svg');
                
                if (!isPlaying) {
                    // 재생 상태로 변경
                    isPlaying = true;
                    this.classList.add('playing');
                    
                    // 일시정지 아이콘으로 변경
                    svg.innerHTML = `
                        <rect x="4" y="2" width="4" height="14" fill="currentColor"/>
                        <rect x="10" y="2" width="4" height="14" fill="currentColor"/>
                    `;
                    
                    // 웨이브폼 애니메이션 시작
                    const trackCard = this.closest('.track-card');
                    const waveformPath = trackCard.querySelector('.waveform-svg path');
                    if (waveformPath) {
                        waveformPath.style.animation = 'waveformPulse 1.5s ease-in-out infinite';
                    }
                    
                    // 3초 후 자동으로 일시정지
                    setTimeout(() => {
                        if (isPlaying) {
                            button.click();
                        }
                    }, 3000);
                    
                } else {
                    // 일시정지 상태로 변경
                    isPlaying = false;
                    this.classList.remove('playing');
                    
                    // 재생 아이콘으로 복원
                    svg.innerHTML = `
                        <path d="M15 7.26795C16.3333 8.03775 16.3333 9.96225 15 10.7321L3 17.3301C1.66667 18.0999 0 17.1377 0 15.598L0 2.40192C0 0.862305 1.66667 -0.0999451 3 0.669855L15 7.26795Z" fill="currentColor"/>
                    `;
                    
                    // 웨이브폼 애니메이션 정지
                    const trackCard = this.closest('.track-card');
                    const waveformPath = trackCard.querySelector('.waveform-svg path');
                    if (waveformPath) {
                        waveformPath.style.animation = 'none';
                    }
                }
                
                // 클릭 피드백 애니메이션
                this.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
            });
        });
    }
    
    // Copy CID 버튼 효과
    function setupCopyCIDEffects() {
        const copyCIDButtons = document.querySelectorAll('.copy-cid-btn');
        
        copyCIDButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const originalText = this.textContent;
                
                // 클릭 애니메이션
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 100);
                
                // 성공 메시지 표시
                this.textContent = 'Copied!';
                this.style.background = 'rgba(62, 180, 137, 0.3)';
                this.style.color = '#fff';
                
                // 성공 효과 (파티클 같은 효과)
                createCopySuccessEffect(this);
                
                // 2초 후 원래 상태로 복원
                setTimeout(() => {
                    this.textContent = originalText;
                    this.style.background = '';
                    this.style.color = '';
                }, 2000);
            });
        });
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

    // 모든 애니메이션 설정 실행
    setupInsightsAnimations();
    setupFeatureCardsAnimation();
    setupFlowAnimation();
    renderTotalRevenueChart();
    animateFeatureIcons();
    animateDashboardCounters();
    animateFlowSteps();
    setupPreviewSectionAnimations();

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