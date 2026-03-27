// ── Theme Switcher ──
function toggleSettingsMenu() {
    document.querySelector('.theme-switcher').classList.toggle('open');
}
function closeSettingsMenu() {
    document.querySelector('.theme-switcher').classList.remove('open');
}
function setTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('arb-parser-theme', theme);
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === theme);
    });
}

// ── Background Switcher ──
let bgImages = []; // { id, src, thumbSrc, type, name }
let activeBgId = null;

// Load backgrounds from bg-config.js (backgrounds/ folder)
function loadConfigBgs() {
    if (typeof BG_IMAGES === 'undefined') return;
    BG_IMAGES.forEach((name, i) => {
        const id = 'cfg_' + i;
        const src = 'backgrounds/' + name;
        bgImages.push({ id, src, thumbSrc: src, type: 'local', name });
    });
}

// Add backgrounds via file picker (stored in IndexedDB)
function addBgImages(event) {
    const files = Array.from(event.target.files);
    files.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxThumb = 200;
                let w = img.width, h = img.height;
                if (w > h) { h = h * maxThumb / w; w = maxThumb; }
                else { w = w * maxThumb / h; h = maxThumb; }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                const thumbUrl = canvas.toDataURL('image/jpeg', 0.7);
                const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                bgImages.push({ id, src: dataUrl, thumbSrc: thumbUrl, type: 'file', name: file.name });
                saveBgToIDB(id, dataUrl, thumbUrl, file.name);
                renderBgThumbs();
                if (!activeBgId) selectBg(id);
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    });
    event.target.value = '';
}

// ── IndexedDB helpers ──
function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('ArbParserBG', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('images')) {
                db.createObjectStore('images', { keyPath: 'id' });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function saveBgToIDB(id, dataUrl, thumbUrl, name) {
    try {
        const db = await openIDB();
        const tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').put({ id, dataUrl, thumbUrl, name });
    } catch (e) { console.warn('IndexedDB save failed:', e); }
}

async function deleteBgFromIDB(id) {
    try {
        const db = await openIDB();
        const tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').delete(id);
    } catch (e) { console.warn('IndexedDB delete failed:', e); }
}

async function loadBgsFromIDB() {
    try {
        const db = await openIDB();
        const tx = db.transaction('images', 'readonly');
        const store = tx.objectStore('images');
        return new Promise((resolve) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    } catch (e) { console.warn('IndexedDB load failed:', e); return []; }
}

// ── Render & Select ──
function renderBgThumbs() {
    const grid = document.getElementById('bgThumbGrid');
    const noneBtn = grid.querySelector('.bg-none');
    grid.innerHTML = '';
    grid.appendChild(noneBtn);
    bgImages.forEach(bg => {
        const wrap = document.createElement('div');
        wrap.className = 'bg-thumb-wrap';

        const btn = document.createElement('button');
        btn.className = 'bg-thumb' + (activeBgId === bg.id ? ' active' : '');
        btn.onclick = () => selectBg(bg.id);
        btn.title = bg.name || '背景';
        const img = document.createElement('img');
        img.src = bg.thumbSrc;
        img.alt = bg.name || '背景';
        img.loading = 'lazy';
        btn.appendChild(img);

        wrap.appendChild(btn);

        // Delete button for user-added images
        if (bg.type === 'file') {
            const del = document.createElement('button');
            del.className = 'bg-thumb-del';
            del.title = '移除';
            del.innerHTML = '✕';
            del.onclick = (e) => {
                e.stopPropagation();
                removeBg(bg.id);
            };
            wrap.appendChild(del);
        }

        grid.appendChild(wrap);
    });
}

async function removeBg(id) {
    bgImages = bgImages.filter(b => b.id !== id);
    await deleteBgFromIDB(id);
    if (activeBgId === id) selectBg(null);
    renderBgThumbs();
}

function selectBg(id) {
    activeBgId = id;
    const overlay = document.getElementById('bgOverlay');
    const bg = bgImages.find(b => b.id === id);
    if (bg) {
        overlay.style.backgroundImage = `url(${bg.src})`;
    }
    document.querySelectorAll('.bg-thumb').forEach(t => t.classList.remove('active'));
    if (id === null) {
        document.querySelector('.bg-none').classList.add('active');
        overlay.style.backgroundImage = 'none';
    } else {
        const wraps = document.querySelectorAll('.bg-thumb-wrap');
        const idx = bgImages.findIndex(b => b.id === id);
        if (wraps[idx]) wraps[idx].querySelector('.bg-thumb').classList.add('active');
    }
    localStorage.setItem('arb-parser-bg-id', id || '');
}

function clearBg() {
    selectBg(null);
}

function setBgOpacity(val) {
    const overlay = document.getElementById('bgOverlay');
    overlay.style.opacity = val / 100;
    document.getElementById('bgOpacityVal').textContent = val + '%';
    localStorage.setItem('arb-parser-bg-opacity', val);
}

function setContentOpacity(val) {
    const container = document.querySelector('.container');
    container.style.opacity = val / 100;
    document.getElementById('contentOpacityVal').textContent = val + '%';
    localStorage.setItem('arb-parser-content-opacity', val);
}

// Close menu on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.theme-switcher')) {
        closeSettingsMenu();
    }
});

