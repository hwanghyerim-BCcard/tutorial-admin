import re

# 1. Update style.css
with open('style.css', 'a') as f:
    f.write('''
.lib-more-btn {
    background: none;
    border: none;
    padding: 6px;
    cursor: pointer;
    color: #9ca3af;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
}
.lib-more-btn:hover {
    background: rgba(255,255,255,0.1);
    color: #fff;
}
.lib-dropdown-menu {
    position: absolute;
    right: 0;
    top: 32px;
    background: #2f333a;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border: 1px solid #4b5563;
    z-index: 100;
    min-width: 120px;
    overflow: hidden;
}
.lib-dropdown-btn {
    width: 100%;
    text-align: left;
    padding: 10px 14px;
    background: none;
    border: none;
    font-size: 13px;
    color: #d1d5db;
    cursor: pointer;
    transition: background 0.2s;
}
.lib-dropdown-btn:hover {
    background: rgba(255,255,255,0.05);
    color: #fff;
}
.lib-dropdown-btn.delete {
    color: #fca5a5;
}
.lib-dropdown-btn.delete:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
}
''')

# 2. Update script.js
with open('script.js', 'r') as f:
    text = f.read()

# Replace HTML innerHTML block for li
html_old = r'''<div class="saved-item-actions">\s*<button class="delete-lib-btn" [^>]+><svg[^>]+><path[^>]+></path><path[^>]+></path><path[^>]+></path></svg></button>\s*</div>'''
html_new = '''<div class="saved-item-actions" style="position: relative;">
                        <button class="lib-more-btn" title="더보기">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                        </button>
                        <div class="lib-dropdown-menu" style="display:none;">
                            <button class="lib-dropdown-btn rename-btn">제목 수정</button>
                            <button class="lib-dropdown-btn duplicate-btn">복제</button>
                            <button class="lib-dropdown-btn delete delete-btn">삭제</button>
                        </div>
                    </div>'''
text = re.sub(html_old, html_new, text)

# Replace the click listener logic for delete with the new dropdown logic
del_old = r'''const delBtn = li\.querySelector\('\.delete-lib-btn'\);\s*delBtn\.addEventListener\('click', \(e\) => \{[\s\S]*?\}\);'''
del_new = '''const moreBtn = li.querySelector('.lib-more-btn');
                const dropdown = li.querySelector('.lib-dropdown-menu');
                const renameBtn = li.querySelector('.rename-btn');
                const duplicateBtn = li.querySelector('.duplicate-btn');
                const deleteBtn = li.querySelector('.delete-btn');

                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.lib-dropdown-menu').forEach(menu => {
                        if (menu !== dropdown) menu.style.display = 'none';
                    });
                    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
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
                            
                            // Handle incremental numbering for duplicate
                            let baseTitle = target.title;
                            let match = baseTitle.match(/\\(복사본(\\d+)\\)$/);
                            let dupNum = 1;
                            if (match) {
                                baseTitle = baseTitle.replace(/\\(복사본\\d+\\)$/, '').trim();
                                dupNum = parseInt(match[1]) + 1;
                            } else if (baseTitle.endswith('(복사본)')) {
                                baseTitle = baseTitle.replace(/\\(복사본\\)$/, '').trim();
                                dupNum = 1;
                            }
                            newObj.title = baseTitle + ' (복사본1)';
                            
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
                    if (confirm('이 저장된 화면을 정말 삭제하시겠습니까?')) {
                        StorageDB.load().then(currentList => {
                            const updated = (currentList || []).filter(x => x && x.id !== safeId);
                            StorageDB.save(updated).then(() => {
                                if (currentScreenId === safeId) currentScreenId = null;
                                renderSidebarLibraryList(updated);
                            });
                        });
                    }
                });'''
text = re.sub(del_old, del_new, text)

# Add a protection in li.addEventListener to ignore clicks on our UI
e_target_old = r"if \(e\.target\.closest\('\.delete-lib-btn'\)\) return;"
e_target_new = "if (e.target.closest('.lib-more-btn') || e.target.closest('.lib-dropdown-menu')) return;"
text = re.sub(e_target_old, e_target_new, text)

# Global document click listener for dropdown close
doc_click_old = r'''document\.addEventListener\('click', \(e\) => \{[\s\S]*?const muteBtn = e\.target\.closest\('\.mute-toggle-btn'\);'''
doc_click_new = '''document.addEventListener('click', (e) => {
        if (!e.target.closest('.saved-item-actions')) {
            document.querySelectorAll('.lib-dropdown-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        }
        const muteBtn = e.target.closest('.mute-toggle-btn');'''
text = re.sub(doc_click_old, doc_click_new, text)

with open('script.js', 'w') as f:
    f.write(text)
print("Updated successfully")
