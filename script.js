window.switchPreviewTab = function(tabNum, btn) {
    if(tabNum === 1) {
        btn.parentElement.children[0].style.borderBottomColor='#000'; 
        btn.parentElement.children[0].style.fontWeight='700'; 
        btn.parentElement.children[0].style.color='#000'; 
        btn.parentElement.children[1].style.borderBottomColor='transparent'; 
        btn.parentElement.children[1].style.fontWeight='500'; 
        btn.parentElement.children[1].style.color='#6B7280'; 
        document.getElementById('view-tab-1').style.display='block'; 
        document.getElementById('view-tab-2').style.display='none';
    } else {
        btn.parentElement.children[0].style.borderBottomColor='transparent'; 
        btn.parentElement.children[0].style.fontWeight='500'; 
        btn.parentElement.children[0].style.color='#6B7280'; 
        btn.parentElement.children[1].style.borderBottomColor='#000'; 
        btn.parentElement.children[1].style.fontWeight='700'; 
        btn.parentElement.children[1].style.color='#000'; 
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
                    return []; 
                });
        },
        save(data) {
            return fetch(API_BASE + '?key=workspace_components', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data || [])
            }).then(res => res.json()).catch(err => { console.error('Sync Error', err); return Promise.resolve(); });
        }
    };

    const StorageTrash = {
        load() {
            return fetch(API_BASE + '?key=workspace_trash', {
                headers: { 'Cache-Control': 'no-cache' }
            })
                .then(res => res.ok ? res.json() : [])
                .catch(err => []);
        },
        save(data) {
            return fetch(API_BASE + '?key=workspace_trash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data || [])
            }).then(res => res.json()).catch(err => Promise.resolve());
        }
    };

    function executeLocalMigration() {
        // Only run once if local data exists and needs to go to cloud
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
    let currentThemeColor = '#23B6FF';

        const THEMES = ['#23B6FF', '#FF7171', '#5FD289', '#F7B52C', '#707BEB'];

    function renderThemeSelector() {
        const container = document.getElementById('themeColorSelector');
        if(!container) return;
        container.innerHTML = '';
        
        if (currentThemeColor === '#27a8f5' || !THEMES.includes(currentThemeColor)) {
            currentThemeColor = THEMES[0];
        }

        THEMES.forEach(color => {
            const btn = document.createElement('button');
            const isSelected = currentThemeColor === color;
            btn.style.cssText = `width: 32px; height: 32px; border-radius: 50%; background-color: ${color}; border: 2px solid ${isSelected ? '#000' : 'transparent'}; cursor: pointer; transition: all 0.2s; outline: ${isSelected ? '2px solid #FFFFFF' : 'none'}; outline-offset: -4px; padding:0;`;
            btn.onclick = () => {
                currentThemeColor = color;
                renderThemeSelector();
                renderPreview();
            };
            container.appendChild(btn);
        });
        document.documentElement.style.setProperty('--theme-color', currentThemeColor);
    }
    
    // Default fallback handling
    if (!currentThemeColor || currentThemeColor === '#27a8f5' || currentThemeColor === '#27a8f5') {
        currentThemeColor = THEMES[0];
    }
    document.documentElement.style.setProperty('--theme-color', currentThemeColor);
    renderThemeSelector();


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
            tab1Btn.style.color = '#000';
            tab1Btn.style.borderBottomColor = '#000';
            tab2Btn.style.fontWeight = '500';
            tab2Btn.style.color = '#6B7280';
            tab2Btn.style.borderBottomColor = 'transparent';
            tab1Menu.style.display = 'block';
            tab2Menu.style.display = 'none';
        } else {
            tab1Btn.style.fontWeight = '500';
            tab1Btn.style.color = '#6B7280';
            tab1Btn.style.borderBottomColor = 'transparent';
            tab2Btn.style.fontWeight = '700';
            tab2Btn.style.color = '#000';
            tab2Btn.style.borderBottomColor = '#000';
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
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                <span class="file-upload-text" style="font-size: 13px; color: #6B7280; font-weight: 500;">내 컴퓨터에서 영상 업로드 (.mp4)</span>
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
                const currentAlign = comp.data.align || 'center';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
                        <label style="margin: 0; padding-bottom: 4px;">텍스트 정렬 설정</label>
                        <div class="segmented-control align-toggle-control" style="background: #FFFFFF; border: 1px solid #E5E7EB; padding: 2px;">
                            <button class="seg-btn ${currentAlign !== 'center' ? 'active' : ''}" data-val="left" style="font-size: 13px; padding: 6px 12px;">좌측</button>
                            <button class="seg-btn ${currentAlign === 'center' ? 'active' : ''}" data-val="center" style="font-size: 13px; padding: 6px 12px;">중앙</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>서브타이틀</label>
                        <textarea class="bind-area" data-field="subtitle" rows="2" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #E5E7EB; font-size: 14px; color: #000; font-family: inherit; resize: vertical; outline: none;">${(comp.data.subtitle || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>메인타이틀 (줄바꿈: 엔터, 테마컬러 강조: *텍스트*)</label>
                        <textarea class="bind-area" data-field="mainTitle" rows="3" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #E5E7EB; font-size: 14px; color: #000; font-family: inherit; resize: vertical; outline: none;"></textarea>
                    </div>
                `;
            } else if (comp.type === 'explanation') {
                card.innerHTML = `
                    <div class="form-group badge-settings-container">
                        <label>뱃지 텍스트 (옵션)</label>
                        <input type="text" class="bind-txt" data-field="badgeText" placeholder="예: 첫번째 방법">
                    </div>
                    <div class="form-group">
                        <label>타이틀 (옵션)</label>
                        <textarea class="bind-area" data-field="title" placeholder="항목을 입력해주세요. (엔터로 줄바꿈, *태그로 강조 표기 가능)" rows="2" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #E5E7EB; font-size: 14px; color: #000; font-family: inherit; resize: vertical; outline: none;">${(comp.data.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                    <div class="form-group">
                        <label style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
                            <span>이미지 (옵션)</span>
                        </label>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div class="input-with-actions" style="display: flex; gap: 8px;">
                                <input type="text" class="bind-txt" data-field="imageUrl" placeholder="https://..." style="flex: 1;">
                            </div>
                            <div class="file-upload-wrapper exp-file-upload-wrapper">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                <span class="exp-file-upload-text" style="font-size: 13px; color: #6B7280; font-weight: 500;">내 컴퓨터에서 이미지 업로드 (.png, .jpg)</span>
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
                                    <div style="width: 4px; height: 4px; background-color: #6B7280; border-radius: 50%; flex-shrink: 0; margin: 15px 4px 0 4px;"></div>
                                    <textarea class="bind-bullet-txt" placeholder="항목을 입력해주세요. (엔터로 줄바꿈)" rows="2" style="flex: 1; min-width: 0; border-radius: 8px; padding: 10px 14px; border: 1px solid #E5E7EB; font-size: 14px; color: #000; font-family: inherit; resize: vertical; outline: none;">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                                    <button class="action-btn remove-bullet-btn" style="padding: 0; width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; color: #ef4444; margin-top: 2px;" title="삭제">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            `).join('')}
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
                                    <div style="width: 4px; height: 4px; background-color: #6B7280; border-radius: 50%; flex-shrink: 0; margin: 0 4px;"></div>
                                    <input type="text" class="bind-tab-name" value="${tab.name.replace(/"/g, '&quot;')}" placeholder="항목을 입력해주세요." style="flex: 1; min-width: 0; border-radius: 8px; padding: 10px 14px; border: 1px solid #E5E7EB; font-size: 14px; color: #000;">
                                    <select class="bind-tab-target" style="width: 140px; border-radius: 8px; padding: 9px 32px 9px 12px; border: 1px solid #E5E7EB; font-size: 13px; color: #000; box-sizing: border-box; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                                        <option value="">대상 선택...</option>
                                        ${components.filter(c => c.id !== comp.id).map(c => `<option value="${c.id}" ${tab.targetStep === c.id ? 'selected' : ''}>${getComponentLabel(c).replace(/"/g, '&quot;')}</option>`).join('')}
                                    </select>
                                    <button class="action-btn remove-tab-btn" style="padding: 0; width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; color: #ef4444;" title="삭제">
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
                        <div class="segmented-control align-toggle-control" style="background: #FFFFFF; border: 1px solid #E5E7EB; padding: 2px;">
                            <button class="seg-btn ${currentAlign !== 'center' ? 'active' : ''}" data-val="left" style="font-size: 13px; padding: 6px 12px;">좌측</button>
                            <button class="seg-btn ${currentAlign === 'center' ? 'active' : ''}" data-val="center" style="font-size: 13px; padding: 6px 12px;">중앙</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>타이틀 (옵션)</label>
                        <textarea class="bind-area" data-field="title" placeholder="항목을 입력해주세요." rows="2" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #E5E7EB; font-size: 14px; color: #000; font-family: inherit; resize: vertical; outline: none;">${(comp.data.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>본문 내용 (필수)</label>
                        <textarea class="bind-area" data-field="bodyText" placeholder="항목을 입력해주세요. (엔터로 줄바꿈, <b>태그로 굵게 표기 가능)" rows="3" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #E5E7EB; font-size: 14px; color: #000; font-family: inherit; resize: vertical; outline: none;">${(comp.data.bodyText || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
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
                    <div style="padding:16px; background-color:#F9FAFB; border-radius:8px; margin-bottom:12px; color:#1e40af; font-size:13px; line-height:1.5;">
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
                        <textarea class="bind-area" data-field="question" placeholder="항목을 입력해주세요. (엔터로 줄바꿈 가능)" rows="2" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #E5E7EB; font-size: 14px; color: #000; font-family: inherit; resize: vertical; outline: none;">${(comp.data.question || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>답변 내용 (A) (필수)</label>
                        <textarea class="bind-area" data-field="answer" placeholder="항목을 입력해주세요. (엔터로 줄바꿈 가능)" rows="4" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #E5E7EB; font-size: 14px; color: #000; font-family: inherit; resize: vertical; outline: none;">${(comp.data.answer || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
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
                        <textarea class="bind-area" data-field="bullets" placeholder="항목을 입력해주세요. (엔터로 줄바꿈 가능)" rows="5" style="width: 100%; border-radius: 8px; padding: 10px 14px; border: 1px solid #E5E7EB; font-size: 14px; color: #000; font-family: inherit; resize: vertical; outline: none;">${(comp.data.bullets || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                    <div class="form-group" style="margin-top: 12px; display: flex; align-items: center; justify-content: flex-start; gap: 12px;">
                        <label style="margin: 0; font-size: 13px; color: #6B7280; font-weight: 500;">회색 배경 표시</label>
                        <label class="switch">
                            <input type="checkbox" class="bind-chk" data-field="useBg">
                            <span class="slider round"></span>
                        </label>
                    </div>
                `;
            }
            
            // Visibility Toggle (Common)
            const toggleWrapper = document.createElement('div');
            toggleWrapper.className = 'form-group flex-row';
            toggleWrapper.style.marginBottom = '0';
            toggleWrapper.style.marginTop = '16px';
            toggleWrapper.style.paddingTop = '16px';
            toggleWrapper.style.borderTop = '1px solid #F9FAFB';
            toggleWrapper.style.justifyContent = 'flex-end';
            toggleWrapper.style.gap = '12px';
            
            toggleWrapper.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <label style="margin: 0; font-size: 13px; color: #6B7280; font-weight: 500;">컴포넌트 노출 여부</label>
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
                    const field = inp.dataset.field;
                    if (field === 'url' || field === 'imageUrl' || field === 'moreLink' || field === 'btn1Link' || field === 'btn2Link') {
                        comp.data[field] = e.target.value.trim();
                    } else {
                        comp.data[field] = e.target.value;
                    }
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
                if (inp.dataset.field === 'useBg' && comp.data.useBg === undefined) {
                    comp.data.useBg = true;
                }
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
                        <div style="width: 4px; height: 4px; background-color: #6B7280; border-radius: 50%; flex-shrink: 0; margin: 15px 4px 0 4px;"></div>
                        <textarea class="bind-bullet-txt" placeholder="항목을 입력해주세요. (엔터로 줄바꿈 가능)" rows="2" style="flex: 1; min-width: 0; border-radius: 8px; padding: 10px 14px; border: 1px solid #E5E7EB; font-size: 14px; color: #000; font-family: inherit; resize: vertical; outline: none;"></textarea>
                        <button class="action-btn remove-bullet-btn" style="padding: 0; width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; color: #ef4444; margin-top: 2px;" title="삭제">
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
            header.querySelector('.move-up').addEventListener('click', () => moveComponent(comp.id, -1));
            header.querySelector('.move-down').addEventListener('click', () => moveComponent(comp.id, 1));
            header.querySelector('.delete-btn').addEventListener('click', () => deleteComponent(comp.id));

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
                        <div style="width: 4px; height: 4px; background-color: #6B7280; border-radius: 50%; flex-shrink: 0; margin: 0 4px;"></div>
                        <input type="text" class="bind-tab-name" value="" placeholder="항목을 입력해주세요." style="flex: 1; min-width: 0; border-radius: 8px; padding: 10px 14px; border: 1px solid #E5E7EB; font-size: 14px; color: #000;">
                        <select class="bind-tab-target" style="width: 140px; border-radius: 8px; padding: 9px 32px 9px 12px; border: 1px solid #E5E7EB; font-size: 13px; color: #000; box-sizing: border-box; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                            <option value="" selected>대상 선택...</option>
                            ${components.filter(c => c.id !== comp.id).map(c => `<option value="${c.id}">${getComponentLabel(c).replace(/"/g, '&quot;')}</option>`).join('')}
                        </select>
                        <button class="action-btn remove-tab-btn" style="padding: 0; width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; color: #ef4444;" title="삭제">
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
                            uploadText.style.color = '#000';
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
                            uploadText.style.color = '#000';
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
    
    let autoSaveTimeout = null;
    let isAutoSaving = false;

    function silentAutoSave() {
        if(isAutoSaving) return;
        if(!currentScreenId) return; // ONLY save if we are editing an EXISTING screen!

        isAutoSaving = true;
        
        StorageDB.load().then(saved => {
            let list = saved || [];
            const current = list.find(x => x.id === currentScreenId);
            
            if (current) {
                current.componentsTab1 = JSON.parse(JSON.stringify(componentsTab1));
                current.componentsTab2 = JSON.parse(JSON.stringify(componentsTab2));
                current.tab1Name = document.getElementById('tab1NameInput') ? document.getElementById('tab1NameInput').value : '이용 가이드';
                current.tab2Name = document.getElementById('tab2NameInput') ? document.getElementById('tab2NameInput').value : '유의사항';
                current.themeColor = currentThemeColor;
                current.date = new Date().toISOString();
                
                const payloadSize = new Blob([JSON.stringify(list)]).size;
                if (payloadSize > 800000) { 
                    isAutoSaving = false;
                    return; 
                }
                
                StorageDB.save(list).then(() => {
                    renderSidebarLibraryList(list);
                    isAutoSaving = false;
                }).catch(() => { isAutoSaving = false; });
            } else {
                isAutoSaving = false;
            }
        }).catch(() => { isAutoSaving = false; });
    }

    function triggerAutoSave() {
        if(autoSaveTimeout) clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            silentAutoSave();
        }, 1500); // 1.5 seconds debounce
    }

    // --- Render Preview ---

    
function generateComponentHtml(comp, index, components, isExport = false, currentThemeColor = '#23B6FF') {
        let html = '';
        const safeText = (txt) => txt ? txt.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>').replace(/\n/g, '<br>') : '';
        const themeSpan = (txt) => safeText(txt).replace(/\*(.*?)\*/g, '<strong>$1</strong>');

        if (comp.type === 'video') {
            if (comp.data.url) {
                html = `
<div style="width: 100%; aspect-ratio: 16 / 9; background-color: rgb(229, 231, 235); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;">
    <div id="comp_${comp.id}" style="position: absolute; top: -50px; visibility: hidden; pointer-events: none;"></div>
    <video src="${comp.data.url}" class="playable-video" style="width: 100%; height: 100%; object-fit: cover; display: block; cursor: pointer;" autoplay loop muted playsinline></video>
    <div class="video-overlay" style="position: absolute; top:0; left:0; right:0; bottom:0; background-color: rgba(0,0,0,0.1); display: none; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto; z-index: 5;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
    </div>
    <div style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: flex-end; padding: 16px 12px 16px; pointer-events: none; z-index: 10;">
        <button class="mute-toggle-btn" style="width: 32px; height: 32px; border-radius: 50%; background-color: rgba(25,27,30,0.3); border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; cursor: pointer; color: #FFFFFF; padding: 0; pointer-events: auto; backdrop-filter: blur(4px);">
            <svg class="icon-mute" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"></path>
            </svg>
            <svg class="icon-unmute" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path>
            </svg>
        </button>
    </div>
</div>
                `;
            } else {
                html = `<span style="font-size: 15px; font-weight: 500;">(영상 컴포넌트)</span>`;
            }
        } else if (comp.type === 'title') {
            const align = comp.data.align || 'center';
            const alignItems = align === 'left' ? 'flex-start' : 'center';
            const subTitle = comp.data.subtitle ? `<p class="sub-txt" style="margin: 0 0 6px 0; padding: 0; text-indent: 0; color: var(--font-neutral-6, #6B7280); font-size: 16px; line-height: 24px;">${safeText(comp.data.subtitle)}</p>` : '';
            
            let mTitleText = safeText(comp.data.mainTitle);
            mTitleText = mTitleText.replace(/\*(.*?)\*/g, `<span style="color: ${currentThemeColor};">$1</span>`);
            
            const mainTitle = comp.data.mainTitle ? `<h2 class="tit" style="margin: 0; padding: 0; text-indent: 0; color: var(--font-neutral-2, #111827); font-size: 28px; line-height: 36px; font-weight: 700; word-break: keep-all;">${mTitleText}</h2>` : '';
            
            html = `
                <div class="top-tit-wrap" style="margin-top: 40px; padding: 0 20px; display: flex; flex-direction: column; align-items: ${alignItems}; text-align: ${align}; box-sizing: border-box; width: 100%;">
                    ${subTitle}
                    ${mainTitle}
                </div>
            `;
        } else if (comp.type === 'concept') {
            const titleHtml = comp.data.title ? `<h4 class="concept-banner-title">${safeText(comp.data.title)}</h4>` : '';
            const bodyHtml = comp.data.bodyText ? `<p>${safeText(comp.data.bodyText)}</p>` : '';
            let btnHtml = '';
            if (comp.data.buttonText) {
                const linkAttr = comp.data.buttonUrl ? `onclick="window.open('${comp.data.buttonUrl}', '_blank')"` : '';
                btnHtml = `
                <div class="btn-wrap">
                    <button type="button" class="btn-outline full has-arr" ${linkAttr}><span>${safeText(comp.data.buttonText)}</span></button>
                </div>`;
            }
            html = `
                <div class="concept-banner-component">
                    ${titleHtml}
                    ${bodyHtml}
                    ${btnHtml}
                </div>
            `;
        } else if (comp.type === 'tabs') {
            const tabsHtml = (comp.data.tabList || []).map((tab, i) => {
                const preventStr = isExport ? '' : 'event.preventDefault(); ';
                const scrollLogic = isExport 
                    ? '' 
                    : `onclick="${preventStr}const p = document.getElementById('preview-${tab.targetStep}'); if(p) p.scrollIntoView({behavior: 'smooth', block: 'start'}); const wrap = this.closest('.tabs-wrap'); if(wrap) Array.from(wrap.children).forEach(c=>c.classList.remove('active')); this.classList.add('active');"`;
                const hrf = isExport ? '#' : '#';
                return `<a href="${hrf}" class="tab-linker ${i === 0 ? 'active' : ''}" ${scrollLogic}>${safeText(tab.name)}</a>`;
            }).join('');
            html = `
                <div class="tabs-container fixed-top">
                    <div class="tabs-wrap">
                        ${tabsHtml}
                    </div>
                </div>
            `;
        } else if (comp.type === 'explanation') {
            const wrapperClass = 'explanation-component center';

            let badgeHtml = '';
            if (comp.data.badgeText) {
                badgeHtml = `<div class="badge" style="padding: 4px 16px; margin: 10px auto 16px; border-radius: 9999px; background-color: ${currentThemeColor}; color: #FFFFFF; font-size: 14px; font-weight: 700; line-height: 20px; text-align: center; display: inline-block;">${safeText(comp.data.badgeText)}</div>`;
            }
            
            const formatExplanationTitle = (txt) => {
                if(!txt) return '';
                let s = safeText(txt);
                s = s.replace(/&lt;b&gt;/gi, '<strong>').replace(/&lt;\/b&gt;/gi, '</strong>');
                s = s.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
                return s;
            };

            const titleHtml = comp.data.title ? `<h3 class="explanation-title" style="margin: 0 0 16px 0; padding: 0; text-align: center; color: var(--font-neutral-2, #111827); font-size: 20px; line-height: 28px; font-weight: 400; word-break: keep-all;" ${isExport ? `id="${comp.id}"` : ''}>${formatExplanationTitle(comp.data.title)}</h3>` : '';
            const imgHtml = comp.data.imageUrl ? `<div class="explanation-image-wrap" style="width: 100%; margin-bottom: 16px; display: flex; justify-content: center;"><img src="${comp.data.imageUrl}" alt="" style="width: 100%; height: auto; display: block; border-radius: 12px;"></div>` : '';

            let bulletsHtml = '';
            const bList = comp.data.bulletList || (comp.data.bullets ? comp.data.bullets.split('\n') : []);
            if (bList.length > 0) {
                const lis = bList.filter(b => b.trim() !== '').map(line => {
                    let t = line.trim().replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
                    t = t.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
                    const openB = (t.match(/<strong(?![a-zA-Z])/gi) || []).length;
                    const closeB = (t.match(/<\/strong>/gi) || []).length;
                    if (openB > closeB) t += '</strong>'.repeat(openB - closeB);
                    return `<li>${t}</li>`;
                }).join('');
                if(lis) bulletsHtml = `<ul class="explanation-bullets">${lis}</ul>`;
            }

            html = `
                <div class="${wrapperClass}" style="display: flex; flex-direction: column; align-items: center; width: 100%; padding: 0 20px; margin-top: 24px; box-sizing: border-box;">
                    ${badgeHtml}
                    ${titleHtml}
                    ${imgHtml}
                    ${bulletsHtml}
                </div>
            `;
        } else if (comp.type === 'notice') {
            const showBg = comp.data.useBg !== false;
            const titleHtml = comp.data.title || '유의사항';
            let bulletsHtml = '';
            const bList = comp.data.bulletList || (comp.data.bullets ? comp.data.bullets.split('\n') : []);
            if (bList.length > 0) {
                const lis = bList.filter(b => b.trim() !== '').map(line => `<li>${safeText(line)}</li>`).join('');
                if(lis) bulletsHtml = `<ul class="list--dot">${lis}</ul>`;
            }

            html = `
                <div class="notice-component acc-wrap${showBg ? ' bg-gray' : ''}">
                    <div class="acc-item no-toggle">
                        <div class="acc-header">${safeText(titleHtml)}</div>
                        <div class="acc-cont show">
                            ${bulletsHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        return html;
    }

    function renderPreview() {
        const previewCanvas = document.getElementById('previewCanvas');
        if (!previewCanvas) return;
        
        previewCanvas.innerHTML = `
            <header class="renew21--header" style="height: 56px; display: flex; align-items: center; background: #fff; border-bottom: 1px solid #f3f4f6; padding-left: 20px; box-sizing: border-box; position: sticky; top: 0; z-index: 50; width: 100%;">
                <a href="javascript:void(0);" class="btn-back" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: flex-start; text-decoration: none; flex-shrink: 0; margin-right: 0; cursor: default;">
                    <img src="https://cdn.paybooc.co.kr/static/assets/images/comm/ico-back.svg" alt="뒤로가기" style="width: 24px; height: 24px;">
                </a>
                <h1 class="tit" style="font-size: 18px; font-weight: 700; line-height: 26px; margin: 0; color: #111827; text-align: left;">이용방법</h1>
            </header>
        `;
        if (componentsTab1.length === 0 && componentsTab2.length === 0) {
            previewCanvas.innerHTML = '<div style="flex:1; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:16px;">미리보기 영역</div>';
            return;
        }

        [componentsTab1, componentsTab2].forEach((compList, tabIndex) => {
            if (compList.length === 0) return;
            const wrap = document.createElement('div');
            wrap.className = 'explanation-wrap';
            if (tabIndex + 1 !== activeTabId) {
                wrap.style.display = 'none';
            }
            wrap.id = `preview-tab-${tabIndex + 1}`;
            
            compList.forEach((comp, index) => {
                if (!comp.data.visible) return;
                
                const div = document.createElement('div');
                div.id = 'preview-' + comp.id;
                div.innerHTML = generateComponentHtml(comp, index, compList, false, currentThemeColor);
                wrap.appendChild(div);
            });
            previewCanvas.appendChild(wrap);
        });
        
        const videos = previewCanvas.querySelectorAll('video');
        videos.forEach(v => v.play().catch(e => {}));
    }


    function deleteComponent(index) {
        if (!confirm('이 컴포넌트를 삭제하시겠습니까?')) return;
        
        let foundIndex = -1;
        let tab = 1;
        
        for (let i = 0; i < componentsTab1.length; i++) {
            if (componentsTab1[i].id === index) {
                foundIndex = i;
                break;
            }
        }
        
        if (foundIndex !== -1) {
            componentsTab1.splice(foundIndex, 1);
        } else {
            for (let i = 0; i < componentsTab2.length; i++) {
                if (componentsTab2[i].id === index) {
                    foundIndex = i;
                    tab = 2;
                    break;
                }
            }
            if (foundIndex !== -1) {
                componentsTab2.splice(foundIndex, 1);
            }
        }
        
        // Try global components array as fallback
        if (foundIndex === -1) {
            let globalIdx = components.findIndex(c => c.id === index || c === index);
            if (globalIdx !== -1) {
                components.splice(globalIdx, 1);
            }
        }
        
        renderEditor();
        triggerAutoSave();
    }

    function moveComponent(index, direction) {
        let compList = null;
        let foundIndex = -1;
        
        for (let i = 0; i < componentsTab1.length; i++) {
            if (componentsTab1[i].id === index) {
                compList = componentsTab1;
                foundIndex = i;
                break;
            }
        }
        
        if (!compList) {
            for (let i = 0; i < componentsTab2.length; i++) {
                if (componentsTab2[i].id === index) {
                    compList = componentsTab2;
                    foundIndex = i;
                    break;
                }
            }
        }
        
        if (!compList && components.length > 0) {
            let globalIdx = components.findIndex(c => c.id === index || c === index);
            if (globalIdx !== -1) {
                compList = components;
                foundIndex = globalIdx;
            }
        }
        
        if (!compList || foundIndex === -1) return;
        
        const newIndex = foundIndex + direction;
        if (newIndex < 0 || newIndex >= compList.length) return;
        
        const temp = compList[foundIndex];
        compList[foundIndex] = compList[newIndex];
        compList[newIndex] = temp;
        
        renderEditor();
        triggerAutoSave();
    }
    function addComponent(type) {
        const base = { id: generateId(), type, data: { visible: true } };
        if (type === 'video') {
            base.data.url = '';
            base.data.moreLink = '';
        } else if (type === 'title') {
            base.data.subtitle = '';
            base.data.mainTitle = '';
            base.data.align = 'center';
        } else if (type === 'tabs') {
            base.data.tabList = [
                { name: '', targetStep: '1' },
                { name: '', targetStep: '2' }
            ];
        } else if (type === 'explanation') {
            base.data.badgeText = '';
            base.data.title = '';
            base.data.imageUrl = '';
            base.data.bulletList = [''];
        } else if (type === 'tabDivider') {
            base.data.tab1Name = '기존 컴포넌트들';
            base.data.tab2Name = '새로운 영역';
        } else if (type === 'notice') {
            base.data.title = '';
            base.data.bullets = '';
        } else if (type === 'faq') {
            base.data.question = '';
            base.data.answer = '';
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
                targetCard.style.boxShadow = `0 0 0 2px var(--theme-color), 0 4px 12px rgba(0,0,0,0.15)`;
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
        const t1 = document.getElementById('tab1NameInput') ? document.getElementById('tab1NameInput').value : '이용 가이드';
        const t2 = document.getElementById('tab2NameInput') ? document.getElementById('tab2NameInput').value : '유의사항';

        const mapTab = (compList, tIdx) => {
            return compList.filter(c => c.data.visible).map((comp, index) => generateComponentHtml(comp, index, compList, true, currentThemeColor)).join('\n');
        };

        const html1 = mapTab(componentsTab1, 1);
        const html2 = mapTab(componentsTab2, 2);

        let tabsMenuHtml = '';
        if (componentsTab2.length > 0) {
            tabsMenuHtml = `
        <div class="tabs-container fixed-top">
            <div class="tabs-wrap">
                <a href="#" class="tab-linker active">${t1.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a>
                <a href="#" class="tab-linker">${t2.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a>
            </div>
        </div>`;
        }

        const template = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta http-equiv="Expires" content="-1">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Cache-Control" content="No-Cache">
    <meta name="format-detection" content="telephone=no">
    <title>이용 가이드</title>
    <link rel="shortcut icon" href="#">
    <link rel="stylesheet" href="/static/assets/styles/etc/use_guide.css">

    <script src="/static/assets/scripts/libs/jquery-2.2.3.min.js"></script>
    <script src="/static/js/comm/common.js"></script>
    <script src="/static/js/comm/app_scheme.js"></script>
    <script src="/static/js/comm/ajax.js"></script>
    <script src="/static/assets/scripts/comm/common.ui.js"></script>
    <script src="/static/assets/scripts/comm/tab_scroll.js"></script>
    <script src="/static/assets/scripts/comm/nethru_pb.js" async></script>
    <style>
        :root {
            --theme-color: ${currentThemeColor};
        }
    </style>
</head>
<body class="bg-gray" style="margin: 0; padding: 0;">
    <header class="renew21--header" style="height: 56px; display: flex; align-items: center; background: #fff; border-bottom: 1px solid #f3f4f6; padding-left: 20px; box-sizing: border-box;">
        <a href="javascript:void(0);" class="btn-back" onclick="onBackHistory();" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: flex-start; text-decoration: none; flex-shrink: 0; margin-right: 0;">
            <img src="https://cdn.paybooc.co.kr/static/assets/images/comm/ico-back.svg" alt="뒤로가기" style="width: 24px; height: 24px;">
        </a>
        <h1 class="tit" style="font-size: 18px; font-weight: 700; line-height: 26px; margin: 0; color: #111827; text-align: left;">이용방법</h1>
    </header>

    <div class="use-guide-wrap">
        ${tabsMenuHtml}
        
        <div class="explanation-wrap tab-cont1">
            ${html1}
        </div>
        ${html2.trim() !== '' ? `
        <div class="explanation-wrap tab-cont2">
            ${html2}
        </div>` : ''}
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof TabMenuModule !== 'undefined') {
                TabMenuModule.init({
                    tabSelector: '.tab-linker',
                    contentSelectors: ['.tab-cont1', '.tab-cont2'],
                    stickyTopOffset: 56,
                    tabHeight: 44
                });
            }

            setVideoControler();
            
            if (typeof AccCtl !== 'undefined') {
                new AccCtl();
            }
        });

        function setVideoControler() {
            const videos = document.querySelectorAll('.playable-video');
            
            videos.forEach(video => {
                const container = video.parentElement;
                const overlay = container.querySelector('.video-overlay');
                const muteBtn = container.querySelector('.mute-toggle-btn');
                
                if (overlay) {
                    const pauseVideo = () => {
                        video.pause();
                        overlay.style.display = 'flex';
                    };
                    
                    video.addEventListener('pause', pauseVideo);
                    
                    video.addEventListener('click', () => {
                        if (!video.paused) {
                            pauseVideo();
                        }
                    });
                    
                    overlay.addEventListener('click', () => {
                        video.play();
                        overlay.style.display = 'none';
                    });
                }
                
                if (muteBtn) {
                    const iconMute = muteBtn.querySelector('.icon-mute');
                    const iconUnmute = muteBtn.querySelector('.icon-unmute');
                    
                    muteBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); // prevent clicking through to the video container
                        if (video.muted) {
                            video.muted = false;
                            if(iconMute) iconMute.style.display = 'none';
                            if(iconUnmute) iconUnmute.style.display = 'block';
                        } else {
                            video.muted = true;
                            if(iconMute) iconMute.style.display = 'block';
                            if(iconUnmute) iconUnmute.style.display = 'none';
                        }
                    });
                }
            });
        }
    </script>
</body>
</html>`;

        return template;
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
                copySourceBtn.style.backgroundColor = currentThemeColor;
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
            savedScreensList.innerHTML = '<li style="text-align:center; padding: 32px; color:#6B7280; font-size:13px;">저장된 화면이<br>없습니다</li>';
            return;
        }
        
        const sortedList = [...list].filter(item => item && typeof item === 'object').sort((a,b) => {
            const dA = a.date ? new Date(a.date).getTime() : 0;
            const dB = b.date ? new Date(b.date).getTime() : 0;
            return (isNaN(dB) ? 0 : dB) - (isNaN(dA) ? 0 : dA);
        });
        
        if (sortedList.length === 0) {
            savedScreensList.innerHTML = '<li style="text-align:center; padding: 32px; color:#6B7280; font-size:13px;">저장된 화면이<br>없습니다</li>';
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
                        <span style="color: #FFFFFF; font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                        <span style="color: #6B7280; font-size: 12px; font-weight: 400;">${formattedDate}</span>
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
                                StorageDB.save(listDb);
                            }
                        }
                        
                        componentsTab1 = item.componentsTab1 || item.components || [];
                        componentsTab2 = item.componentsTab2 || [];
                        currentThemeColor = item.themeColor || '#23B6FF';
                        if (currentThemeColor === '#27a8f5') currentThemeColor = '#23B6FF';
                        renderThemeSelector();

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
                listEl.innerHTML = '<li style="color: #6B7280; font-size: 12px; text-align: center; padding: 12px 0;">휴지통이 비어있습니다.</li>';
                return;
            }
            
            trash.forEach(screen => {
                const li = document.createElement('li');
                li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #111; border-radius: 6px; margin-bottom: 6px;';
                
                const titleSpan = document.createElement('span');
                titleSpan.textContent = screen.title;
                titleSpan.style.cssText = 'color: #E5E7EB; font-size: 12px; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px;';
                titleSpan.title = screen.title;
                
                const actionDiv = document.createElement('div');
                actionDiv.style.cssText = 'display: flex; gap: 6px; align-items: center;';
                
                const restoreBtn = document.createElement('button');
                restoreBtn.textContent = '복원';
                restoreBtn.title = '리스트로 복원';
                restoreBtn.style.cssText = 'background: #6B7280; color: #FFFFFF; border: 1px solid #6B7280; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; transition: background 0.2s;';
                restoreBtn.onmouseover = () => restoreBtn.style.background = '#6B7280';
                restoreBtn.onmouseout = () => restoreBtn.style.background = '#6B7280';
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
                deleteBtn.style.cssText = 'background: #ef4444; color: #FFFFFF; border: none; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0.8; transition: opacity 0.2s;';
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
            toast.style.color = '#FFFFFF';
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
                    <input type="text" id="newProjectInput" placeholder="프로젝트 이름 입력..." style="width: 100%; background: transparent; border: none; color: #FFFFFF; padding: 0; font-size: 15px; font-weight: 700; outline: none;">
                    <span style="color: #6B7280; font-size: 12px; font-weight: 400;">${formatDatePoint(new Date().toISOString())}</span>
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
                            StorageDB.save(list);
                        }
                    }
                    
                    componentsTab1 = [];
                    componentsTab2 = [];
                    currentThemeColor = THEMES[0] || '#23B6FF';
                    
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
                const payloadSize = new Blob([JSON.stringify(list)]).size;
                if (payloadSize > 800000) { // Over 800KB
                    showToast('⚠️ 클라우드 용량 초과! 영상을 직접 첨부하지 마시고 [URL 링크]를 입력해주세요.', 5000);
                    return; // Abort save
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
        renderSidebarLibrary();
        renderTrashList();
        addComponent('video');
        addComponent('title');
        addComponent('explanation');
        if (window.syncTabVisibility) window.syncTabVisibility();
        deviceSelect.dispatchEvent(new Event('change'));
    }).catch(e => {
        console.error("DB Init Failed", e);
        addComponent('video');
        addComponent('title');
        addComponent('explanation');
        if (window.syncTabVisibility) window.syncTabVisibility();
        deviceSelect.dispatchEvent(new Event('change'));
    });
});
