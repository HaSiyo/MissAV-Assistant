// ==UserScript==
// @name               MissAV Assistant
// @description        Effectively blocks all intrusive ads, pop-ups, and trackers. Enhances your viewing experience by enabling seamless background playback.
// @run-at             document-start
// @grant              unsafeWindow
// @match              https://missav123.com/*
// @match              https://missav.ws/*
// @match              https://missav.live/*
// @match              https://missav.ai/*
// @match              https://missav.com/*
// @match              https://thisav.com/*
// @match              *://missav.fans/*
// @match              *://missav.media/*
// @version            1.0.8
// ==/UserScript==

const url = window.location.href;
if (/^https:\/\/(missav|thisav)\.com/.test(url)) {
    window.location.replace(url.replace('missav.com', 'missav.live').replace('thisav.com', 'missav.live'));
}

(() => {
    'use strict';

    // --- 1. 초고속 CSS 차단 (광고가 렌더링되기 전에 숨김) ---
    const injectAdBlockCSS = () => {
        const style = document.createElement('style');
        style.textContent = `
            /* 광고 및 불필요한 요소 차단 */
            div.fixed.right-2.bottom-2,
            div[class*="fixed"][class*="right-"][class*="bottom-"],
            div[class^="root"],
            .ts-outstream-video,
            iframe[src*="rallytrck"],
            iframe[src*="myavlive"],
            img[src*="partwithner"],
            img[alt="MissAV takeover Fanza"],
            ul.mb-4.list-none.text-nord14,
            .prose,
            #html-ads,
            div.flex.flex-wrap.justify-center.space-x-4.md\\:space-x-6.py-8.rounded-md.shadow-sm,
            #download-option-menu-button {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
                width: 0 !important;
                height: 0 !important;
                opacity: 0 !important;
            }

            /* UI 레이아웃 교정: 버튼 그룹 차단으로 인해 사라진 제목 아래 여백 복구 */
            h1.text-nord6 {
                margin-bottom: 2rem !important;
                line-height: 1.5 !important;
            }
        `;
        if (document.documentElement) {
            document.documentElement.appendChild(style);
        } else {
            const timer = setInterval(() => {
                if (document.documentElement) {
                    clearInterval(timer);
                    document.documentElement.appendChild(style);
                }
            }, 5);
        }
    };
    injectAdBlockCSS();

    // --- 2. 스크립트 주입 원천 차단 (애드가드 호환성 강화) ---
    const originalCreateElement = document.createElement;
    document.createElement = function (tagName, options) {
        const el = originalCreateElement.call(document, tagName, options);
        if (typeof tagName === 'string') {
            const tag = tagName.toLowerCase();
            if (tag === 'script' || tag === 'iframe') {
                Object.defineProperty(el, 'src', {
                    set: function (val) {
                        // 기존 차단 + tracker 및 p2p 규칙 추가
                        if (val && /myavlive|rallytrck|partwithner|tracker\.|[\/\?]p2p[\/\?]?/i.test(val)) {
                            return; // 네트워크 요청 차단
                        }
                        this.setAttribute('src', val);
                    },
                    get: function () {
                        return this.getAttribute('src');
                    }
                });
            }
        }
        return el;
    };

    // --- 2.5. P2P 및 트래커 네트워크 요청 가로채기 (||tracker.^[block], ||*^/p2p^[block] 호환) ---
    const isNetworkBlocked = (url) => {
        if (!url) return false;
        // tracker. 및 /p2p 규칙 필터링
        return /tracker\.|[\/\?]p2p[\/\?]?/i.test(String(url));
    };

    // fetch 차단
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const reqUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url);
        if (isNetworkBlocked(reqUrl)) {
            return new Response(null, { status: 403, statusText: 'Blocked by Rule' });
        }
        return originalFetch.apply(this, args);
    };

    // XMLHttpRequest 차단
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        if (isNetworkBlocked(url)) return; 
        return originalXhrOpen.call(this, method, url, ...rest);
    };

    // WebSocket 차단 (P2P 통신 방지)
    if (typeof window.WebSocket !== 'undefined') {
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
            if (isNetworkBlocked(url)) {
                // 더미 주소로 연결을 강제 실패시켜 광고차단기와 동일한 효과 구현
                return new OriginalWebSocket('ws://127.0.0.1:65535');
            }
            return new OriginalWebSocket(url, protocols);
        };
        window.WebSocket.prototype = OriginalWebSocket.prototype;
    }

    // --- 3. 백그라운드 재생 로직 1 (플레이어 이벤트 덮어쓰기) ---
    const handlePlayer = () => {
        const player = document.querySelector('video.player');
        if (!player) return;

        let windowIsBlurred = false;
        window.onblur = () => { windowIsBlurred = true; };
        window.onfocus = () => { windowIsBlurred = false; };

        player.onpause = () => {
            if (windowIsBlurred) {
                // 플레이어 재생 실패 시 에러 방지 처리 추가
                player.play().catch(() => {});
            }
        };
    };

    const checkPlayer = setInterval(() => {
        if (document.querySelector('video.player')) {
            clearInterval(checkPlayer);
            handlePlayer();
        }
    }, 200);

    setTimeout(() => clearInterval(checkPlayer), 10000);

    // --- 4. DOM 요소 실시간 청소 ---
    const removeAdElements = () => {
        const selectors = [
            'div[class^="root"]',
            'div[class*="fixed"][class*="right-"][class*="bottom-"]',
            'div[class*="pt-"][class*="pb-"][class*="px-"]:not([class*="sm:"])',
            'div[class*="lg:hidden"]',
            'div[class*="lg:block"]',
            'div.ts-outstream-video',
            'iframe[src*="rallytrck"]',
            'ul.mb-4.list-none.text-nord14',
            '.prose',
            '#html-ads'
        ];
        
        selectors.forEach(selector => {
            const els = document.querySelectorAll(selector);
            // 애드가드 파서 오류 방지를 위해 for문 사용
            for (let i = 0; i < els.length; i++) {
                const el = els[i];
                if (el.tagName.toLowerCase() === 'iframe' || /fixed|root|ts-outstream/.test(el.className) || el.id === 'html-ads') {
                    el.remove();
                } else {
                    el.style.setProperty('display', 'none', 'important');
                }
            }
        });
    };

    const observer = new MutationObserver(() => {
        removeAdElements();
    });
    
    if (document.documentElement) {
        observer.observe(document.documentElement, { childList: true, subtree: true });
    } else {
        const observerStart = function() {
            observer.observe(document.documentElement, { childList: true, subtree: true });
            document.removeEventListener('DOMNodeInserted', observerStart);
        };
        document.addEventListener('DOMNodeInserted', observerStart);
    }

    // --- 5. 팝업창(새 창) 차단 ---
    try {
        if (typeof unsafeWindow !== 'undefined') {
            unsafeWindow.open = () => null;
        } else {
            window.open = () => null;
        }
    } catch (e) {}

    // --- 6. 백그라운드 재생 로직 2 (포커스 상실 시 일시정지 방지) ---
    document.addEventListener('DOMContentLoaded', () => {
        try {
            const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
            if (win.player && win.player.pause) {
                const originalPause = win.player.pause;
                win.player.pause = () => {
                    if (document.hasFocus()) {
                        originalPause.call(win.player);
                    }
                };
            }
        } catch (e) {}
    });

})();
