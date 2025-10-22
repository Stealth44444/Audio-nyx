// === 비디오 자동재생 처리 (모바일 지원) ===
function initVideoAutoplay() {
    const video = document.querySelector('.hero-video-background video');
    if (!video) return;
    
    // 비디오 로드 후 재생 시도
    video.addEventListener('loadeddata', function() {
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('[Video] 자동재생 성공');
            }).catch(error => {
                console.log('[Video] 자동재생 실패, 사용자 인터랙션 대기:', error);
                
                // 모바일에서 자동재생 실패 시 첫 터치/클릭으로 재생
                const playOnInteraction = () => {
                    video.play().then(() => {
                        console.log('[Video] 사용자 인터랙션으로 재생 성공');
                    }).catch(err => {
                        console.log('[Video] 재생 실패:', err);
                    });
                    document.removeEventListener('touchstart', playOnInteraction);
                    document.removeEventListener('click', playOnInteraction);
                };
                
                document.addEventListener('touchstart', playOnInteraction, { once: true });
                document.addEventListener('click', playOnInteraction, { once: true });
            });
        }
    });
    
    // 비디오가 이미 로드된 경우
    if (video.readyState >= 3) {
        video.play().catch(error => {
            console.log('[Video] 초기 재생 실패:', error);
        });
    }
}

// 전역 입력 필드 활성화 스크립트
console.log("[main.js] 전역 입력 필드 활성화 스크립트 시작");

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    console.log("[main.js] DOM 로드 완료, 입력 필드 활성화 시작");
    
    // 비디오 자동재생 초기화
    initVideoAutoplay();
    
    // 모든 input 및 textarea 필드 활성화
    function enableAllInputs() {
        const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="tel"], input[type="search"], input[type="number"], input:not([type]), textarea, select');
        
        console.log(`[main.js] 발견된 입력 필드 수: ${inputs.length}`);
        
        inputs.forEach((input, index) => {
            // 모든 차단 속성 제거
            input.disabled = false;
            input.readOnly = false;
            input.removeAttribute('disabled');
            input.removeAttribute('readonly');
            
            // 스타일 강제 적용
            input.style.setProperty('pointer-events', 'auto', 'important');
            input.style.setProperty('user-select', 'text', 'important');
            input.style.setProperty('-webkit-user-select', 'text', 'important');
            input.style.setProperty('-moz-user-select', 'text', 'important');
            input.style.setProperty('-ms-user-select', 'text', 'important');
            input.style.setProperty('cursor', 'text', 'important');
            input.tabIndex = 0;
            
            // 테스트 이벤트 리스너 추가
            if (!input.hasAttribute('data-main-js-enabled')) {
                input.setAttribute('data-main-js-enabled', 'true');
                
                input.addEventListener('focus', function() {
                    console.log(`[main.js] 입력 필드 ${index + 1} 포커스됨:`, input);
                });
                
                input.addEventListener('input', function() {
                    console.log(`[main.js] 입력 필드 ${index + 1} 입력 감지:`, input.value);
                });
                
                input.addEventListener('click', function(e) {
                    e.stopPropagation();
                    this.focus();
                    console.log(`[main.js] 입력 필드 ${index + 1} 클릭됨`);
                });
            }
        });
    }
    
    // 즉시 실행
    enableAllInputs();
    
    // 지연 실행 (다른 스크립트가 나중에 입력을 차단할 수 있음)
    setTimeout(enableAllInputs, 500);
    setTimeout(enableAllInputs, 1000);
    setTimeout(enableAllInputs, 2000);
    
    // MutationObserver로 새로 추가되는 input 필드도 활성화
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    if (node.tagName === 'INPUT') {
                        console.log("[main.js] 새 input 필드 발견:", node);
                        enableAllInputs();
                    } else if (node.querySelectorAll) {
                        const newInputs = node.querySelectorAll('input');
                        if (newInputs.length > 0) {
                            console.log(`[main.js] 새로 추가된 ${newInputs.length}개의 input 필드 발견`);
                            enableAllInputs();
                        }
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log("[main.js] 전역 입력 필드 활성화 완료");
    
});

// 전역 테스트 함수 추가
window.testAllInputs = function() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="tel"], input[type="search"], input[type="number"], input:not([type])');
    console.log(`[main.js] 테스트: ${inputs.length}개의 입력 필드 발견`);
    
    inputs.forEach((input, index) => {
        try {
            input.value = `테스트 입력 ${index + 1}`;
            input.focus();
            console.log(`[main.js] 입력 필드 ${index + 1} 테스트 성공:`, input);
        } catch (error) {
            console.error(`[main.js] 입력 필드 ${index + 1} 테스트 실패:`, error);
        }
    });
}; 