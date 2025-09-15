// 전역 입력 필드 활성화 스크립트
console.log("[main.js] 전역 입력 필드 활성화 스크립트 시작");

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    console.log("[main.js] DOM 로드 완료, 입력 필드 활성화 시작");
    
    // 모든 input 필드 활성화
    function enableAllInputs() {
        const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="tel"], input[type="search"], input[type="number"], input:not([type])');
        
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
    
    // 공지 모달 (2025-09-15) 지속 표기 로직: '다시 보지 않기' 전까지 표시
    try {
        const NOTICE_KEY = 'notice_20250915_dismissed_v2';
        const modal = document.getElementById('notice-modal-20250915');
        const btnClose = document.getElementById('notice-modal-close-20250915');
        const btnDismiss = document.getElementById('notice-modal-dismiss-20250915');
        const cta = document.getElementById('notice-modal-cta-20250915');
        
        if (modal && !localStorage.getItem(NOTICE_KEY)) {
            // 메인 진입 시마다 노출 (닫더라도 재방문 시 다시 표시)
            modal.style.display = 'flex';
            document.body.classList.add('no-scroll');
            requestAnimationFrame(() => modal.classList.add('show'));
        }
        
        function hideNoticeModal() {
            if (!modal) return;
            modal.classList.remove('show');
            setTimeout(() => { 
                modal.style.display = 'none'; 
                document.body.classList.remove('no-scroll');
            }, 200);
        }
        
        if (btnClose) {
            btnClose.addEventListener('click', () => hideNoticeModal());
        }
        
        if (btnDismiss) {
            btnDismiss.addEventListener('click', () => {
                localStorage.setItem(NOTICE_KEY, '1');
                hideNoticeModal();
            });
        }
        // CTA 클릭 시에는 해제 키를 저장하지 않음 (지속 표시)
        
        // 오버레이 클릭으로 닫기
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) hideNoticeModal();
            });
        }
    } catch (e) {
        console.warn('[main.js] 공지 모달 초기화 중 오류', e);
    }
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