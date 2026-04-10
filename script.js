window.switchPreviewTab = function(tabNum, btn) {
    if(tabNum === 1) {
        btn.parentElement.children[0].style.borderBottomColor='#111'; 
        btn.parentElement.children[0].style.fontWeight='700'; 
        btn.parentElement.children[0].style.color='#111'; 
        btn.parentElement.children[1].style.borderBottomColor='transparent'; 
        btn.parentElement.children[1].style.fontWeight='500'; 
        btn.parentElement.children[1].style.color='#9ca3af'; 
        document.getElementById('view-tab-1').style.display='block'; 
        document.getElementById('view-tab-2').style.display='none';
    } else {
        btn.parentElement.children[0].style.borderBottomColor='transparent'; 
        btn.parentElement.children[0].style.fontWeight='500'; 
        btn.parentElement.children[0].style.color='#9ca3af'; 
        btn.parentElement.children[1].style.borderBottomColor='#111'; 
        btn.parentElement.children[1].style.fontWeight='700'; 
        btn.parentElement.children[1].style.color='#111'; 
        document.getElementById('view-tab-1').style.display='none'; 
        document.getElementById('view-tab-2').style.display='block';
    }
    
    const target = document.getElementById('view-tab-' + tabNum);
    if (!target) return;
    const filler = target.querySelector('.smart-bottom-filler');
    const previewArea = document.querySelector('.preview-area');
    
    let tabsMenu = null;
    const allSticky = target.querySelectorAll('div');
    for (let i=0; i<allSticky.length; i++) {
        if (window.getComputedStyle(allSticky[i]).position === 'sticky') {
            tabsMenu = allSticky[i]; break;
        }
    }
    
    if (filler && tabsMenu && previewArea) {
        filler.style.height = '0px'; 
        const vh = previewArea.clientHeight;
        const diff = target.getBoundingClientRect().bottom - tabsMenu.getBoundingClientRect().bottom;
        if (diff < vh) {
            filler.style.height = (vh - diff) + 'px';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {

    const API_BASE = '/api/sync';

    const StorageDB = {
        init() {
            return Promise.resolve();
        },
        save(data) {
            return fetch(API_BASE + '?key=workspace_components', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data || [])
            }).then(res => res.json()).catch(err => { console.error('Sync Error', err); return Promise.resolve(); });
        },
        load() {
            return fetch(API_BASE + '?key=workspace_components', {
                headers: { 'Cache-Control': 'no-cache' }
            })
                .then(res => {
                    if(!res.ok) throw new Error("API not connected");
                    return res.json();
                })
                .catch(err => { 
                    console.error('Sync Error', err); 
                    // Fallback to local array just to avoid crashing if KV is missing
                    return null; 
                });
        },
        clear() {
            return fetch(API_BASE + '?key=workspace_components', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([])
            }).then(res => res.json()).catch(e=>e);
        }
    };

    const StorageTrash = {
        save(data) {
            return fetch(API_BASE + '?key=workspace_trash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data || [])
            }).then(res => res.json()).catch(err => { console.error('Sync Error', err); return Promise.resolve(); });
        },
        load() {
            return fetch(API_BASE + '?key=workspace_trash', {
                headers: { 'Cache-Control': 'no-cache' }
            })
                .then(res => {
                    if(!res.ok) throw new Error("API not connected");
                    return res.json();
                })
                .catch(err => { console.error('Sync Error', err); return []; });
        }
    };

    // --- Auto Migration from Old Local DB (IndexedDB -> KV) ---
    function executeLocalMigration() {
        try {
            const req = indexedDB.open('FusionBuilderDB', 1);
            req.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('workspace')) return;
                const tx = db.transaction('workspace', 'readwrite');
                const store = tx.objectStore('workspace');
                const getReq = store.get('components');
                getReq.onsuccess = (ev) => {
                    const localData = ev.target.result;
                    if (localData && Array.isArray(localData) && localData.length > 0) {
                        StorageDB.load().then(cloudData => {
                            const cloudList = cloudData || [];
                            const cloudIds = new Set(cloudList.map(x => x.id));
                            const uniqueLocal = localData.filter(x => !cloudIds.has(x.id));
                            
                            if (uniqueLocal.length > 0) {
                                const merged = cloudList.concat(uniqueLocal);
                                StorageDB.save(merged).then(() => {
                                    renderSidebarLibraryList(merged);
                                    if(typeof showToast === 'function') {
                                        showToast('내 컴퓨터에 있던 프로젝트가 Vercel KV로 이관되었습니다! ✨');
                                    }
                                    
                                    // SAFELY delete local ONLY after successful upload
                                    try {
                                        const req2 = indexedDB.open('FusionBuilderDB', 1);
                                        req2.onsuccess = (e2) => {
                                            const db2 = e2.target.result;
                                            const tx2 = db2.transaction('workspace', 'readwrite');
                                            tx2.objectStore('workspace').delete('components');
                                        };
                                    } catch(e) {}
                                });
                            } else {
                                // If already migrated, clean up local
                                try {
                                    const req2 = indexedDB.open('FusionBuilderDB', 1);
                                    req2.onsuccess = (e2) => {
                                        const db2 = e2.target.result;
                                        const tx2 = db2.transaction('workspace', 'readwrite');
                                        tx2.objectStore('workspace').delete('components');
                                    };
                                } catch(e) {}
                            }
                        });
                    }
                };
            };
        } catch(e) { console.warn("Migration skip"); }
    }

    function dataURItoBlobUrl(dataURI) {
        try {
            const byteString = atob(dataURI.split(',')[1]);
            const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], {type: mimeString});
            return URL.createObjectURL(blob);
        } catch(e) {
            return '';
        }
    }

    // --- State Management ---
    const generateId = () => 'comp_' + Math.random().toString(36).substr(2, 9);
    let componentsTab1 = [];
    let componentsTab2 = [];
    let activeTabId = 1;
    let components = componentsTab1;
    let currentThemeColor = '#27a8f5';
    const THEMES = ['#27a8f5', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#5CA8ED', '#EE7272', '#52C498', '#F29046', '#AD84F0'];

    function hexToRgba(hex, alpha) {
        let r=0, g=0, b=0;
        if(hex.startsWith('#')) hex = hex.slice(1);
        if(hex.length === 3){
            r = parseInt(hex[0]+hex[0], 16);
            g = parseInt(hex[1]+hex[1], 16);
            b = parseInt(hex[2]+hex[2], 16);
        }else if(hex.length === 6){
            r = parseInt(hex.substring(0,2), 16);
            g = parseInt(hex.substring(2,4), 16);
            b = parseInt(hex.substring(4,6), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function renderThemeSelector() {
        const container = document.getElementById('themeColorSelector');
        if(!container) return;
        container.innerHTML = '';
        THEMES.forEach(color => {
            const btn = document.createElement('button');
            btn.style.cssText = `width: 32px; height: 32px; border-radius: 50%; background-color: ${color}; border: 2px solid ${currentThemeColor === color ? '#111' : 'transparent'}; cursor: pointer; transition: all 0.2s; outline: ${currentThemeColor === color ? '2px solid white' : 'none'}; outline-offset: -4px; padding:0;`;
            btn.onclick = () => {
                currentThemeColor = color;
                renderThemeSelector();
                renderPreview();
            };
            container.appendChild(btn);
        });
        document.documentElement.style.setProperty('--theme-color', currentThemeColor);
    }

    function isPristineProject() {
        if (componentsTab2.length > 0) return false;
        if (componentsTab1.length !== 3) return false;
        if (componentsTab1[0].type !== 'video' || componentsTab1[0].data.url || componentsTab1[0].data.exportStr || componentsTab1[0].data.linkUrl) return false;
        if (componentsTab1[1].type !== 'title' || componentsTab1[1].data.mainTitle !== '메인타이틀') return false;
        if (componentsTab1[2].type !== 'explanation' || componentsTab1[2].data.title !== '메인문구' || componentsTab1[2].data.imageUrl) return false;
        return true;
    }

    const editorList = document.getElementById('editorComponentList');
    const previewBody = document.getElementById('previewCanvasBody');
    const addComponentBtn = document.getElementById('addComponentBtn');
    const addMenuPopup = document.getElementById('addMenuPopup');
    
    // --- Global Mute Toggle Logic ---
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.saved-item-actions')) {
            document.querySelectorAll('.lib-dropdown-menu').forEach(menu => {
                menu.style.display = 'none';
                const parentLi = menu.closest('.saved-item');
                if (parentLi) {
                    parentLi.style.zIndex = '';
                    parentLi.classList.remove('menu-open');
                }
            });
        }
        
        const muteBtn = e.target.closest('.mute-toggle-btn');
        if (muteBtn) {
            const container = muteBtn.parentElement.parentElement;
            const video = container.querySelector('video');
            if (video) {
                video.muted = !video.muted;
                if (video.muted) {
                    muteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
                } else {
                    muteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
                }
            }
        }

        const playableVideo = e.target.closest('.playable-video');
        const videoOverlay = e.target.closest('.video-overlay');
        
        if (playableVideo) {
            const container = playableVideo.parentElement;
            const overlay = container.querySelector('.video-overlay');
            if (overlay && !playableVideo.paused) {
                playableVideo.pause();
                overlay.style.display = 'flex';
            }
        } else if (videoOverlay) {
            const container = videoOverlay.parentElement;
            const video = container.querySelector('.playable-video');
            if (video && video.paused) {
                video.play();
                videoOverlay.style.display = 'none';
            }
        }
    });

    window.syncTabVisibility = function() {
        const hasTab2 = componentsTab2.length > 0;
        const createBtn = document.getElementById('editorTab2CreateBtn');
        const tab2Btn = document.getElementById('editorTab2Btn');
        const inputs = document.getElementById('tabNameInputsSettings');
        if (createBtn) createBtn.style.display = hasTab2 ? 'none' : 'block';
        if (tab2Btn) tab2Btn.style.display = hasTab2 ? 'flex' : 'none';
        if (inputs) inputs.style.display = hasTab2 ? 'flex' : 'none';
    };

    window.createSecondTab = function() {
        componentsTab2.push({
            id: generateId(),
            type: 'faq',
            data: { visible: true, question: '질문을 입력하세요', answer: '답변 내용을 입력하세요' }
        });
        window.syncTabVisibility();
        window.switchWorkspaceTab(2);
    };

    window.deleteSecondTab = function(e) {
        if(e) e.stopPropagation();
        if (confirm('두 번째 화면(FAQ) 탭을 삭제하시겠습니까? (추가한 FAQ 내용이 모두 지워집니다)')) {
            componentsTab2 = [];
            window.syncTabVisibility();
            window.switchWorkspaceTab(1);
        }
    };

    window.switchWorkspaceTab = function(tabId) {
        activeTabId = tabId;
        
        components = tabId === 1 ? componentsTab1 : componentsTab2;
        
        const tab1Btn = document.getElementById('editorTab1Btn');
        const tab2Btn = document.getElementById('editorTab2Btn');
        const tab1Menu = document.getElementById('tab1AddMenu');
        const tab2Menu = document.getElementById('tab2AddMenu');
        
        if (tabId === 1) {
            tab1Btn.style.fontWeight = '700';
            tab1Btn.style.color = '#111';
            tab1Btn.style.borderBottomColor = '#111';
            tab2Btn.style.fontWeight = '500';
            tab2Btn.style.color = '#9ca3af';
            tab2Btn.style.borderBottomColor = 'transparent';
            tab1Menu.style.display = 'block';
            tab2Menu.style.display = 'none';
        } else {
            tab1Btn.style.fontWeight = '500';
            tab1Btn.style.color = '#9ca3af';
            tab1Btn.style.borderBottomColor = 'transparent';
            tab2Btn.style.fontWeight = '700';
            tab2Btn.style.color = '#111';
            tab2Btn.style.borderBottomColor = '#111';
            tab1Menu.style.display = 'none';
            tab2Menu.style.display = 'block';
        }
        
        renderEditor();
        renderPreview();
        
        // Sync active Preview tab
        setTimeout(() => {
            const btns = document.querySelectorAll('.view-tab-btn');
            if (btns && btns.length === 2) {
                if (tabId === 1) btns[0].click();
                else btns[1].click();
            }
        }, 10);
    };

    // --- Utilities ---
    function getComponentLabel(c) {
        if (!c) return '알 수 없음';
        if (c.type === 'title') return `[타이틀] ${c.data.mainTitle || '제목 없음'}`;
        if (c.type === 'concept') return `[개념] ${c.data.title || c.data.mainTitle || '제목 없음'}`;
        if (c.type === 'explanation') return `[설명] ${c.data.mainTitle || '제목 없음'}`;
        if (c.type === 'notice') return `[유의사항]`;
        if (c.type === 'tabs') return `[탭] 네비게이션`;
        if (c.type === 'video') return `[영상]`;
        return `[블록]`;
    }

    // --- Render Editor ---
    function renderEditor() {
        editorList.innerHTML = '';
        
        components.forEach((comp, index) => {
            const block = document.createElement('div');
            block.className = 'component-block wrapper';
            block.dataset.id = comp.id;
            
            // Header
            const header = document.createElement('div');
            header.className = 'section-header';
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; margin-top: 24px;';
            if(index === 0) header.style.marginTop = '0';
            
            const titleMap = {
                'video': '영상 컴포넌트',
                'title': '타이틀 컴포넌트',
                'explanation': '설명 컴포넌트 (스텝/단독)',
                'tabs': '스크롤형 탭 내비게이션',
                'concept': '개념 컴포넌트',
                'tabDivider': '탭 영역(화면 분할) 지정선',
                'faq': 'FAQ (아코디언)',
                'notice': '유의사항'
            };
                            
            header.innerHTML = `
                <h3 style="margin: 0;">${titleMap[comp.type]}</h3>
                <div class="order-controls" style="display: flex; gap: 6px; align-items: center;">
                    <button class="order-btn move-up" title="위로" ${index === 0 ? 'disabled' : ''}>▲</button>
                    <button class="order-btn move-down" title="아래로" ${index === components.length - 1 ? 'disabled' : ''}>▼</button>
                    <button class="order-btn delete-btn" title="삭제" style="margin-left: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
            
            // Editor Card
            const card = document.createElement('div');
            card.className = 'card editor-card';
            card.style.marginBottom = '24px';
            
            if (comp.type === 'video') {
                card.innerHTML = `
                    <div class="form-group">
                        <label>Video 주소 입력 또는 파일 선택</label>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <input type="text" class="bind-txt" data-field="url" placeholder="https://... URL 주소 입력 (.mp4 권장)" style="width: 100%;">
                            <div class="file-upload-wrapper">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                <span class="file-upload-text" style="font-size: 13px; color: #4b5563; font-weight: 500;">내 컴퓨터에서 영상 업로드 (.mp4)</span>
                                <input type="file" class="video-file-input" accept="video/mp4,video/webm,video/ogg">
                            </div>
                            <p style="font-size: 11px; color: #059669; margin: 4px 0 0 0; display: none;" class="file-warning-msg">✅ 업로드된 파일은 HTML 추출 시 내부에 자동 변환 병합(Base64)되어 단독 파일로 동작하게 됩니다.</p>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>더보기 버튼 링크 (옵션)</label>
                        <input type="text" class="bind-txt" data-field="moreLink" placeholder="https:// (입력 시 더보기 버튼 생성)">
                    </div>
                `;
            } else if (comp.type === 'title') {
                const currentAlign = comp.data.align || 'left';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
                        <label style="margin: 0; padding-bottom: 4px;">텍스트 정렬 설정</label>
                        <div class="segmented-control align-toggle-control" style="background: white; border: 1px solid #d1d5db; padding: 2px;">
                            <button class="seg-btn ${currentAlign !== 'center' ? 'active' : ''}" data-val="left" style="font-size: 13px; padding: 6px 12px;">좌측</button>
                            <button class="seg-btn ${currentAlign === 'center' ? 'active' : ''}" data-val="center" style="font-size: 13px; padding: 6px 12px;">중앙</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>서브타이틀</label>
                        <textarea class="bind-area" data-field="subtitle" rows="2" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #d1d5db; font-size: 14px; color: #111; font-family: inherit; resize: vertical; outline: none;">${(comp.data.subtitle || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>메인타이틀 (줄바꿈: 엔터, 테마컬러 강조: *텍스트*)</label>
                        <textarea class="bind-area" data-field="mainTitle" rows="3" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #e5e7eb; font-size: 14px; color: #111; font-family: inherit; resize: vertical; outline: none;"></textarea>
                    </div>
                `;
            } else if (comp.type === 'explanation') {
                card.innerHTML = `
                    <div class="form-row two-cols">
                        <div class="form-group flex-row" style="align-items: center; justify-content: flex-start; gap: 12px;">
                            <label style="margin: 0;">스텝 표시</label>
                            <div class="segmented-control step-toggle-control">
                                <button class="seg-btn ${comp.data.isStep ? 'active' : ''}" data-val="true">ON</button>
                                <button class="seg-btn ${!comp.data.isStep ? 'active' : ''}" data-val="false">OFF</button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>스텝 번호</label>
                            <input type="text" class="bind-txt step-number-input" data-field="stepNumber" style="width: 80px;" ${comp.data.isStep ? '' : 'disabled'}>
                        </div>
                    </div>
                    <div class="form-group badge-settings-container" style="display: ${comp.data.isStep ? 'none' : 'block'}; margin-top: -4px; margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px;">단독형 정렬 및 뱃지 설정</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" class="bind-txt" data-field="badgeText" placeholder="뱃지 라벨명 (예: 첫번째)" style="flex: 1; border-radius: 8px; padding: 10px 14px; border: 1px solid #d1d5db; font-size: 14px;">
                            <div class="segmented-control badge-align-control" style="background: white; border: 1px solid #d1d5db; padding: 2px;">
                                <button class="seg-btn ${comp.data.badgeAlign !== 'left' ? 'active' : ''}" data-val="center">중앙</button>
                                <button class="seg-btn ${comp.data.badgeAlign === 'left' ? 'active' : ''}" data-val="left">좌측</button>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label style="display: block; margin-bottom: 6px;">메인타이틀</label>
                        <textarea class="bind-area" data-field="title" placeholder="메인타이틀 (<b>태그로 굵게 표기 가능)" rows="2" style="width: 100%; margin-bottom: 12px; border-radius: 8px; padding: 10px 14px; border: 1px solid #d1d5db; font-size: 14px; color: #111; font-family: inherit; resize: vertical; outline: none;">${(comp.data.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                        <label style="display: block; margin-bottom: 6px;">서브타이틀 (옵션)</label>
                        <textarea class="bind-area" data-field="subtitle" placeholder="메인타이틀 아래 작은 글씨로 표시됩니다" rows="2" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #d1d5db; font-size: 14px; color: #111; font-family: inherit; resize: vertical; outline: none;">${(comp.data.subtitle || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>이미지 주소 또는 파일 첨부 (옵션)</label>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div class="input-with-actions" style="display: flex; gap: 8px;">
                                <input type="text" class="bind-txt" data-field="imageUrl" placeholder="https://..." style="flex: 1;">
                            </div>
                            <div class="file-upload-wrapper exp-file-upload-wrapper">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                <span class="exp-file-upload-text" style="font-size: 13px; color: #4b5563; font-weight: 500;">내 컴퓨터에서 이미지 업로드 (.png, .jpg)</span>
                                <input type="file" class="exp-image-file-input" accept="image/png,image/jpeg,image/gif,image/webp">
                            </div>
                            <p style="font-size: 11px; color: #059669; margin: 4px 0 0 0; display: none;" class="exp-file-warning-msg">✅ 첨부된 이미지는 HTML 추출 시 내부에 코드 형태로 영구 병합됩니다.</p>
                        </div>
                    </div>
                    <div class="form-group bullet-list-group">
                        <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span>설명 항목</span>
                            <button class="action-btn add-bullet-btn" style="width: auto; padding: 4px 10px; font-size: 12px; height: auto; white-space: nowrap; flex-shrink: 0;" title="항목 추가">+ 추가</button>
                        </label>
                        <div class="bullet-inputs-container" style="display: flex; flex-direction: column; gap: 8px;">
                            ${(comp.data.bulletList || (comp.data.bullets ? comp.data.bullets.split('\n') : [''])).map((line) => `
                                <div class="bullet-input-row" style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 2px;">
                                    <div style="width: 4px; height: 4px; background-color: #A3A8B6; border-radius: 50%; flex-shrink: 0; margin: 15px 4px 0 4px;"></div>
                                    <textarea class="bind-bullet-txt" placeholder="설명 항목을 입력하세요 (엔터로 줄바꿈)" rows="2" style="flex: 1; min-width: 0; border-radius: 8px; padding: 10px 14px; border: 1px solid #D1D5DB; font-size: 14px; color: #111; font-family: inherit; resize: vertical; outline: none;">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                                    <button class="action-btn remove-bullet-btn" style="padding: 0; width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: white; border: 1px solid #e5e7eb; border-radius: 8px; color: #ef4444; margin-top: 2px;" title="삭제">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-row two-cols">
                        <div class="form-group">
                            <label>버튼 1 설정 (옵션)</label>
                            <input type="text" class="bind-txt" data-field="btn1" style="margin-bottom: 6px;" placeholder="버튼 텍스트 (예: 바로가기)">
                            <input type="text" class="bind-txt" data-field="btn1Link" style="margin-bottom: 6px;" placeholder="이동할 링크 주소 (https://...)">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <input type="checkbox" class="bind-chk" data-field="btn1Arrow" id="btn1_arrow_${index}">
                                <label for="btn1_arrow_${index}" style="margin:0; font-size:12px; color:#4b5563; font-weight:normal; cursor:pointer;">우측 화살표(>) 추가</label>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>버튼 2 설정 (옵션)</label>
                            <input type="text" class="bind-txt" data-field="btn2" style="margin-bottom: 6px;" placeholder="버튼 텍스트">
                            <input type="text" class="bind-txt" data-field="btn2Link" style="margin-bottom: 6px;" placeholder="이동할 링크 주소 (https://...)">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <input type="checkbox" class="bind-chk" data-field="btn2Arrow" id="btn2_arrow_${index}">
                                <label for="btn2_arrow_${index}" style="margin:0; font-size:12px; color:#4b5563; font-weight:normal; cursor:pointer;">우측 화살표(>) 추가</label>
                            </div>
                        </div>
                    </div>
                `;
            } else if (comp.type === 'tabs') {
                card.innerHTML = `
                    <div class="form-group tab-list-group">
                        <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span>탭 항목 관리</span>
                            <button class="action-btn add-tab-btn" style="width: auto; padding: 4px 10px; font-size: 12px; height: auto; white-space: nowrap; flex-shrink: 0;" title="탭 추가">+ 탭 추가</button>
                        </label>
                        <div class="tab-inputs-container" style="display: flex; flex-direction: column; gap: 8px;">
                            ${(comp.data.tabList || []).map((tab) => `
                                <div class="tab-input-row" style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                                    <div style="width: 4px; height: 4px; background-color: #A3A8B6; border-radius: 50%; flex-shrink: 0; margin: 0 4px;"></div>
                                    <input type="text" class="bind-tab-name" value="${tab.name.replace(/"/g, '&quot;')}" placeholder="탭 이름 (예: 여행 준비)" style="flex: 1; min-width: 0; border-radius: 8px; padding: 10px 14px; border: 1px solid #D1D5DB; font-size: 14px; color: #111;">
                                    <select class="bind-tab-target" style="width: 140px; border-radius: 8px; padding: 9px 12px; border: 1px solid #D1D5DB; font-size: 13px; color: #111;">
                                        <option value="">대상 선택...</option>
                                        ${components.filter(c => c.id !== comp.id).map(c => `<option value="${c.id}" ${tab.targetStep === c.id ? 'selected' : ''}>${getComponentLabel(c).replace(/"/g, '&quot;')}</option>`).join('')}
                                    </select>
                                    <button class="action-btn remove-tab-btn" style="padding: 0; width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: white; border: 1px solid #e5e7eb; border-radius: 8px; color: #ef4444;" title="삭제">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        </div>
                    </div>
                `;
            } else if (comp.type === 'concept') {
                const currentAlign = comp.data.align || 'left';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
                        <label style="margin: 0; padding-bottom: 4px;">텍스트 정렬 설정</label>
                        <div class="segmented-control align-toggle-control" style="background: white; border: 1px solid #d1d5db; padding: 2px;">
                            <button class="seg-btn ${currentAlign !== 'center' ? 'active' : ''}" data-val="left" style="font-size: 13px; padding: 6px 12px;">좌측</button>
                            <button class="seg-btn ${currentAlign === 'center' ? 'active' : ''}" data-val="center" style="font-size: 13px; padding: 6px 12px;">중앙</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6px;">
                            <label style="margin: 0;">타이틀 (옵션)</label>
                            <div class="segmented-control title-color-toggle-control" style="background: white; border: 1px solid #d1d5db; padding: 2px;">
                                <button class="seg-btn ${comp.data.titleColor !== 'theme' ? 'active' : ''}" data-val="gray" style="font-size: 12px; padding: 4px 10px;">그레이</button>
                                <button class="seg-btn ${comp.data.titleColor === 'theme' ? 'active' : ''}" data-val="theme" style="font-size: 12px; padding: 4px 10px;">테마컬러</button>
                            </div>
                        </div>
                        <textarea class="bind-area" data-field="title" placeholder="입력 시 레이아웃 상단에 표시됩니다 (예: 트래블월렛이란?)" rows="2" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #d1d5db; font-size: 14px; color: #111; font-family: inherit; resize: vertical; outline: none;">${(comp.data.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>본문 내용 (필수)</label>
                        <textarea class="bind-area" data-field="bodyText" placeholder="본문 내용 입력 (엔터로 줄바꿈, <b>태그로 굵게 표기 가능)" rows="3" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #D1D5DB; font-size: 14px; color: #111; font-family: inherit; resize: vertical; outline: none;">${(comp.data.bodyText || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                    <div class="form-row two-cols">
                        <div class="form-group">
                            <label>버튼 텍스트 (옵션)</label>
                            <input type="text" class="bind-txt" data-field="buttonText" placeholder="입력 시 하단 버튼 생성 (예: 자세히보기 >)">
                        </div>
                        <div class="form-group">
                            <label>버튼 링크 (옵션)</label>
                            <input type="text" class="bind-txt" data-field="buttonUrl" placeholder="https://...">
                        </div>
                    </div>
                        </div>
                    </div>
                `;
            } else if (comp.type === 'tabDivider') {
                card.innerHTML = `
                    <div style="padding:16px; background-color:#eff6ff; border-radius:8px; margin-bottom:12px; color:#1e40af; font-size:13px; line-height:1.5;">
                        <b style="font-size: 14px;">화면 분할 기준점 📌</b><br>
                        이 컴포넌트를 기준으로, <b>위에 있는 모든 내용들은 첫 번째 탭</b>에 담기고,<br>
                        <b>아래에 추가되는 내용들은 두 번째 탭</b>에 담겨 서로 다른 화면으로 분리 동작하게 됩니다. (탭 버튼은 화면 맨 위에 자동 생성됩니다.)
                    </div>
                    <div class="form-row two-cols" style="margin-top: 12px;">
                        <div class="form-group">
                            <label>첫 번째 탭 이름 (왼쪽)</label>
                            <input type="text" class="bind-txt" data-field="tab1Name" placeholder="예: 기존 화면">
                        </div>
                        <div class="form-group">
                            <label>두 번째 탭 이름 (오른쪽)</label>
                            <input type="text" class="bind-txt" data-field="tab2Name" placeholder="예: 새로운 화면 (우측 탭)">
                        </div>
                    </div>
                `;
            } else if (comp.type === 'faq') {
                card.innerHTML = `
                    <div class="form-group">
                        <label>질문 (Q)</label>
                        <textarea class="bind-area" data-field="question" placeholder="예: Q. 외화 머니는 어디서 쓸 수 있나요?" rows="2" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #d1d5db; font-size: 14px; color: #111; font-family: inherit; resize: vertical; outline: none;">${(comp.data.question || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>답변 내용 (A) (필수)</label>
                        <textarea class="bind-area" data-field="answer" placeholder="답변 내용 입력 (엔터로 줄바꿈)" rows="4" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #D1D5DB; font-size: 14px; color: #111; font-family: inherit; resize: vertical; outline: none;">${(comp.data.answer || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                `;
            } else if (comp.type === 'notice') {
                card.innerHTML = `
                    <div class="form-group" style="display: none;">
                        <label>타이틀</label>
                        <input type="text" class="bind-txt" data-field="title" value="유의사항" disabled>
                    </div>
                    <div class="form-group">
                        <label>유의사항 목록</label>
                        <textarea class="bind-area" data-field="bullets" placeholder="유의사항 목록을 엔터로 구분하여 입력해주세요." rows="5" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #D1D5DB; font-size: 14px; color: #111; font-family: inherit; resize: vertical; outline: none;">${(comp.data.bullets || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                `;
            }
            
            // Visibility Toggle (Common)
            const toggleWrapper = document.createElement('div');
            toggleWrapper.className = 'form-group flex-row';
            toggleWrapper.style.marginBottom = '0';
            toggleWrapper.style.marginTop = '16px';
            toggleWrapper.style.paddingTop = '16px';
            toggleWrapper.style.borderTop = '1px solid #f3f4f6';
            toggleWrapper.style.justifyContent = 'flex-end';
            toggleWrapper.style.gap = '12px';
            
            toggleWrapper.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <label style="margin: 0; font-size: 13px; color: #4b5563; font-weight: 500;">컴포넌트 노출 여부</label>
                    <label class="switch">
                        <input type="checkbox" class="bind-chk" data-field="visible">
                        <span class="slider round"></span>
                    </label>
                </div>
            `;
            card.appendChild(toggleWrapper);
            
            // Value Binding & Event Listeners
            card.querySelectorAll('.bind-txt').forEach(inp => {
                inp.value = comp.data[inp.dataset.field] || '';
                inp.addEventListener('input', (e) => {
                    comp.data[inp.dataset.field] = e.target.value;
                    renderPreview();
                });
            });
            
            card.querySelectorAll('.bind-area').forEach(inp => {
                inp.value = comp.data[inp.dataset.field] || '';
                inp.addEventListener('input', (e) => {
                    comp.data[inp.dataset.field] = e.target.value;
                    renderPreview();
                });
            });
            
            card.querySelectorAll('.bind-chk').forEach(inp => {
                inp.checked = !!comp.data[inp.dataset.field];
                inp.addEventListener('change', (e) => {
                    comp.data[inp.dataset.field] = e.target.checked;
                    renderPreview();
                });
            });

            const alignToggleBtns = card.querySelectorAll('.align-toggle-control .seg-btn');
            alignToggleBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    comp.data.align = e.target.dataset.val;
                    alignToggleBtns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    renderPreview();
                });
            });

            const titleColorBtns = card.querySelectorAll('.title-color-toggle-control .seg-btn');
            titleColorBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    comp.data.titleColor = e.target.dataset.val;
                    titleColorBtns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    renderPreview();
                });
            });


            const stepToggleBtns = card.querySelectorAll('.step-toggle-control .seg-btn');
            const stepNumberInput = card.querySelector('.step-number-input');
            stepToggleBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    comp.data.isStep = e.target.dataset.val === 'true';
                    stepToggleBtns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    if (stepNumberInput) {
                        stepNumberInput.disabled = !comp.data.isStep;
                    }
                    
                    const badgeSettingsContainer = card.querySelector('.badge-settings-container');
                    if (badgeSettingsContainer) {
                        badgeSettingsContainer.style.display = comp.data.isStep ? 'none' : 'block';
                    }
                    
                    renderPreview();
                });
            });
            
            const badgeAlignBtns = card.querySelectorAll('.badge-align-control .seg-btn');
            badgeAlignBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    comp.data.badgeAlign = e.target.dataset.val;
                    badgeAlignBtns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    renderPreview();
                });
            });
            
            // Bullets Dynamic List Logic
            const addBulletBtn = card.querySelector('.add-bullet-btn');
            const bulletInputsContainer = card.querySelector('.bullet-inputs-container');
            
            if (addBulletBtn && bulletInputsContainer) {
                const syncBullets = () => {
                    const inputs = bulletInputsContainer.querySelectorAll('.bind-bullet-txt');
                    comp.data.bulletList = Array.from(inputs).map(inp => inp.value);
                    renderPreview();
                };

                bulletInputsContainer.addEventListener('input', (e) => {
                    if (e.target.classList.contains('bind-bullet-txt')) {
                        syncBullets();
                    }
                });

                bulletInputsContainer.addEventListener('click', (e) => {
                    const removeBtn = e.target.closest('.remove-bullet-btn');
                    if (removeBtn) {
                        e.preventDefault();
                        const row = removeBtn.closest('.bullet-input-row');
                        if (row) {
                            row.remove();
                            syncBullets();
                        }
                    }
                });

                addBulletBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const newRow = document.createElement('div');
                    newRow.className = 'bullet-input-row';
                    newRow.style.cssText = 'display: flex; align-items: flex-start; gap: 8px; margin-bottom: 2px;';
                    newRow.innerHTML = `
                        <div style="width: 4px; height: 4px; background-color: #A3A8B6; border-radius: 50%; flex-shrink: 0; margin: 15px 4px 0 4px;"></div>
                        <textarea class="bind-bullet-txt" placeholder="설명 항목을 입력하세요 (엔터로 줄바꿈)" rows="2" style="flex: 1; min-width: 0; border-radius: 8px; padding: 10px 14px; border: 1px solid #D1D5DB; font-size: 14px; color: #111; font-family: inherit; resize: vertical; outline: none;"></textarea>
                        <button class="action-btn remove-bullet-btn" style="padding: 0; width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: white; border: 1px solid #e5e7eb; border-radius: 8px; color: #ef4444; margin-top: 2px;" title="삭제">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                    `;
                    bulletInputsContainer.appendChild(newRow);
                    syncBullets();
                    
                    const newInput = newRow.querySelector('input');
                    if (newInput) newInput.focus();
                });
            }
            
            // Action Buttons
            header.querySelector('.move-up').addEventListener('click', () => moveComponent(index, -1));
            header.querySelector('.move-down').addEventListener('click', () => moveComponent(index, 1));
            header.querySelector('.delete-btn').addEventListener('click', () => deleteComponent(index));

            // Tabs Dynamic List Logic
            const addTabBtn = card.querySelector('.add-tab-btn');
            const tabInputsContainer = card.querySelector('.tab-inputs-container');
            
            if (addTabBtn && tabInputsContainer) {
                const syncTabs = () => {
                    const rows = tabInputsContainer.querySelectorAll('.tab-input-row');
                    comp.data.tabList = Array.from(rows).map(row => {
                        return {
                            name: row.querySelector('.bind-tab-name').value,
                            targetStep: row.querySelector('.bind-tab-target').value
                        };
                    });
                    renderPreview();
                };

                tabInputsContainer.addEventListener('input', (e) => {
                    if (e.target.classList.contains('bind-tab-name') || e.target.classList.contains('bind-tab-target')) {
                        syncTabs();
                    }
                });

                tabInputsContainer.addEventListener('click', (e) => {
                    const removeBtn = e.target.closest('.remove-tab-btn');
                    if (removeBtn) {
                        e.preventDefault();
                        const row = removeBtn.closest('.tab-input-row');
                        if (row) {
                            row.remove();
                            syncTabs();
                        }
                    }
                });

                addTabBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const newRow = document.createElement('div');
                    newRow.className = 'tab-input-row';
                    newRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 2px;';
                    newRow.innerHTML = `
                        <div style="width: 4px; height: 4px; background-color: #A3A8B6; border-radius: 50%; flex-shrink: 0; margin: 0 4px;"></div>
                        <input type="text" class="bind-tab-name" value="" placeholder="탭 이름 (예: 여행 준비)" style="flex: 1; min-width: 0; border-radius: 8px; padding: 10px 14px; border: 1px solid #D1D5DB; font-size: 14px; color: #111;">
                        <select class="bind-tab-target" style="width: 140px; border-radius: 8px; padding: 9px 12px; border: 1px solid #D1D5DB; font-size: 13px; color: #111;">
                            <option value="" selected>대상 선택...</option>
                            ${components.filter(c => c.id !== comp.id).map(c => `<option value="${c.id}">${getComponentLabel(c).replace(/"/g, '&quot;')}</option>`).join('')}
                        </select>
                        <button class="action-btn remove-tab-btn" style="padding: 0; width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: white; border: 1px solid #e5e7eb; border-radius: 8px; color: #ef4444;" title="삭제">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                    `;
                    tabInputsContainer.appendChild(newRow);
                    syncTabs();
                    
                    const newInput = newRow.querySelector('.bind-tab-name');
                    if (newInput) newInput.focus();
                });
            }

            // Local Video File Upload Logic
            const videoFileInput = card.querySelector('.video-file-input');
            const fileWarningMsg = card.querySelector('.file-warning-msg');
            const videoUrlInput = card.querySelector('.bind-txt[data-field="url"]');
            
            if (videoFileInput && videoUrlInput) {
                videoFileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const blobUrl = URL.createObjectURL(file);
                        comp.data.url = blobUrl;
                        videoUrlInput.value = blobUrl;
                        if (fileWarningMsg) fileWarningMsg.style.display = 'block';
                        
                        const uploadText = card.querySelector('.file-upload-text');
                        if (uploadText) {
                            uploadText.textContent = file.name;
                            uploadText.style.color = '#111';
                        }
                        
                        const reader = new FileReader();
                        reader.onload = (re) => { comp.data.exportStr = re.target.result; };
                        reader.readAsDataURL(file);

                        renderPreview();
                    }
                });

                // Hide warning if user types a real URL again
                videoUrlInput.addEventListener('input', (e) => {
                    if (fileWarningMsg && !e.target.value.startsWith('blob:')) {
                        fileWarningMsg.style.display = 'none';
                    }
                });
                
                // Show warning initially if it's already a blob
                if (comp.data.url.startsWith('blob:') && fileWarningMsg) {
                    fileWarningMsg.style.display = 'block';
                }
            }

            // Local Image File Upload Logic (Explanation)
            const expImageFileInput = card.querySelector('.exp-image-file-input');
            const expFileWarningMsg = card.querySelector('.exp-file-warning-msg');
            const expImageUrlInput = card.querySelector('.bind-txt[data-field="imageUrl"]');
            
            if (expImageFileInput && expImageUrlInput) {
                expImageFileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const blobUrl = URL.createObjectURL(file);
                        comp.data.imageUrl = blobUrl;
                        expImageUrlInput.value = blobUrl;
                        if (expFileWarningMsg) expFileWarningMsg.style.display = 'block';
                        
                        const uploadText = card.querySelector('.exp-file-upload-text');
                        if (uploadText) {
                            uploadText.textContent = file.name;
                            uploadText.style.color = '#111';
                        }
                        
                        const reader = new FileReader();
                        reader.onload = (re) => { comp.data.exportStr = re.target.result; };
                        reader.readAsDataURL(file);

                        renderPreview();
                    }
                });

                expImageUrlInput.addEventListener('input', (e) => {
                    if (expFileWarningMsg && !e.target.value.startsWith('blob:')) {
                        expFileWarningMsg.style.display = 'none';
                    }
                });
                
                if (comp.data.imageUrl && comp.data.imageUrl.startsWith('blob:') && expFileWarningMsg) {
                    expFileWarningMsg.style.display = 'block';
                }
            }

            block.appendChild(header);
            block.appendChild(card);
            editorList.appendChild(block);
        });
        
        renderPreview();
    }
    
    // --- Render Preview ---
    function renderPreview() {
        previewBody.innerHTML = '';
        
        let tab1Container = null;
        let tab2Container = null;
        
        if (componentsTab2.length > 0) {
            tab1Container = document.createElement('div');
            tab1Container.id = 'view-tab-1';
            tab1Container.style.display = 'block';
            tab1Container.style.width = '100%';
            
            tab2Container = document.createElement('div');
            tab2Container.id = 'view-tab-2';
            tab2Container.style.display = 'none';
            tab2Container.style.width = '100%';

            const t1Name = document.getElementById('tab1NameInput') ? document.getElementById('tab1NameInput').value : '기본 화면';
            const t2Name = document.getElementById('tab2NameInput') ? document.getElementById('tab2NameInput').value : 'FAQ';

            const tabSwitcherHtml = `
                <div style="display: flex; gap: 20px; border-bottom: 1px solid #e5e7eb; background: white; position: sticky; top: 0; z-index: 10;">
                    <div class="view-tab-btn active" onclick="window.switchPreviewTab(1, this);" style="font-size: 16px; font-weight: 700; color: #111; padding: 16px 0; border-bottom: 2px solid #111; cursor: pointer; flex: 1; text-align: center;">${t1Name.replace(/</g, '&lt;')}</div>
                    <div class="view-tab-btn" onclick="window.switchPreviewTab(2, this);" style="font-size: 16px; font-weight: 500; color: #9ca3af; padding: 16px 0; border-bottom: 2px solid transparent; cursor: pointer; flex: 1; text-align: center;">${t2Name.replace(/</g, '&lt;')}</div>
                </div>
            `;
            const switcherDiv = document.createElement('div');
            switcherDiv.style.width = '100%';
            switcherDiv.innerHTML = tabSwitcherHtml;
            previewBody.appendChild(switcherDiv);
            
            previewBody.appendChild(tab1Container);
            previewBody.appendChild(tab2Container);
        }
        
        const processComp = (comp, index, finalTarget) => {
            if (!comp.data.visible) return;
            
            let html = '';
            const div = document.createElement('div');
            
            if (comp.type === 'video') {
                div.style.cssText = "width: 100%; aspect-ratio: 16/9; background-color: #e5e5e5; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;";
                
                let moreBtnHtml = '';
                if (comp.data.moreLink) {
                    moreBtnHtml = `<a href="${comp.data.moreLink}" target="_blank" style="background-color: rgba(25,27,30,0.3); color: white; border: 1px solid rgba(255,255,255,0.2); text-decoration: none; font-size: 13px; font-weight: 600; padding: 0 16px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; height: 32px; backdrop-filter: blur(4px);">더보기</a>`;
                }

                if (comp.data.url) {
                    html = `
                        <video src="${comp.data.url}" class="playable-video" style="width: 100%; height: 100%; object-fit: cover; display: block; cursor: pointer;" autoplay loop muted playsinline></video>
                        <div class="video-overlay" style="position: absolute; top:0; left:0; right:0; bottom:0; background-color: rgba(0,0,0,0.1); display: none; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto; z-index: 5;">
                            <div style="width: 80px; height: 80px; background-color: rgba(0,0,0,0.4); border-radius: 50%; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
                                <svg width="32" height="32" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-left: 3px;">
                                    <path d="M26 18V62L66 40L26 18Z" fill="white" stroke="white" stroke-width="8" stroke-linejoin="round" />
                                </svg>
                            </div>
                        </div>
                        <div style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 16px 12px 16px; pointer-events: none; z-index: 10;">
                            <button class="mute-toggle-btn" style="width: 32px; height: 32px; border-radius: 50%; background-color: rgba(25,27,30,0.3); border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; padding: 0; pointer-events: auto; backdrop-filter: blur(4px);">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                            </button>
                            <div style="pointer-events: auto;">
                                ${moreBtnHtml}
                            </div>
                        </div>
                    `;
                } else {
                    html = `<span style="color: #111; font-size: 15px; font-weight: 500;">영상</span>`;
                }
            } else if (comp.type === 'title') {
                const alignStyle = comp.data.align === 'center' ? 'center' : 'left';
                const prevComp = index > 0 ? components[index - 1] : null;
                let topPad = 40;
                if (prevComp && prevComp.type === 'concept') {
                    topPad = 16;
                } else if (prevComp && prevComp.type === 'tabs') {
                    topPad = 0;
                }
                const leftPad = comp.data.align === 'center' ? 20 : 24;
                div.style.cssText = `width: 100%; text-align: ${alignStyle}; background-color: white; padding: ${topPad}px 20px 8px ${leftPad}px; box-sizing: border-box;`;
                html = `
                    <p style="font-size: 16px; color: #626A7A; margin: 0 0 6px 0; font-weight: 400; word-break: keep-all; overflow-wrap: anywhere;">${(comp.data.subtitle || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>
                    <h3 style="font-size: 28px; font-weight: 700; color: #191B1E; margin: 0; word-break: keep-all; line-height: 1.3;">${(comp.data.mainTitle || ' ').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>').replace(/\*(.*?)\*/g, `<span style="color: ${currentThemeColor};">$1</span>`)}</h3>
                `;
            } else if (comp.type === 'concept') {
                const prevComp = index > 0 ? components[index - 1] : null;
                let topPad = 0;
                const alignStyle = comp.data.align === 'center' ? 'center' : 'left';
                div.style.cssText = `width: 100%; text-align: ${alignStyle}; padding: ${topPad}px 20px 16px 20px; margin-top: -10px; box-sizing: border-box;`;
                
                let titleHtml = '';
                if (comp.data.title && comp.data.title.trim()) {
                    const tColor = (comp.data.titleColor === 'black' || comp.data.titleColor === 'gray') ? '#5F5F5F' : currentThemeColor;
                    titleHtml = `<h4 style="color: ${tColor}; font-size: 17px; font-family: Pretendard, sans-serif; font-weight: 700; margin: 0; word-break: keep-all; overflow-wrap: anywhere; line-height: 24px;">${comp.data.title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h4>`;
                }

                let bodyHtml = '';
                if (comp.data.bodyText && comp.data.bodyText.trim()) {
                    const formattedBody = comp.data.bodyText.replace(/\n/g, '<br>');
                    bodyHtml = `<p style="color: #626A7A; font-size: 14px; font-family: Pretendard, sans-serif; font-weight: 400; margin: 0; line-height: 20px; word-break: keep-all; overflow-wrap: anywhere;">${formattedBody}</p>`;
                }

                let buttonHtml = '';
                if (comp.data.buttonText && comp.data.buttonText.trim()) {
                    buttonHtml = `
                        <div style="margin-top: 12px; width: 100%;">
                            <a href="${comp.data.buttonUrl || '#'}" target="_blank" style="display: flex; align-items: center; justify-content: center; background-color: white; border: 1px solid #E7E9EF; color: #191B1E; font-size: 14px; font-weight: 600; padding: 0; height: 44px; border-radius: 8px; text-decoration: none; width: 100%; box-sizing: border-box; gap: 2px;">
                                <span>${comp.data.buttonText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; transform: translateY(-1px);"><path d="M9 18l6-6-6-6"/></svg>
                            </a>
                        </div>
                    `;
                }

                html = `
                    <div class="concept-banner" style="background-color: white; border: 1px solid ${hexToRgba(currentThemeColor, 0.3)}; border-radius: 16px; padding: 20px; position: relative; text-align: ${alignStyle}; display: flex; flex-direction: column; align-items: ${alignStyle === 'center' ? 'center' : 'flex-start'}; gap: 4px; width: 100%; box-sizing: border-box;">
                        ${titleHtml}
                        ${bodyHtml}
                        ${buttonHtml}
                    </div>
                `;
            } else if (comp.type === 'tabs') {
                div.style.cssText = "width: 100%; background-color: white; padding: 20px 20px 0 20px; margin-bottom: 40px; position: sticky; top: 0; z-index: 10;";
                const tabHtml = (comp.data.tabList || []).map((tab, i) => {
                    const isActive = i === 0;
                    const style = isActive
                        ? "font-size: 16px; font-weight: 700; color: #111; padding-bottom: 12px; border-bottom: 2px solid #111; cursor: pointer; white-space: nowrap; text-decoration: none; transition: all 0.2s;"
                        : "font-size: 16px; font-weight: 500; color: #9ca3af; padding-bottom: 12px; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: all 0.2s;";
                    const onclickStr = `event.preventDefault(); const t = document.getElementById('${tab.targetStep}'); if(t) t.scrollIntoView({behavior: 'smooth', block: 'start'}); Array.from(this.parentElement.children).forEach(e => { e.style.color = '#9ca3af'; e.style.fontWeight = '500'; e.style.borderBottomColor = 'transparent'; }); this.style.color = '#111'; this.style.fontWeight = '700'; this.style.borderBottomColor = '#111';`;
                    return `<a href="#${tab.targetStep}" class="tab-item" style="${style}" onclick="${onclickStr}">${tab.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a>`;
                }).join('');
                
                html = `
                    <div class="tabs-container" style="display: flex; gap: 20px; border-bottom: 1px solid #e5e7eb; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none;">
                        <style>.tabs-container::-webkit-scrollbar { display: none; }</style>
                        ${tabHtml}
                    </div>
                `;
            } else if (comp.type === 'explanation') {
                div.className = 'explanation-component' + (comp.data.isStep ? '' : ' standalone');
                div.style.position = 'relative';
                
                let imageHtml = comp.data.imageUrl ? `<img class="explanation-image" src="${comp.data.imageUrl}" style="display: block;" alt="Explanation Image">` : '';
                
                let bulletsHtml = '';
                const bList = comp.data.bulletList || (comp.data.bullets ? comp.data.bullets.split('\n') : []);
                if (bList.length > 0) {
                    bulletsHtml = '<ul class="explanation-bullets" style="display: block;">' + 
                        bList.filter(b => b.trim() !== '').map(line => `<li>${line.trim().replace(/\\n/g, '<br>').replace(/\n/g, '<br>')}</li>`).join('') + 
                        '</ul>';
                }
                
                let buttonsHtml = '';
                if (comp.data.btn1 || comp.data.btn2) {
                    buttonsHtml = '<div class="explanation-buttons" style="display: flex;">';
                    const arrowSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; transform: translateY(-1px);"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
                    if (comp.data.btn1) {
                        const tag = comp.data.btn1Link ? 'a' : 'button';
                        const hrefAttr = comp.data.btn1Link ? ` href="${comp.data.btn1Link.replace(/"/g, '&quot;')}" target="_blank"` : '';
                        buttonsHtml += `<${tag}${hrefAttr} class="explanation-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 2px; text-decoration: none;"><span>${comp.data.btn1}</span>${comp.data.btn1Arrow ? arrowSvg : ''}</${tag}>`;
                    }
                    if (comp.data.btn2) {
                        const tag = comp.data.btn2Link ? 'a' : 'button';
                        const hrefAttr = comp.data.btn2Link ? ` href="${comp.data.btn2Link.replace(/"/g, '&quot;')}" target="_blank"` : '';
                        buttonsHtml += `<${tag}${hrefAttr} class="explanation-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 2px; text-decoration: none;"><span>${comp.data.btn2}</span>${comp.data.btn2Arrow ? arrowSvg : ''}</${tag}>`;
                    }
                    buttonsHtml += '</div>';
                }
                
                let badgeHtml = '';
                let contentTextAlign = 'left';
                let standalonePaddingLeft = '';
                if (!comp.data.isStep) {
                    if (comp.data.badgeAlign === 'center') {
                        contentTextAlign = 'center';
                    } else if (comp.data.badgeAlign === 'left') {
                        standalonePaddingLeft = 'padding-left: 4px;';
                    }
                    if (comp.data.badgeText && comp.data.badgeText.trim() !== '') {
                        const badgeAlignment = comp.data.badgeAlign === 'left' ? 'flex-start' : 'center';
                        badgeHtml = `
                            <div style="display: flex; justify-content: ${badgeAlignment}; margin-top: 10px; margin-bottom: 16px;">
                                <div style="background-color: ${currentThemeColor}; color: white; font-size: 14px; font-weight: 700; padding: 6px 16px; border-radius: 20px; font-family: Pretendard, sans-serif;">
                                    ${comp.data.badgeText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                                </div>
                            </div>
                        `;
                    }
                }
                
                html = `
                    <div class="explanation-indicator">
                        <div class="step-circle">${comp.data.stepNumber || '1'}</div>
                        <div class="step-line"></div>
                    </div>
                    <div class="explanation-content" style="width: 100%; text-align: ${contentTextAlign}; ${standalonePaddingLeft}">
                        ${badgeHtml}
                        <h3 class="explanation-title" style="margin-bottom: ${(comp.data.subtitle && comp.data.subtitle.trim()) ? '4px' : '16px'}; word-break: keep-all; overflow-wrap: anywhere;">${(comp.data.title || ' ').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>').replace(/&lt;b&gt;/gi, '<b style="font-weight: 700;">').replace(/&lt;\/b&gt;/gi, '</b>')}</h3>
                        ${(comp.data.subtitle && comp.data.subtitle.trim()) ? `<p class="explanation-subtitle" style="font-size: 16px; color: #6b7280; margin: 0 0 16px 0; line-height: 1.4; word-break: keep-all; overflow-wrap: anywhere;">${comp.data.subtitle.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>` : ''}
                        ${imageHtml}
                        ${bulletsHtml}
                        ${buttonsHtml}
                    </div>
                    </div>
                `;
            } else if (comp.type === 'faq') {
                div.style.cssText = "width: 100%; border-bottom: 1px solid #f3f4f6; background-color: white; padding: 0;";
                const formattedAnswer = (comp.data.answer || '').replace(/\n/g, '<br>');
                html = `
                    <div style="padding: 16px 20px 16px 24px; box-sizing: border-box;">
                        <div class="faq-question" onclick="const ans = this.nextElementSibling; const icon = this.querySelector('svg'); if(ans.style.display === 'none'){ ans.style.display = 'block'; icon.style.transform = 'rotate(180deg)'; } else { ans.style.display = 'none'; icon.style.transform = 'rotate(0deg)'; }" style="display: flex; justify-content: space-between; align-items: flex-start; cursor: pointer; background: transparent;">
                            <h4 style="font-size: 15px; font-weight: 700; color: #111; margin: 0; line-height: 1.4; font-family: Pretendard, sans-serif; word-break: keep-all; overflow-wrap: anywhere;">${(comp.data.question || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</h4>
                            <svg class="faq-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; transition: transform 0.3s; margin-left: 8px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                        <div class="faq-answer" style="display: none; padding-top: 12px;">
                            <p style="font-size: 14px; color: #4b5563; margin: 0; line-height: 1.5; font-family: Pretendard, sans-serif; word-break: keep-all;">${formattedAnswer}</p>
                        </div>
                    </div>
                    </div>
                `;
            } else if (comp.type === 'notice') {
                const titleText = (comp.data.title || '유의사항').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const bList = comp.data.bullets ? comp.data.bullets.split('\n') : [];
                let bulletsHtml = '';
                if (bList.length > 0) {
                    bulletsHtml = '<ul class="notice-bullets" style="display: block; list-style: none; padding: 0; margin: 0;">' + 
                        bList.filter(b => b.trim() !== '').map(line => `<li style="position: relative; padding-left: 12px; margin-bottom: 8px; font-size: 14px; font-weight: 400; font-family: Pretendard, sans-serif; color: #343841; line-height: 1.5; word-break: keep-all; text-align: left;">${line.trim().replace(/\\n/g, '<br>').replace(/\n/g, '<br>')}</li>`).join('') + 
                        '</ul>';
                }
                
                div.className = 'notice-component';
                div.style.cssText = 'width: 100%; margin-top: 29px; padding: 32px 20px; box-sizing: border-box; background-color: #F4F5F7; text-align: left;';
                
                html = `
                    ${titleText ? `<h4 style="margin: 0 0 16px 0; font-size: 17px; font-weight: 700; color: #111; font-family: Pretendard, sans-serif; word-break: keep-all; text-align: left;">${titleText}</h4>` : ''}
                    ${bulletsHtml}
                `;
            }
            
            if (html !== '') {
                let anchorTop = -50;
                if (index > 0 && components[index - 1] && components[index - 1].type === 'tabs') {
                    anchorTop -= 40;
                }
                const globalAnchorHtml = `<div id="${comp.id}" style="position: absolute; top: ${anchorTop}px; visibility: hidden; pointer-events: none;"></div>`;
                if (!div.style.position || div.style.position === 'static') {
                    div.style.position = 'relative';
                }
                div.innerHTML = globalAnchorHtml + html;
                finalTarget.appendChild(div);
            }
        };

        if (componentsTab2.length > 0) {
            componentsTab1.forEach((comp, index) => processComp(comp, index, tab1Container));
            componentsTab2.forEach((comp, index) => processComp(comp, index, tab2Container));
        } else {
            componentsTab1.forEach((comp, index) => processComp(comp, index, previewBody));
        }

        function createBottomFiller(list) {
            const filler = document.createElement('div');
            filler.className = 'smart-bottom-filler';
            filler.style.cssText = 'width: 100%; pointer-events: none;';
            const last = list[list.length - 1];
            if (last && last.type === 'notice') {
                filler.style.backgroundColor = '#F4F5F7';
            } else {
                filler.style.backgroundColor = 'transparent';
            }
            return filler;
        }

        if (componentsTab2.length > 0) {
            tab1Container.appendChild(createBottomFiller(componentsTab1));
            tab2Container.appendChild(createBottomFiller(componentsTab2));
            // Trigger measurement for Tab 1 initially
            setTimeout(() => {
                const dummyBtn = { parentElement: { children: [{}, {}] } }; // Mock for initial call
                // Don't call switchPreviewTab since it changes UI colors. Just set height.
                const target = document.getElementById('view-tab-1');
                if(!target) return;
                const fill = target.querySelector('.smart-bottom-filler');
                const tMenu = target.querySelector('[style*="position: sticky"]');
                const pArea = document.querySelector('.preview-area');
                if(fill && tMenu && pArea) {
                    fill.style.height = '0px';
                    const diff = target.getBoundingClientRect().bottom - tMenu.getBoundingClientRect().bottom;
                    if (diff < pArea.clientHeight) fill.style.height = (pArea.clientHeight - diff) + 'px';
                }
            }, 50);
        } else {
            previewBody.appendChild(createBottomFiller(componentsTab1));
        }
    }

    // --- State Accessors ---
    function moveComponent(index, direction) {
        if (index + direction < 0 || index + direction >= components.length) return;
        const newIndex = index + direction;
        const temp = components[index];
        components[index] = components[newIndex];
        components[newIndex] = temp;
        renderEditor(); 
        
        setTimeout(() => {
            const editorList = document.getElementById('editorComponentList');
            if (editorList && editorList.children[newIndex]) {
                const targetCard = editorList.children[newIndex];
                
                const scrollPos = targetCard.offsetTop - (editorList.clientHeight / 2) + (targetCard.clientHeight / 2) - 40;
                editorList.scrollTo({ top: scrollPos, behavior: 'smooth' });
                
                targetCard.style.transition = 'box-shadow 0.3s ease';
                targetCard.style.boxShadow = `0 0 0 2px ${currentThemeColor}, 0 4px 12px rgba(0,0,0,0.15)`;
                setTimeout(() => {
                    targetCard.style.boxShadow = '';
                }, 1000);
            }
        }, 50);
    }
    
    function deleteComponent(index) {
        if(confirm('이 컴포넌트를 삭제하시겠습니까?')) {
            components.splice(index, 1);
            renderEditor();
        }
    }
    
    function addComponent(type) {
        const base = { id: generateId(), type, data: { visible: true } };
        if (type === 'video') {
            base.data.url = '';
            base.data.moreLink = '';
        } else if (type === 'title') {
            base.data.subtitle = '서브타이틀';
            base.data.mainTitle = '메인타이틀';
            base.data.align = 'left';
        } else if (type === 'tabs') {
            base.data.tabList = [
                { name: '여행 준비', targetStep: '1' },
                { name: '여행 중', targetStep: '2' }
            ];
        } else if (type === 'explanation') {
            base.data.isStep = true;
            base.data.stepNumber = (components.filter(c => c.type === 'explanation').length + 1).toString();
            base.data.badgeText = '';
            base.data.badgeAlign = 'center';
            base.data.titleWeight = 'bold';
            base.data.subtitle = '';
            base.data.title = '메인문구';
            base.data.imageUrl = '';
            base.data.bulletList = [''];
            base.data.btn1 = '';
            base.data.btn1Link = '';
            base.data.btn1Arrow = false;
            base.data.btn2 = '';
            base.data.btn2Link = '';
            base.data.btn2Arrow = false;
        } else if (type === 'tabDivider') {
            base.data.tab1Name = '기존 컴포넌트들';
            base.data.tab2Name = '새로운 영역';
        } else if (type === 'notice') {
            base.data.title = '유의사항';
            base.data.bullets = '';
        } else if (type === 'faq') {
            base.data.question = '질문을 입력하세요';
            base.data.answer = '답변 내용을 입력하세요';
        } else if (type === 'concept') {
            base.data.align = 'left';
            base.data.titleColor = 'theme';
        }
        components.push(base);
        renderEditor();
        
        setTimeout(() => {
            const editorList = document.getElementById('editorComponentList');
            if (editorList && editorList.children.length > 0) {
                const targetCard = editorList.children[editorList.children.length - 1];
                
                const scrollPos = targetCard.offsetTop - (editorList.clientHeight / 2) + (targetCard.clientHeight / 2) - 40;
                editorList.scrollTo({ top: scrollPos, behavior: 'smooth' });
                
                targetCard.style.transition = 'box-shadow 0.3s ease';
                targetCard.style.boxShadow = `0 0 0 2px ${currentThemeColor}, 0 4px 12px rgba(0,0,0,0.15)`;
                setTimeout(() => {
                    targetCard.style.boxShadow = '';
                }, 1000);
            }
        }, 50);
    }

    // --- UI Controls for Add Menu ---
    addComponentBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addMenuPopup.classList.toggle('show');
    });
    
    document.addEventListener('click', () => {
        addMenuPopup.classList.remove('show');
    });

    addMenuPopup.querySelectorAll('.add-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            addComponent(e.target.dataset.type);
        });
    });

    // --- Device Logic ---
    const deviceSelect = document.getElementById('deviceSelect');
    const previewContainer = document.getElementById('previewContainer');
    const downloadHtmlBtn = document.getElementById('downloadHtmlBtn');

    deviceSelect.addEventListener('change', (e) => {
        const [width, height] = e.target.value.split(',').map(Number);
        
        previewContainer.style.width = `${width}px`;
        previewContainer.style.height = `${height}px`;
        previewContainer.style.minHeight = `${height}px`;
        
        previewContainer.style.overflowY = 'auto';
    });
    
    // --- Export HTML Generator ---
    function generateExportHtml(mode = 'view') {
        let previewCanvasHtml = document.getElementById('previewCanvas').innerHTML;
        
        [componentsTab1, componentsTab2].forEach(arr => {
            arr.forEach(comp => {
                if (comp && comp.data) {
                    let currentUrl = '';
                    if (comp.type === 'video') currentUrl = comp.data.url;
                    if (comp.type === 'explanation') currentUrl = comp.data.imageUrl;
                    
                    if (currentUrl && currentUrl.startsWith('blob:')) {
                        if (mode === 'download' && comp.data.exportStr) {
                            previewCanvasHtml = previewCanvasHtml.split(currentUrl).join(comp.data.exportStr);
                        } else {
                            const placeholder = comp.type === 'video' ? 'https://[여기에_영상주소_입력].mp4' : 'https://[여기에_이미지주소_입력].png';
                            previewCanvasHtml = previewCanvasHtml.split(currentUrl).join(placeholder);
                        }
                    }
                }
            });
        });
        
        const currentWidth = document.getElementById('previewContainer') ? document.getElementById('previewContainer').offsetWidth : 390;
        
        return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root { --theme-color: ${currentThemeColor}; }
        body { margin: 0; padding: 0; background-color: #f0f0f0; display: flex; justify-content: center; }
        .canvas-container { width: 100%; max-width: ${currentWidth}px; background-color: white; min-height: 100vh; }
        .explanation-component { display: flex; padding: 16px 20px 0 20px; background-color: white; text-align: left; scroll-margin-top: 64px; }
        .explanation-component:not(.standalone) { padding-right: 22px; }
        .explanation-indicator { margin-right: 12px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
        .step-circle { width: 28px; height: 28px; background-color: var(--theme-color, #27a8f5); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; line-height: 1; }
        .step-line { flex: 1; width: 1px; background-color: rgba(219, 226, 240, 0.4); margin-top: 4px; min-height: 20px; }
        .explanation-content { flex: 1; min-width: 0; padding-bottom: 20px; }
        .explanation-content > *:last-child { margin-bottom: 0 !important; }
        .explanation-component.standalone .explanation-indicator { display: none; }
        .explanation-title { font-family: Pretendard, sans-serif; font-size: 18px; font-style: normal; font-weight: 400; color: #191B1E; margin: 0 0 16px 0; line-height: 26px; word-break: keep-all; }
        .explanation-image { width: 100%; height: auto; border-radius: 12px; background-color: transparent; margin-bottom: 16px; display: block; }
        .explanation-bullets { list-style: none; padding: 0; margin: 0 0 16px 0; }
        .explanation-bullets li { position: relative; padding-left: 12px; margin-bottom: 8px; font-size: 16px; font-weight: 400; font-family: Pretendard, sans-serif; color: #4b5563; line-height: 24px; word-break: keep-all; text-align: left; }
        .explanation-bullets li::before { content: ""; position: absolute; left: 0; top: 8px; width: 4px; height: 4px; background-color: #A3A8B6; border-radius: 50%; }
        .notice-bullets li::before { content: ""; position: absolute; left: 0; top: 10px; width: 4px; height: 4px; background-color: #A3A8B6; border-radius: 50%; }
        .explanation-buttons { display: flex; flex-direction: column; gap: 8px; }
        .explanation-btn { width: 100%; background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; font-size: 14px; font-weight: 600; color: #111; text-align: center; cursor: pointer; }
    </style>
</head>
<body>
    <div class="canvas-container">
        ${previewCanvasHtml}
    </div>
    <script>
        window.switchPreviewTab = function(tabNum, btn) {
            if(tabNum === 1) {
                btn.parentElement.children[0].style.borderBottomColor='#111'; 
                btn.parentElement.children[0].style.fontWeight='700'; 
                btn.parentElement.children[0].style.color='#111'; 
                btn.parentElement.children[1].style.borderBottomColor='transparent'; 
                btn.parentElement.children[1].style.fontWeight='500'; 
                btn.parentElement.children[1].style.color='#9ca3af'; 
                document.getElementById('view-tab-1').style.display='block'; 
                document.getElementById('view-tab-2').style.display='none';
            } else {
                btn.parentElement.children[0].style.borderBottomColor='transparent'; 
                btn.parentElement.children[0].style.fontWeight='500'; 
                btn.parentElement.children[0].style.color='#9ca3af'; 
                btn.parentElement.children[1].style.borderBottomColor='#111'; 
                btn.parentElement.children[1].style.fontWeight='700'; 
                btn.parentElement.children[1].style.color='#111'; 
                document.getElementById('view-tab-1').style.display='none'; 
                document.getElementById('view-tab-2').style.display='block';
            }
        };

        document.addEventListener('click', function(e) {
            var muteBtn = e.target.closest('.mute-toggle-btn');
            if (muteBtn) {
                var container = muteBtn.parentElement.parentElement;
                var video = container.querySelector('video');
                if (video) {
                    video.muted = !video.muted;
                    if (video.muted) {
                        muteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
                    } else {
                        muteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
                    }
                }
            }

            var playableVideo = e.target.closest('.playable-video');
            var videoOverlay = e.target.closest('.video-overlay');
            
            if (playableVideo) {
                var container = playableVideo.parentElement;
                var overlay = container.querySelector('.video-overlay');
                if (overlay && !playableVideo.paused) {
                    playableVideo.pause();
                    overlay.style.display = 'flex';
                }
            } else if (videoOverlay) {
                var container = videoOverlay.parentElement;
                var videoEl = container.querySelector('.playable-video');
                if (videoEl && videoEl.paused) {
                    videoEl.play();
                    videoOverlay.style.display = 'none';
                }
            }
        });
    </script>
</body>
</html>`;
    }

    // --- View Source Modal Logic ---
    const viewSourceBtn = document.getElementById('viewSourceBtn');
    const sourceModal = document.getElementById('sourceModal');
    const closeSourceModalBtn = document.getElementById('closeSourceModalBtn');
    const copySourceBtn = document.getElementById('copySourceBtn');
    const sourceCodeArea = document.getElementById('sourceCodeArea');

    if (viewSourceBtn) {
        viewSourceBtn.addEventListener('click', () => {
            const htmlContent = generateExportHtml('view');
            sourceCodeArea.value = htmlContent;
            sourceModal.style.display = 'flex';
        });
    }

    if (closeSourceModalBtn) {
        closeSourceModalBtn.addEventListener('click', () => {
            sourceModal.style.display = 'none';
        });
    }

    if (copySourceBtn) {
        copySourceBtn.addEventListener('click', () => {
            sourceCodeArea.select();
            document.execCommand('copy');
            
            const originalText = copySourceBtn.textContent;
            copySourceBtn.textContent = '복사 완료!';
            copySourceBtn.style.backgroundColor = '#10b981';
            
            setTimeout(() => {
                copySourceBtn.textContent = originalText;
                copySourceBtn.style.backgroundColor = '#27a8f5';
            }, 2000);
        });
    }

    // --- Download HTML Logic ---
    downloadHtmlBtn.addEventListener('click', () => {
        const htmlContent = generateExportHtml('download');

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'new_component_preview.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // --- Library & Modal Logic ---
    const saveScreenBtn = document.getElementById('saveScreenBtn');
    const savedScreensList = document.getElementById('savedScreensList');
    const newProjectBtn = document.getElementById('newProjectBtn');

    let currentScreenId = null;

    function formatDatePoint(dateString) {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
    }

    function renderSidebarLibraryList(list) {
        if (!savedScreensList) return;
        savedScreensList.innerHTML = '';
        
        if (!list || !Array.isArray(list) || list.length === 0) {
            savedScreensList.innerHTML = '<li style="text-align:center; padding: 32px; color:#6b7280; font-size:13px;">저장된 화면이<br>없습니다</li>';
            return;
        }
        
        const sortedList = [...list].filter(item => item && typeof item === 'object').sort((a,b) => {
            const dA = a.date ? new Date(a.date).getTime() : 0;
            const dB = b.date ? new Date(b.date).getTime() : 0;
            return (isNaN(dB) ? 0 : dB) - (isNaN(dA) ? 0 : dA);
        });
        
        if (sortedList.length === 0) {
            savedScreensList.innerHTML = '<li style="text-align:center; padding: 32px; color:#6b7280; font-size:13px;">저장된 화면이<br>없습니다</li>';
            return;
        }
        
        sortedList.forEach(item => {
            try {
                const safeId = item.id || generateId();
                const safeTitle = String(item.title || '제목 없는 화면');
                const formattedDate = formatDatePoint(item.date);
                
                const li = document.createElement('li');
                li.className = 'saved-item' + (currentScreenId === safeId ? ' active' : '');
                
                li.innerHTML = `
                    <div style="display: flex; flex-direction: column; width: 100%; gap: 6px; overflow: hidden; padding-right: 28px;">
                        <span style="color: white; font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                        <span style="color: #9ca3af; font-size: 12px; font-weight: 400;">${formattedDate}</span>
                    </div>
                    <div class="saved-item-actions">
                        <button class="lib-more-btn" title="더보기">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                        </button>
                        <div class="lib-dropdown-menu" style="display:none;">
                            <button class="lib-dropdown-btn rename-btn">제목 수정</button>
                            <button class="lib-dropdown-btn duplicate-btn">복제</button>
                            <button class="lib-dropdown-btn delete delete-btn">삭제</button>
                        </div>
                    </div>
                `;
                
                li.addEventListener('click', (e) => {
                    if (e.target.closest('.lib-more-btn') || e.target.closest('.lib-dropdown-menu')) return;
                    if (currentScreenId === safeId) return;
                    
                    StorageDB.load().then(saved => {
                        const listDb = saved || [];
                        const isPristine = isPristineProject();
                        
                        if (!isPristine) {
                            if (currentScreenId) {
                                const current = listDb.find(x => x.id === currentScreenId);
                                if (current) {
                                    current.componentsTab1 = JSON.parse(JSON.stringify(componentsTab1));
                                current.componentsTab2 = JSON.parse(JSON.stringify(componentsTab2));
                                current.tab1Name = document.getElementById('tab1NameInput') ? document.getElementById('tab1NameInput').value : '이용 가이드';
                                current.tab2Name = document.getElementById('tab2NameInput') ? document.getElementById('tab2NameInput').value : '유의사항';
                                }
                            } else {
                                listDb.push({
                                    id: generateId(),
                                    title: '[자동저장] 작업 화면 (' + new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute:'2-digit' }) + ')',
                                    date: new Date().toISOString(),
                                    componentsTab1: JSON.parse(JSON.stringify(componentsTab1)),
                                    componentsTab2: JSON.parse(JSON.stringify(componentsTab2)),
                                    tab1Name: document.getElementById('tab1NameInput') ? document.getElementById('tab1NameInput').value : '이용 가이드',
                                    tab2Name: document.getElementById('tab2NameInput') ? document.getElementById('tab2NameInput').value : '유의사항'

                                });
                            }
                            StorageDB.save(listDb);
                        }
                        
                        componentsTab1 = item.componentsTab1 || item.components || [];
                        componentsTab2 = item.componentsTab2 || [];
                        currentThemeColor = item.themeColor || '#27a8f5';
                        currentScreenId = safeId;
                        
                        const t1Input = document.getElementById('tab1NameInput');
                        const t2Input = document.getElementById('tab2NameInput');
                        if(t1Input) t1Input.value = item.tab1Name || '이용 가이드';
                        if(t2Input) t2Input.value = item.tab2Name || '유의사항';
                        
                        syncTabVisibility();
                        switchWorkspaceTab(1);
                        
                        components.forEach(comp => {
                            if (comp && comp.data && comp.data.exportStr) {
                                const blobUrl = dataURItoBlobUrl(comp.data.exportStr);
                                if (comp.type === 'video') comp.data.url = blobUrl;
                                if (comp.type === 'explanation') comp.data.imageUrl = blobUrl;
                            }
                        });
                        renderThemeSelector();
                        renderEditor();
                        renderSidebarLibraryList(listDb);
                        if (typeof showToast === 'function') showToast(safeTitle.substring(0, 15) + '... 불러왔습니다.');
                    });
                });

                const moreBtn = li.querySelector('.lib-more-btn');
                const dropdown = li.querySelector('.lib-dropdown-menu');
                const renameBtn = li.querySelector('.rename-btn');
                const duplicateBtn = li.querySelector('.duplicate-btn');
                const deleteBtn = li.querySelector('.delete-btn');

                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.lib-dropdown-menu').forEach(menu => {
                        if (menu !== dropdown) {
                            menu.style.display = 'none';
                            const parentLi = menu.closest('.saved-item');
                            if (parentLi) {
                                parentLi.style.zIndex = '';
                                parentLi.classList.remove('menu-open');
                            }
                        }
                    });
                    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
                        dropdown.style.display = 'block';
                        li.style.zIndex = '50';
                        li.classList.add('menu-open');
                        
                        const rect = moreBtn.getBoundingClientRect();
                        if (window.innerHeight - rect.bottom < 150) {
                            dropdown.style.top = 'auto';
                            dropdown.style.bottom = '32px';
                        } else {
                            dropdown.style.top = '32px';
                            dropdown.style.bottom = 'auto';
                        }
                    } else {
                        dropdown.style.display = 'none';
                        li.style.zIndex = '';
                        li.classList.remove('menu-open');
                    }
                });

                renameBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.style.display = 'none';
                    const newTitle = prompt('새 제목을 입력하세요', safeTitle);
                    if (newTitle !== null && newTitle.trim() !== '') {
                        StorageDB.load().then(currentList => {
                            const target = (currentList || []).find(x => x && x.id === safeId);
                            if (target) {
                                target.title = newTitle.trim();
                                StorageDB.save(currentList).then(() => {
                                    renderSidebarLibraryList(currentList);
                                });
                            }
                        });
                    }
                });

                duplicateBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.style.display = 'none';
                    StorageDB.load().then(currentList => {
                        const target = (currentList || []).find(x => x && x.id === safeId);
                        if (target) {
                            const newObj = JSON.parse(JSON.stringify(target));
                            newObj.id = generateId();
                            
                            let baseTitle = target.title;
                            let match = baseTitle.match(/\(복사본(\d+)\)$/);
                            if (match) {
                                baseTitle = baseTitle.replace(/\(복사본\d+\)$/, '').trim();
                                newObj.title = baseTitle + ' (복사본' + (parseInt(match[1]) + 1) + ')';
                            } else if (baseTitle.endsWith('(복사본)')) {
                                baseTitle = baseTitle.replace(/\(복사본\)$/, '').trim();
                                newObj.title = baseTitle + ' (복사본1)';
                            } else {
                                newObj.title = baseTitle + ' (복사본1)';
                            }
                            
                            newObj.date = new Date().toISOString();
                            currentList.push(newObj);
                            StorageDB.save(currentList).then(() => {
                                renderSidebarLibraryList(currentList);
                            });
                        }
                    });
                });

                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.style.display = 'none';
                    if (confirm('휴지통으로 이동하시겠습니까?')) {
                        StorageDB.load().then(currentList => {
                            const target = (currentList || []).find(x => x && x.id === safeId);
                            const updated = (currentList || []).filter(x => x && x.id !== safeId);
                            if (target) {
                                StorageTrash.load().then(trashList => {
                                    trashList.push(target);
                                    StorageTrash.save(trashList).then(() => {
                                        StorageDB.save(updated).then(() => {
                                            if (currentScreenId === safeId) currentScreenId = null;
                                            renderSidebarLibraryList(updated);
                                            if (typeof renderTrashList === 'function') renderTrashList();
                                        });
                                    });
                                });
                            }
                        });
                    }
                });

                savedScreensList.appendChild(li);
            } catch (err) {
                console.error("Failed to render a sidebar item:", err, item);
            }
        });
    }

    function renderSidebarLibrary() {
        StorageDB.load().then(saved => {
            renderSidebarLibraryList(saved || []);
        });
    }

    function renderTrashList() {
        const listEl = document.getElementById('trashScreensList');
        if (!listEl) return;
        
        StorageTrash.load().then(trash => {
            listEl.innerHTML = '';
            
            if (!trash || trash.length === 0) {
                listEl.innerHTML = '<li style="color: #6b7280; font-size: 12px; text-align: center; padding: 12px 0;">휴지통이 비어있습니다.</li>';
                return;
            }
            
            trash.forEach(screen => {
                const li = document.createElement('li');
                li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #374151; border-radius: 6px; margin-bottom: 6px;';
                
                const titleSpan = document.createElement('span');
                titleSpan.textContent = screen.title;
                titleSpan.style.cssText = 'color: #d1d5db; font-size: 12px; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px;';
                titleSpan.title = screen.title;
                
                const actionDiv = document.createElement('div');
                actionDiv.style.cssText = 'display: flex; gap: 6px; align-items: center;';
                
                const restoreBtn = document.createElement('button');
                restoreBtn.textContent = '복원';
                restoreBtn.title = '리스트로 복원';
                restoreBtn.style.cssText = 'background: #4b5563; color: #fff; border: 1px solid #6b7280; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; transition: background 0.2s;';
                restoreBtn.onmouseover = () => restoreBtn.style.background = '#6b7280';
                restoreBtn.onmouseout = () => restoreBtn.style.background = '#4b5563';
                restoreBtn.onclick = () => {
                    StorageTrash.load().then(currentTrash => {
                        const target = currentTrash.find(x => x && x.id === screen.id);
                        const updatedTrash = currentTrash.filter(x => x && x.id !== screen.id);
                        if (target) {
                            StorageDB.load().then(mainDb => {
                                const db = mainDb || [];
                                db.push(target);
                                StorageDB.save(db).then(() => {
                                    StorageTrash.save(updatedTrash).then(() => {
                                        renderSidebarLibraryList(db);
                                        renderTrashList();
                                    });
                                });
                            });
                        }
                    });
                };
                
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>';
                deleteBtn.title = '영구 삭제';
                deleteBtn.style.cssText = 'background: #ef4444; color: white; border: none; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0.8; transition: opacity 0.2s;';
                deleteBtn.onmouseover = () => deleteBtn.style.opacity = '1';
                deleteBtn.onmouseout = () => deleteBtn.style.opacity = '0.8';
                deleteBtn.onclick = () => {
                    if (confirm('영구 삭제하면 다시는 되돌릴 수 없습니다.\\n정확히 지우시겠습니까?')) {
                        StorageTrash.load().then(currentTrash => {
                            const updatedTrash = currentTrash.filter(x => x && x.id !== screen.id);
                            StorageTrash.save(updatedTrash).then(() => renderTrashList());
                        });
                    }
                };
                
                actionDiv.appendChild(restoreBtn);
                actionDiv.appendChild(deleteBtn);
                
                li.appendChild(titleSpan);
                li.appendChild(actionDiv);
                
                listEl.appendChild(li);
            });
        });
    }

    const emptyTrashBtn = document.getElementById('emptyTrashBtn');
    if (emptyTrashBtn) {
        emptyTrashBtn.addEventListener('click', () => {
            StorageTrash.load().then(trash => {
                if (!trash || trash.length === 0) return alert('이미 휴지통이 비어있습니다.');
                if (confirm('휴지통을 모두 비우시겠습니까?\\n이 작업은 원래대로 복구할 수 없습니다!')) {
                    StorageTrash.save([]).then(() => renderTrashList());
                }
            });
        });
    }

    // --- Helper: Custom Toast ---
    function showToast(msg) {
        let toast = document.getElementById('fusionToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'fusionToast';
            toast.style.position = 'fixed';
            toast.style.bottom = '40px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = 'rgba(26, 26, 26, 0.9)';
            toast.style.color = '#fff';
            toast.style.padding = '12px 24px';
            toast.style.borderRadius = '30px';
            toast.style.fontSize = '14px';
            toast.style.fontWeight = '600';
            toast.style.zIndex = '9999';
            toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s, transform 0.3s';
            toast.style.backdropFilter = 'blur(4px)';
            document.body.appendChild(toast);
        }
        
        toast.textContent = msg;
        
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
        }, 10);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%)';
        }, 2200);
    }

    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', () => {
            if (document.getElementById('newProjectInput')) return;
            
            const savedScreensList = document.getElementById('savedScreensList');
            if (!savedScreensList) return;
            
            const li = document.createElement('li');
            li.className = 'saved-item active';
            li.innerHTML = `
                <div style="display: flex; flex-direction: column; width: 100%; gap: 6px;">
                    <input type="text" id="newProjectInput" placeholder="프로젝트 이름 입력..." style="width: 100%; background: transparent; border: none; color: white; padding: 0; font-size: 15px; font-weight: 700; outline: none;">
                    <span style="color: #9ca3af; font-size: 12px; font-weight: 400;">${formatDatePoint(new Date().toISOString())}</span>
                </div>
            `;
            
            if (savedScreensList.children.length === 1 && savedScreensList.firstElementChild.textContent.includes('없습니다')) {
                savedScreensList.innerHTML = '';
            }
            
            if (savedScreensList.firstChild) {
                savedScreensList.insertBefore(li, savedScreensList.firstChild);
            } else {
                savedScreensList.appendChild(li);
            }
            
            const input = document.getElementById('newProjectInput');
            input.focus();
            
            let finalized = false;
            
            const finalizeCreation = () => {
                if (finalized) return;
                finalized = true;
                
                const title = input.value.trim() || '새 화면 (' + new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute:'2-digit' }) + ')';
                
                StorageDB.load().then(saved => {
                    const list = saved || [];
                    const isPristine = isPristineProject();
                    
                    if (!isPristine) {
                        if (currentScreenId) {
                            const current = list.find(x => x.id === currentScreenId);
                            if (current) {
                                current.componentsTab1 = JSON.parse(JSON.stringify(componentsTab1));
                                current.componentsTab2 = JSON.parse(JSON.stringify(componentsTab2));
                                current.tab1Name = document.getElementById('tab1NameInput') ? document.getElementById('tab1NameInput').value : '이용 가이드';
                                current.tab2Name = document.getElementById('tab2NameInput') ? document.getElementById('tab2NameInput').value : '유의사항';
                                current.date = new Date().toISOString();
                            }
                        } else {
                            list.push({
                                id: generateId(),
                                title: '[자동저장] 작업 화면 (' + new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute:'2-digit' }) + ')',
                                date: new Date().toISOString(),
                                themeColor: currentThemeColor,
                                componentsTab1: JSON.parse(JSON.stringify(componentsTab1)),
                                    componentsTab2: JSON.parse(JSON.stringify(componentsTab2)),
                                    tab1Name: document.getElementById('tab1NameInput') ? document.getElementById('tab1NameInput').value : '이용 가이드',
                                    tab2Name: document.getElementById('tab2NameInput') ? document.getElementById('tab2NameInput').value : '유의사항'

                            });
                        }
                    }
                    
                    componentsTab1 = [];
                    componentsTab2 = [];
                    currentThemeColor = THEMES[0] || '#27a8f5';
                    renderThemeSelector();
                    
                    syncTabVisibility();
                    switchWorkspaceTab(1);
                    const t1Input = document.getElementById('tab1NameInput');
                    const t2Input = document.getElementById('tab2NameInput');
                    if(t1Input) t1Input.value = '이용 가이드';
                    if(t2Input) t2Input.value = '유의사항';
                    
                    // Default starting components
                    addComponent('video');
                    addComponent('title');
                    addComponent('explanation');
                    
                    const newItem = {
                        id: generateId(),
                        title: title,
                        date: new Date().toISOString(),
                        themeColor: currentThemeColor,
                        componentsTab1: JSON.parse(JSON.stringify(componentsTab1)),
                        componentsTab2: JSON.parse(JSON.stringify(componentsTab2)),
                        tab1Name: '이용 가이드',
                        tab2Name: '유의사항'
                    };
                    
                    list.push(newItem);
                    currentScreenId = newItem.id;
                    
                    StorageDB.save(list).then(() => {
                        renderSidebarLibraryList(list);
                        showToast(`'${title}' 프로젝트가 시작되었습니다 ✨`);
                    });
                });
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (input.value.trim() === '') {
                        finalized = true;
                        li.remove();
                        if (savedScreensList.children.length === 0) renderSidebarLibrary();
                    } else {
                        finalizeCreation();
                    }
                } else if (e.key === 'Escape') {
                    finalized = true;
                    li.remove();
                    if (savedScreensList.children.length === 0) renderSidebarLibrary();
                }
            });
            
            input.addEventListener('blur', () => {
                if (!finalized) {
                    if (input.value.trim() !== '') {
                        finalizeCreation();
                    } else {
                        finalized = true;
                        li.remove();
                        if (savedScreensList.children.length === 0) renderSidebarLibrary();
                    }
                }
            });
        });
    }

    if (saveScreenBtn) {
        saveScreenBtn.addEventListener('click', () => {
            StorageDB.load().then(saved => {
                const list = saved || [];
                
                if (currentScreenId) {
                    const current = list.find(x => x.id === currentScreenId);
                    if (current) {
                        current.componentsTab1 = JSON.parse(JSON.stringify(componentsTab1));
                        current.componentsTab2 = JSON.parse(JSON.stringify(componentsTab2));
                        current.tab1Name = document.getElementById('tab1NameInput') ? document.getElementById('tab1NameInput').value : '이용 가이드';
                        current.tab2Name = document.getElementById('tab2NameInput') ? document.getElementById('tab2NameInput').value : '유의사항';
                        current.themeColor = currentThemeColor;
                        current.date = new Date().toISOString();
                    } else {
                        // Item was lost due to sync race conditions or overwritten by another user, recreate it:
                        const newItem = {
                            id: currentScreenId,
                            title: '내 화면 (' + new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute:'2-digit' }) + ')',
                            date: new Date().toISOString(),
                            themeColor: currentThemeColor,
                            componentsTab1: JSON.parse(JSON.stringify(componentsTab1)),
                            componentsTab2: JSON.parse(JSON.stringify(componentsTab2)),
                            tab1Name: document.getElementById('tab1NameInput') ? document.getElementById('tab1NameInput').value : '이용 가이드',
                            tab2Name: document.getElementById('tab2NameInput') ? document.getElementById('tab2NameInput').value : '유의사항'
                        };
                        list.push(newItem);
                    }
                } else {
                    const newItem = {
                        id: generateId(),
                        title: '내 화면 (' + new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute:'2-digit' }) + ')',
                        date: new Date().toISOString(),
                        themeColor: currentThemeColor,
                        componentsTab1: JSON.parse(JSON.stringify(componentsTab1)),
                        componentsTab2: JSON.parse(JSON.stringify(componentsTab2)),
                        tab1Name: document.getElementById('tab1NameInput') ? document.getElementById('tab1NameInput').value : '이용 가이드',
                        tab2Name: document.getElementById('tab2NameInput') ? document.getElementById('tab2NameInput').value : '유의사항'
                    };
                    list.push(newItem);
                    currentScreenId = newItem.id;
                }
                
                StorageDB.save(list).then(() => {
                    renderSidebarLibraryList(list);
                    showToast('성공적으로 저장되었습니다! 💾');
                }).catch(e => {
                    console.error(e);
                    showToast('저장 중 오류가 발생했습니다 🚫');
                });
            });
        });
    }

    // --- Initialization ---
    StorageDB.init().then(() => {
        executeLocalMigration();
        renderThemeSelector();
        renderSidebarLibrary();
        renderTrashList();
        addComponent('video');
        addComponent('title');
        addComponent('explanation');
        if (window.syncTabVisibility) window.syncTabVisibility();
        deviceSelect.dispatchEvent(new Event('change'));
    }).catch(e => {
        console.error("DB Init Failed", e);
        renderThemeSelector();
        addComponent('video');
        addComponent('title');
        addComponent('explanation');
        if (window.syncTabVisibility) window.syncTabVisibility();
        deviceSelect.dispatchEvent(new Event('change'));
    });
});