// ── Init ──
(async function initBg() {
    // Load config-based backgrounds (from backgrounds/ folder)
    loadConfigBgs();

    // Load user-added backgrounds from IndexedDB
    const idbImages = await loadBgsFromIDB();
    idbImages.forEach(img => {
        bgImages.push({ id: img.id, src: img.dataUrl, thumbSrc: img.thumbUrl, type: 'file', name: img.name });
    });

    // Restore last selection
    const savedBgId = localStorage.getItem('arb-parser-bg-id');
    if (savedBgId && bgImages.find(b => b.id === savedBgId)) {
        activeBgId = savedBgId;
        const bg = bgImages.find(b => b.id === savedBgId);
        document.getElementById('bgOverlay').style.backgroundImage = `url(${bg.src})`;
    }

    // Restore opacity
    const savedOpacity = localStorage.getItem('arb-parser-bg-opacity') || '30';
    document.getElementById('bgOpacity').value = savedOpacity;
    setBgOpacity(savedOpacity);

    // Restore content opacity
    const savedContentOpacity = localStorage.getItem('arb-parser-content-opacity') || '85';
    document.getElementById('contentOpacity').value = savedContentOpacity;
    setContentOpacity(savedContentOpacity);

    renderBgThumbs();
})();

// ── Theme Init ──
(function initTheme() {
    const savedTheme = localStorage.getItem('arb-parser-theme') || 'dark';
    setTheme(savedTheme);
})();

let selectedFile = null;
let parsedMissionsData = [];
let currentBuffs = {};

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');

async function copyPath() {
    const pathText = document.getElementById('pathText').textContent;
    try {
        await navigator.clipboard.writeText(pathText);
        showCopySuccess();
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = pathText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showCopySuccess();
        } catch (err) {
            alert('复制失败，请手动复制：' + pathText);
        }
        document.body.removeChild(textArea);
    }
}

function showCopySuccess() {
    const successDiv = document.getElementById('copySuccess');
    successDiv.textContent = '路径已复制到剪贴板！';
    successDiv.style.background = '#4caf50';
    successDiv.style.display = 'block';
    setTimeout(() => { successDiv.style.display = 'none'; }, 2000);
}

function showParseComplete() {
    const successDiv = document.getElementById('copySuccess');
    successDiv.textContent = '解析完成！已滚动到结果区域 ↓';
    successDiv.style.background = '#764ba2';
    successDiv.style.display = 'block';
    setTimeout(() => { successDiv.style.display = 'none'; }, 3000);
}

const BASE_DRONE_DROP_RATE = 0.06;
const BUFF_MULTIPLIERS = {
    "drop_chance": 2.0,
    "prosperity": 1.18,
    "drop_quantity": 2.0,
    "drop_blessing": 1.25,
};
const ROUND_EXPECTATION = 1.21;
const RATING_THRESHOLDS = [[800, "S"], [700, "A+"], [600, "A"], [500, "A-"]];

// 正则表达式
const RE_TIME_PREFIX = /^(\d+(?:\.\d+)?)\s+/;
const RE_START_MISSION_NAME = /Script \[Info\]: ThemedSquadOverlay\.lua: Mission name:\s*(.+?)\s*-\s*仲裁\s*\(([A-Za-z0-9_]+)\)/;
const RE_START_MISSION_VOTE = /Script \[Info\]: ThemedSquadOverlay\.lua: ShowMissionVote\s+(.+?)\s*\(([A-Za-z0-9_]+)_EliteAlert\)/;
const RE_HOST_LOADING = /Sys \[Info\]: Client loaded \{"name":"([^"]+)_EliteAlert"\}/;
const RE_END = /Script \[Info\]: Background\.lua: EliteAlertMission at ([A-Za-z0-9_]+)\b/;
const RE_STATE_STARTED = /GameRulesImpl - changing state from SS_WAITING_FOR_PLAYERS to SS_STARTED/;
const RE_STATE_ENDING = /GameRulesImpl - changing state from SS_STARTED to SS_ENDING/;
const RE_EOM_INIT = /Script \[Info\]: EndOfMatch\.lua: Initialize\b/;
const RE_ALL_EXTRACTING = /Script \[Info\]: ExtractionTimer\.lua: EOM: All players extracting\b/;
const RE_ANY_ON_AGENT_CREATED = /AI \[Info\]: OnAgentCreated\b/;
const RE_SPAWNED = /\bSpawned\s+(\d+)\b/;
const RE_SHIELD_DRONE = /AI \[Info\]: OnAgentCreated \/Npc\/CorpusEliteShieldDroneAgent\d*\b/;
const RE_DEFENSE_WAVE = /Script \[Info\]: WaveDefend\.lua: Defense wave:\s*(\d+)\b/;
const RE_INTERCEPTION_NEW_ROUND = /Script \[Info\]: HudRedux\.lua: Queuing new transmission: InterNewRoundLotusTransmission\b/;
const RE_DEFENSE_REWARD_TRANSITION_OUT = /Script \[Info\]: DefenseReward\.lua: DefenseReward::TransitionOut\b/;
const RE_CLIENT_JOIN = /Script \[Info\]: ThemedSquadOverlay\.lua: LoadLevelMsg received\. Client joining mission in-progress:/;
const RE_SEND_LOAD_LEVEL = /Net \[Info\]: Sending LOAD_LEVEL to (.+?)\s+\[mission=/;
const RE_CREATE_PLAYER = /Game \[Info\]: CreatePlayerForClient\. id=(\d+),/;

const MISSION_TYPE_MAP = {
    'defense': { name: '防御', color: '#ff6b6b', phase: '波次' },
    'interception': { name: '拦截', color: '#764ba2', phase: '轮次' },
    'survival': { name: '生存', color: '#4caf50', phase: '分钟' },
    'excavation': { name: '挖掘', color: '#ff9800', phase: '轮次' },
    'spy': { name: '间谍', color: '#2196f3', phase: '保险柜' },
    'capture': { name: '捕获', color: '#9c27b0', phase: '目标' },
    'mobileDefense': { name: '移动防御', color: '#f44336', phase: '终端' },
    'sabotage': { name: '破坏', color: '#795548', phase: '阶段' },
    'extermination': { name: '歼灭', color: '#607d8b', phase: '进度' },
    'disruption': { name: '中断', color: '#e91e63', phase: '导管' },
    'rescue': { name: '救援', color: '#00bcd4', phase: '人质' },
    'defection': { name: '叛逃', color: '#8bc34a', phase: '小队' },
    'assassination': { name: '刺杀', color: '#ff5722', phase: 'BOSS' },
    'unknown': { name: '未知', color: '#999999', phase: '阶段' }
};

fileInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    updateFileDisplay();
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    selectedFile = e.dataTransfer.files[0];
    updateFileDisplay();
});

function updateFileDisplay() {
    if (selectedFile) {
        const size = (selectedFile.size / 1024 / 1024).toFixed(2);
        fileName.textContent = `已选择: ${selectedFile.name} (${size} MB)`;
    }
}

function parseTime(line) {
    const match = line.match(RE_TIME_PREFIX);
    if (!match) return null;
    const v = parseFloat(match[1]);
    if (isNaN(v) || !isFinite(v)) return null;
    return v;
}

function calculateDroneExpectation(count, buffs) {
    let multiplier = 1.0;
    for (const [key, enabled] of Object.entries(buffs)) {
        if (enabled && BUFF_MULTIPLIERS[key]) {
            multiplier *= BUFF_MULTIPLIERS[key];
        }
    }
    return count * BASE_DRONE_DROP_RATE * multiplier;
}

function calculateRating(e1h) {
    if (!e1h) return "?";
    for (const [threshold, rating] of RATING_THRESHOLDS) {
        if (e1h >= threshold) return rating;
    }
    return "F";
}

function formatDuration(seconds) {
    if (!seconds) return '-';
    if (seconds >= 60) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}分${secs.toString().padStart(2, '0')}秒`;
    }
    return `${seconds.toFixed(1)}秒`;
}

function calculateMissionWithTimeMode(m, timeMode, customMinutes) {
    let total_sec = null;
    let duration_label = '';

    switch(timeMode) {
        case 'host':
            total_sec = m.eom_duration_sec || m.state_duration_sec || m.duration_sec;
            duration_label = '主机时间';
            break;
        case 'client':
            if (m.last_client_duration_sec && m.last_client_duration_sec > 0) {
                total_sec = m.last_client_duration_sec;
                duration_label = '客机时间';
            } else {
                total_sec = m.eom_duration_sec || m.state_duration_sec || m.duration_sec;
                duration_label = '主机时间(无客机数据)';
            }
            break;
        case 'custom':
            if (customMinutes > 0) {
                total_sec = customMinutes * 60;
                duration_label = `自定义(${customMinutes}分钟)`;
            } else {
                total_sec = m.eom_duration_sec || m.state_duration_sec || m.duration_sec;
                duration_label = '主机时间(输入无效)';
            }
            break;
    }

    const drone_expectation = calculateDroneExpectation(m.shield_drone_count, currentBuffs);
    let round_expectation = 0;
    if (m.round_count) {
        round_expectation = m.round_count * ROUND_EXPECTATION;
    }
    const total_expectation = drone_expectation + round_expectation;

    let shield_drone_per_min = 0;
    let expectation_1h = 0;
    let rating = '?';

    if (total_sec && total_sec > 0) {
        shield_drone_per_min = m.shield_drone_count / (total_sec / 60);
        expectation_1h = total_expectation * (3600 / total_sec);
        rating = calculateRating(expectation_1h);
    }

    return {
        ...m,
        used_duration: total_sec,
        duration_label,
        drone_expectation,
        round_expectation,
        total_expectation,
        shield_drone_per_min,
        expectation_1h,
        rating
    };
}

function switchTimeMode(missionIndex, timeMode) {
    const customInput = document.getElementById(`custom-${missionIndex}`);
    if (timeMode === 'custom') {
        customInput.classList.add('show');
    } else {
        customInput.classList.remove('show');
    }

    document.querySelectorAll(`[data-mission="${missionIndex}"]`).forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`btn-${missionIndex}-${timeMode}`).classList.add('active');

    refreshMissionDisplay(missionIndex);
}

function onCustomTimeChange(missionIndex) {
    const customMinutes = parseFloat(document.getElementById(`custom-min-${missionIndex}`).value) || 0;
    if (customMinutes > 0) {
        refreshMissionDisplay(missionIndex);
    }
}

function refreshMissionDisplay(missionIndex) {
    const m = parsedMissionsData[missionIndex];
    const timeMode = document.querySelector(`input[name="timeMode-${missionIndex}"]:checked`).value;
    const customMinutes = parseFloat(document.getElementById(`custom-min-${missionIndex}`).value) || 0;

    const calculated = calculateMissionWithTimeMode(m, timeMode, customMinutes);

    document.getElementById(`duration-${missionIndex}`).textContent = formatDuration(calculated.used_duration);
    document.getElementById(`duration-label-${missionIndex}`).textContent = calculated.duration_label;
    document.getElementById(`dpm-${missionIndex}`).textContent = calculated.shield_drone_per_min.toFixed(2);
    document.getElementById(`total-exp-${missionIndex}`).textContent = calculated.total_expectation.toFixed(2);
    document.getElementById(`e1h-${missionIndex}`).textContent = calculated.expectation_1h.toFixed(1);
    document.getElementById(`rating-${missionIndex}`).textContent = calculated.rating;

    const ratingEl = document.getElementById(`rating-box-${missionIndex}`);
    let ratingClass = calculated.rating;
    if (ratingClass === 'A+') ratingClass = 'Aplus';
    if (ratingClass === 'A-') ratingClass = 'Aminus';
    ratingEl.className = `rating rating-${ratingClass}`;
}

function togglePhases(missionIndex) {
    const container = document.getElementById(`phases-container-${missionIndex}`);
    const btn = document.getElementById(`toggle-btn-${missionIndex}`);
    const m = parsedMissionsData[missionIndex];
    const typeInfo = MISSION_TYPE_MAP[m.mission_kind] || MISSION_TYPE_MAP['unknown'];
    const phaseType = typeInfo.phase || '阶段';

    if (container.classList.contains('expanded')) {
        container.classList.remove('expanded');
        btn.classList.remove('expanded');
        btn.innerHTML = `查看${phaseType}详细 <span class="toggle-icon">▼</span>`;
    } else {
        container.classList.add('expanded');
        btn.classList.add('expanded');
        btn.innerHTML = `收起详细 <span class="toggle-icon">▲</span>`;
    }
}

async function parseFile() {
    if (!selectedFile) {
        alert('请先选择文件');
        return;
    }

    const btn = document.getElementById('parseBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const results = document.getElementById('results');

    btn.disabled = true;
    progressContainer.style.display = 'block';
    results.style.display = 'none';

    const countInput = document.getElementById('count').value;
    const count = parseInt(countInput) || 2;
    const minDuration = parseFloat(document.getElementById('minDuration').value) || 60;

    currentBuffs = {
        "drop_chance": document.getElementById('dropChance').checked,
        "prosperity": document.getElementById('prosperity').checked,
        "drop_quantity": document.getElementById('dropQuantity').checked,
        "drop_blessing": document.getElementById('dropBlessing').checked,
    };

    try {
        progressBar.style.width = '50%';
        progressBar.textContent = '读取中...';

        const text = await selectedFile.text();

        progressBar.style.width = '100%';
        progressBar.textContent = '解析中...';

        const lines = text.split(/\r?\n/);
        const missions = [];
        let cur = null;
        let validTotal = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNo = i + 1;

            const mStartName = line.match(RE_START_MISSION_NAME);
            const mStartVote = line.match(RE_START_MISSION_VOTE);

            if (mStartName || mStartVote) {
                if (cur && cur.state_started_line !== undefined) {
                    const prevMission = finalizeMission(cur, minDuration);
                    if (prevMission) {
                        missions.push(prevMission);
                        if (prevMission.status === 'ok') validTotal++;
                    }
                }

                const isVote = !!mStartVote;
                const rawName = isVote ? mStartVote[1].trim() : mStartName[1].trim();
                const nodeId = isVote ? mStartVote[2] : mStartName[2];

                let processedName = rawName;
                let missionKind = 'unknown';

                if (isVote) {
                    const typeMatch = rawName.match(/^(防御|拦截|生存|挖掘|间谍|捕获|移动防御|破坏|歼灭|中断|救援|叛逃|刺杀)/);
                    if (typeMatch) {
                        const typeMap = {
                            '防御': 'defense', '拦截': 'interception', '生存': 'survival',
                            '挖掘': 'excavation', '间谍': 'spy', '捕获': 'capture',
                            '移动防御': 'mobileDefense', '破坏': 'sabotage', '歼灭': 'extermination',
                            '中断': 'disruption', '救援': 'rescue', '叛逃': 'defection', '刺杀': 'assassination'
                        };
                        missionKind = typeMap[typeMatch[1]] || 'unknown';
                    }
                    processedName = rawName.replace(/^(防御|拦截|生存|挖掘|间谍|捕获|移动防御|破坏|歼灭|中断|救援|叛逃|刺杀)\s*-\s*/, '');
                    processedName = processedName.replace(/\s*-\s*等级\s*\([^)]*\)$/, '');
                } else {
                    processedName = rawName.replace(/\s*-\s*仲裁$/, '');
                }

                cur = {
                    start_kind: isVote ? 'missionVote' : 'missionName',
                    start_line: lineNo,
                    start_time: parseTime(line),
                    mission_name: processedName,
                    node_id: nodeId,
                    mission_kind: missionKind,
                    need_host_lines: 15,
                    shield_drone_count: 0,
                    enemy_count: 0,
                    phases: [],
                    inter_completed_rounds: 0,
                    pending_drones_before_first_round: 0,
                    load_level_times: {},
                    last_client_join_time: null
                };
                continue;
            }

            if (!cur) continue;

            const seen_t = parseTime(line);
            if (seen_t !== null) {
                cur.last_seen_time = seen_t;
                cur.last_seen_line = lineNo;
            }

            if (cur.state_started_time === undefined && RE_STATE_STARTED.test(line)) {
                cur.state_started_time = parseTime(line);
                cur.state_started_line = lineNo;
            }

            if (RE_STATE_ENDING.test(line) && cur.state_started_line !== undefined) {
                cur.state_ending_time = parseTime(line);
                cur.state_ending_line = lineNo;
                cur.end_line = lineNo;
                cur.end_time = parseTime(line);
            }

            const after_ending = cur.state_ending_line !== undefined && lineNo > cur.state_ending_line;
            const after_started = cur.state_started_line !== undefined && lineNo >= cur.state_started_line;

            if (!cur.node_id && cur.need_host_lines > 0) {
                const h = line.match(RE_HOST_LOADING);
                if (h) cur.node_id = h[1];
                cur.need_host_lines--;
            }

            if (cur.node_id && RE_END.test(line)) {
                const e = line.match(RE_END);
                if (e && e[1] === cur.node_id) {
                    cur.end_line = lineNo;
                    cur.end_time = parseTime(line);
                }
            }

            if (after_ending) continue;

            if (after_started && (RE_ALL_EXTRACTING.test(line) || RE_EOM_INIT.test(line))) {
                const t = parseTime(line);
                if (t !== null) cur.eom_time = t;
            }

            if (after_started) {
                if (RE_CLIENT_JOIN.test(line)) {
                    const t = parseTime(line);
                    if (t !== null) cur.last_client_join_time = t;
                }

                const sendMatch = line.match(RE_SEND_LOAD_LEVEL);
                if (sendMatch) {
                    const player = sendMatch[1].trim();
                    const t = parseTime(line);
                    if (t !== null && player) {
                        if (cur.load_level_times[player] === undefined) {
                            cur.load_level_times[player] = t;
                        }
                        const times = Object.values(cur.load_level_times);
                        if (times.length > 0) {
                            cur.last_client_join_time = Math.max(...times);
                        }
                    }
                }

                const cpMatch = line.match(RE_CREATE_PLAYER);
                if (cpMatch) {
                    const pid = parseInt(cpMatch[1]);
                    if (pid > 0) {
                        const t = parseTime(line);
                        if (t !== null) cur.last_client_join_time = t;
                    }
                }
            }

            if (after_started) {
                const mw = line.match(RE_DEFENSE_WAVE);
                if (mw) {
                    const w = parseInt(mw[1]);
                    if (w > 0) {
                        cur.mission_kind = 'defense';
                        cur.phase_kind = 'wave';
                        cur.cur_phase_index = w;
                        cur.wave_count = Math.max(cur.wave_count || 0, w);
                        while (cur.phases.length < w) cur.phases.push(0);
                    }
                }

                // 修复：只使用 RE_INTERCEPTION_NEW_ROUND 检测拦截任务轮次
                // 删除了 RE_DEFENSE_REWARD_TRANSITION_OUT 中对拦截任务的处理
                if (RE_INTERCEPTION_NEW_ROUND.test(line)) {
                    cur.mission_kind = 'interception';
                    cur.phase_kind = 'round';
                    cur.inter_completed_rounds = (cur.inter_completed_rounds || 0) + 1;
                    cur.round_count = cur.inter_completed_rounds;

                    if (cur.inter_completed_rounds === 1 && cur.pending_drones_before_first_round > 0) {
                        if (cur.phases.length < 1) cur.phases.push(0);
                        cur.phases[0] += cur.pending_drones_before_first_round;
                        cur.pending_drones_before_first_round = 0;
                    }
                    cur.cur_phase_index = cur.inter_completed_rounds + 1;
                }
                // 注意：这里删除了 else if (RE_DEFENSE_REWARD_TRANSITION_OUT...) 的拦截任务处理逻辑
                // 避免与 RE_INTERCEPTION_NEW_ROUND 重复计数
            }

            if (after_started && RE_SHIELD_DRONE.test(line)) {
                cur.shield_drone_count++;
                const phase_kind = cur.phase_kind;
                const cur_phase_index = cur.cur_phase_index;

                if (phase_kind && cur_phase_index > 0) {
                    const idx0 = cur_phase_index - 1;
                    while (cur.phases.length <= idx0) cur.phases.push(0);
                    cur.phases[idx0]++;
                } else if (cur.mission_kind !== 'defense') {
                    cur.pending_drones_before_first_round++;
                }
            }

            // 敌人计数
            if (after_started && RE_ANY_ON_AGENT_CREATED.test(line)) {
                cur.enemy_count++;
                const t = parseTime(line);
                if (t !== null) {
                    if (cur.first_on_agent_time === undefined) cur.first_on_agent_time = t;
                    cur.last_on_agent_time = t;
                }
                const sm = line.match(RE_SPAWNED);
                if (sm) cur.last_spawned = parseInt(sm[1]);
            }
        }

        if (cur && cur.state_started_line !== undefined) {
            const lastMission = finalizeMission(cur, minDuration);
            if (lastMission) {
                missions.push(lastMission);
                if (lastMission.status === 'ok') validTotal++;
            }
        }

        parsedMissionsData = missions.slice(-count);
        displayResults(parsedMissionsData, validTotal, count);

        setTimeout(() => {
            results.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);

        showParseComplete();
        btn.textContent = '解析完成！请向下查看结果 ↓';

    } catch (err) {
        console.error(err);
        alert('解析出错了: ' + err.message);
    } finally {
        btn.disabled = false;
        progressContainer.style.display = 'none';
        setTimeout(() => { btn.textContent = '开始解析'; }, 3000);
    }
}

function finalizeMission(cur, minDuration) {
    let duration_sec = null;
    if (cur.start_time && cur.end_time) duration_sec = cur.end_time - cur.start_time;

    let state_duration_sec = null;
    if (cur.state_started_time && cur.state_ending_time) {
        state_duration_sec = cur.state_ending_time - cur.state_started_time;
    }

    let eom_duration_sec = null;
    if (cur.state_started_time && cur.eom_time) {
        eom_duration_sec = cur.eom_time - cur.state_started_time;
    }

    let last_client_duration_sec = null;
    if (cur.last_client_join_time) {
        const clientEndTime = cur.eom_time || cur.end_time || cur.state_ending_time || 
                             cur.last_on_agent_time || cur.last_seen_time;
        if (clientEndTime) {
            last_client_duration_sec = clientEndTime - cur.last_client_join_time;
        }
    }

    let wave_count = cur.wave_count;
    let round_count = cur.round_count;

    if (cur.phases && cur.phases.length > 0) {
        if (cur.mission_kind === 'defense') {
            if (!wave_count) wave_count = cur.phases.length;
            round_count = wave_count ? Math.ceil(wave_count / 3) : null;
        } else if (cur.mission_kind === 'interception') {
            const completed = cur.inter_completed_rounds || 0;
            if (completed > 0) {
                round_count = completed;
            } else if (cur.phases.length > 0) {
                round_count = cur.phases.length;
            } else if (cur.pending_drones_before_first_round > 0) {
                round_count = 1;
            }
            wave_count = round_count;
            if (round_count && cur.phases.length > round_count) {
                cur.phases.length = round_count;
            }
        } else {
            if (cur.phase_kind === 'wave') {
                wave_count = cur.phases.length;
            } else {
                round_count = cur.phases.length;
            }
        }
    } else if (cur.mission_kind === 'interception') {
        round_count = cur.inter_completed_rounds || 0;
        wave_count = round_count;
    }

    const has_started = cur.state_started_line !== undefined;
    const actual_duration = eom_duration_sec || state_duration_sec || duration_sec;
    const is_valid = actual_duration && actual_duration >= minDuration;

    if (!is_valid || !has_started) return null;

    return {
        index: 0,
        node_id: cur.node_id,
        mission_name: cur.mission_name,
        mission_kind: cur.mission_kind || 'unknown',
        start_line: cur.start_line,
        end_line: cur.end_line,
        start_time: cur.start_time,
        duration_sec: duration_sec,
        state_duration_sec: state_duration_sec,
        eom_duration_sec: eom_duration_sec,
        last_client_duration_sec: last_client_duration_sec,
        last_seen_time: cur.last_seen_time,
        shield_drone_count: cur.shield_drone_count,
        enemy_count: cur.enemy_count || 0,
        wave_count: wave_count,
        round_count: round_count,
        phases: cur.phases.map((count, idx) => ({
            kind: cur.phase_kind || 'wave',
            index: idx + 1,
            shield_drone_count: count
        })),
        status: cur.end_line ? 'ok' : 'incomplete',
    };
}

function displayResults(missions, validTotal, requestedCount) {
    const results = document.getElementById('results');
    let html = '';

    const showingCount = missions.length;

    html += `<div style="margin-bottom: 20px; color: #666; text-align: center;">
        找到 <strong style="color: #764ba2; font-size: 1.2em;">${validTotal}</strong> 个有效任务
        ${showingCount < validTotal ? `，显示最近 <strong>${showingCount}</strong> 个（设置显示 ${requestedCount} 个）` : `（显示全部 ${validTotal} 个）`}
    </div>`;

    if (missions.length === 0) {
        html += '<div class="info-text">未找到任何仲裁任务记录</div>';
    } else {
        missions.forEach((m, idx) => {
            let displayName = m.mission_name || '未知任务';
            let typeInfo = MISSION_TYPE_MAP[m.mission_kind] || MISSION_TYPE_MAP['unknown'];

            let extractedTypeName = null;
            if (typeInfo.name === '未知' && m.mission_name) {
                const match = m.mission_name.match(/^([^-]+?)\s*-/);
                if (match && match[1]) {
                    extractedTypeName = match[1].trim();
                    if (extractedTypeName) {
                        typeInfo = { 
                            ...typeInfo, 
                            name: extractedTypeName,
                            extracted: true
                        };
                    }
                }
            }

            const missionTypeText = typeInfo.name;
            const missionTypeColor = typeInfo.color;
            const phaseType = typeInfo.phase;

            const hasClientData = m.last_client_duration_sec && m.last_client_duration_sec > 0;

            html += `
            <div class="mission-card">
                <div class="mission-header">
                    <div>
                        <div class="mission-title">
                            任务 #${idx + 1} 
                            <span class="status-badge ${m.status === 'ok' ? 'status-ok' : 'status-incomplete'}">
                                ${m.status === 'ok' ? '已完成' : '进行中'}
                            </span>
                        </div>
                        <div class="node-name">
                            ${displayName}
                            <span style="background: ${missionTypeColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; margin-left: 8px; font-weight: bold;">${missionTypeText}</span>
                        </div>
                    </div>
                    <div class="rating rating-?" id="rating-box-${idx}">
                        <span id="rating-${idx}">?</span>
                    </div>
                </div>

                <div class="big-stat-grid">
                    <div class="big-stat-box" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                        <div class="big-stat-label">护盾无人机</div>
                        <div class="big-stat-value">${m.shield_drone_count}</div>
                    </div>
                    <div class="big-stat-box" style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);">
                        <div class="big-stat-label">敌人生成</div>
                        <div class="big-stat-value">${m.enemy_count || 0}</div>
                    </div>
                </div>

                <div class="result-time-selector">
                    <h4>时间计算方式（点击切换实时重新计算）</h4>
                    <div class="time-mode-group">
                        <label class="time-mode-btn active" id="btn-${idx}-host" data-mission="${idx}">
                            <input type="radio" name="timeMode-${idx}" value="host" checked 
                                   onchange="switchTimeMode(${idx}, 'host')">
                            主机时间
                        </label>

                        ${hasClientData ? `
                        <label class="time-mode-btn" id="btn-${idx}-client" data-mission="${idx}">
                            <input type="radio" name="timeMode-${idx}" value="client" 
                                   onchange="switchTimeMode(${idx}, 'client')">
                            客机时间
                        </label>
                        ` : ''}

                        <label class="time-mode-btn" id="btn-${idx}-custom" data-mission="${idx}">
                            <input type="radio" name="timeMode-${idx}" value="custom" 
                                   onchange="switchTimeMode(${idx}, 'custom')">
                            自定义时间
                        </label>
                    </div>
                    <div class="custom-time-input" id="custom-${idx}">
                        <input type="number" id="custom-min-${idx}" class="number-input" 
                               placeholder="输入分钟数" min="0.1" step="0.1"
                               oninput="onCustomTimeChange(${idx})">
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-box" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        <div class="stat-value" style="color: white; font-size: 1.5em;" id="duration-${idx}">-</div>
                        <div class="stat-label" style="color: rgba(255,255,255,0.9);" id="duration-label-${idx}">任务时长</div>
                    </div>

                    <div class="stat-box">
                        <div class="stat-value">${m.wave_count || m.round_count || '-'}</div>
                        <div class="stat-label">${phaseType}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value" id="dpm-${idx}">-</div>
                        <div class="stat-label">无人机/分钟</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value" id="total-exp-${idx}">-</div>
                        <div class="stat-label">总期望生息</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value" style="color: ${(m.expectation_1h || 0) > 600 ? '#28a745' : '#dc3545'}" id="e1h-${idx}">-</div>
                        <div class="stat-label">1小时期望</div>
                    </div>
                </div>

                ${m.phases && m.phases.length > 0 ? `
                    <button class="toggle-details-btn" id="toggle-btn-${idx}" onclick="togglePhases(${idx})">
                        查看${phaseType}详细 <span class="toggle-icon">▼</span>
                    </button>

                    <div class="phases-container" id="phases-container-${idx}">
                        <table class="phases-table">
                            <thead>
                                <tr>
                                    <th>${phaseType}</th>
                                    <th>护盾无人机数</th>
                                    <th>期望生息</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${m.phases.map(p => `
                                    <tr>
                                        <td><strong>第 ${p.index} ${phaseType.replace('次', '')}</strong></td>
                                        <td>${p.shield_drone_count}</td>
                                        <td>${(p.shield_drone_count * BASE_DRONE_DROP_RATE * 
                                            (currentBuffs.drop_chance ? 2 : 1) * 
                                            (currentBuffs.prosperity ? 1.18 : 1) * 
                                            (currentBuffs.drop_quantity ? 2 : 1) * 
                                            (currentBuffs.drop_blessing ? 1.25 : 1)
                                        ).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}
            </div>
            `;
        });
    }

    results.innerHTML = html;
    results.style.display = 'block';

    missions.forEach((m, idx) => {
        refreshMissionDisplay(idx);
    });
}
