// ===== 책장 :: 공통 로직 (localStorage 기반, 백엔드 없음) =====
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

const STATUS = {
  reading: { label:'읽는 중', class:'reading' },
  done: { label:'완료', class:'done' },
  want: { label:'읽고 싶음', class:'want' },
};

const LS_KEYS = { settings:'bookshelf.settings', books:'bookshelf.books', friends:'bookshelf.friends', myid:'bookshelf.myid', theme:'bookshelf.theme' };

function loadSettings(){
  try{
    const raw = localStorage.getItem(LS_KEYS.settings);
    return raw ? JSON.parse(raw) : { nickname:'', yearGoal:50 };
  }catch(e){ return { nickname:'', yearGoal:50 }; }
}
function saveSettings(s){ try{ localStorage.setItem(LS_KEYS.settings, JSON.stringify(s)); }catch(e){} }
function loadBooks(){
  try{ const raw = localStorage.getItem(LS_KEYS.books); return raw ? JSON.parse(raw) : []; }
  catch(e){ return []; }
}
function saveBooks(books){ try{ localStorage.setItem(LS_KEYS.books, JSON.stringify(books)); }catch(e){} }
function loadFriends(){
  try{
    const raw = localStorage.getItem(LS_KEYS.friends);
    let friends = raw ? JSON.parse(raw) : [];
    // 예전 버전에서 저장된, id가 없는 친구 항목을 자동 보정 (삭제 버튼이 매칭 못 하던 문제 수정)
    let changed = false;
    friends = friends.map((f, i)=>{
      if(!f.id){
        changed = true;
        return { ...f, id: 'legacy' + i + '_' + Math.random().toString(36).slice(2,8) };
      }
      return f;
    });
    if(changed) saveFriends(friends);
    return friends;
  }catch(e){ return []; }
}
function saveFriends(friends){ try{ localStorage.setItem(LS_KEYS.friends, JSON.stringify(friends)); }catch(e){} }

// 나를 구분하는 고유 ID (닉네임이 겹치거나 비어 있어도 항상 나를 구분하기 위함)
function getMyId(){
  let id = localStorage.getItem(LS_KEYS.myid);
  if(!id){
    id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
    localStorage.setItem(LS_KEYS.myid, id);
  }
  return id;
}

let state = {
  settings: loadSettings(),
  books: loadBooks(),
  year: new Date().getFullYear(),
  filter: 'all',
  myId: getMyId(),
};

function toast(msg){
  let t = $('#toast');
  if(!t){ t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(()=> t.classList.remove('show'), 2200);
}

function sameYear(book){
  const d = book.endDate || book.date;
  if(!d) return true;
  return new Date(d).getFullYear() === state.year;
}
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function seededRand(seed){ const x = Math.sin(seed*999)*10000; return x - Math.floor(x); }
function fmtRange(b){
  const s = b.startDate, e = b.endDate || b.date;
  if(s && e) return s + ' ~ ' + e;
  if(e) return e;
  if(s) return s + ' ~';
  return '';
}

// ===== 테마 (라이트 / 다크) =====
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('#themeToggle');
  if(btn) btn.innerHTML = theme==='light' ? '🌙 다크 모드' : '☀️ 라이트 모드';
}
function initTheme(){
  const saved = localStorage.getItem(LS_KEYS.theme) || 'dark';
  applyTheme(saved);
  const btn = $('#themeToggle');
  if(!btn) return;
  btn.addEventListener('click', ()=>{
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    localStorage.setItem(LS_KEYS.theme, next);
    applyTheme(next);
  });
}

// ===== 쿠키 동의 배너 =====
function initCookieBanner(){
  if(localStorage.getItem('bookshelf.cookieConsent')) return;
  const el = document.createElement('div');
  el.className = 'cookie-banner';
  el.innerHTML = `
    <p>이 사이트는 서비스 개선과 광고 게재를 위해 쿠키를 사용합니다. 자세한 내용은
    <a href="/privacy.html">개인정보처리방침</a>에서 확인하세요.</p>
    <div class="actions"><button class="btn small" id="cookieAccept">동의</button></div>`;
  document.body.appendChild(el);
  $('#cookieAccept').addEventListener('click', ()=>{
    localStorage.setItem('bookshelf.cookieConsent', '1');
    el.remove();
  });
}

// ===== 책장(선반) 시각화 — index.html =====
function renderShelf(){
  const shelf = $('#shelf');
  if(!shelf) return;
  const done = state.books.filter(b=>b.status==='done' && sameYear(b));
  const countEl = $('#doneCount');
  if(countEl) countEl.textContent = done.length;
  const pct = Math.min(100, Math.round((done.length/Math.max(1,state.settings.yearGoal))*100));
  const stamp = $('#pctStamp');
  if(stamp) stamp.textContent = pct + '% 완료';

  shelf.innerHTML = '';
  if(done.length===0 && state.books.length===0){
    shelf.innerHTML = '<div class="shelf-empty">아직 완료한 책이 없어요. 첫 책을 추가해서 책장을 채워보세요.</div>';
    return;
  }
  done.forEach((b, i)=>{
    const el = document.createElement('div');
    el.className = 'spine';
    const w = 14 + Math.floor(seededRand(i+1)*10);
    const h = 56 + Math.floor(seededRand(i+50)*26);
    let color = 'var(--lavender)';
    if(b.rating >= 4) color = 'var(--gold)';
    else if(b.rating === 3) color = 'var(--teal)';
    el.style.width = w+'px'; el.style.height = h+'px'; el.style.background = color;
    el.title = b.title;
    shelf.appendChild(el);
  });
  const remaining = Math.max(0, state.settings.yearGoal - done.length);
  const showPlaceholders = Math.min(remaining, 20);
  for(let i=0;i<showPlaceholders;i++){
    const el = document.createElement('div');
    el.className = 'spine placeholder';
    el.style.width = '14px'; el.style.height = '50px';
    shelf.appendChild(el);
  }
  if(remaining > 20){
    const note = document.createElement('div');
    note.className = 'overflow-note';
    note.textContent = '+ '+(remaining-20)+'권 더';
    shelf.appendChild(note);
  }
}

function initGoalControls(){
  const goalInput = $('#goalInput');
  if(!goalInput) return;
  goalInput.value = state.settings.yearGoal;
  const yearLabel = $('#yearLabel');
  if(yearLabel) yearLabel.textContent = state.year;
  goalInput.addEventListener('input', (e)=>{
    const v = parseInt(e.target.value);
    state.settings.yearGoal = (v && v>0) ? v : 1;
    renderShelf();
  });
  goalInput.addEventListener('change', (e)=>{
    const v = parseInt(e.target.value);
    state.settings.yearGoal = (v && v>0) ? v : 1;
    saveSettings(state.settings);
    renderShelf();
  });
}
function initNickInput(){
  $$('.nick-input').forEach(nick=>{
    nick.value = state.settings.nickname;
    nick.addEventListener('change', (e)=>{
      state.settings.nickname = e.target.value.trim();
      saveSettings(state.settings);
    });
  });
}

// ===== 독서리스트 — list.html =====
function renderCards(){
  const wrap = $('#cards');
  if(!wrap) return;
  let list = state.books.slice().sort((a,b)=> (b.updatedAt||0)-(a.updatedAt||0));
  if(state.filter !== 'all') list = list.filter(b=>b.status===state.filter);

  if(list.length===0){
    wrap.innerHTML = `<div class="empty-state"><div class="big">아직 기록이 없어요</div>읽고 싶은 책부터 가볍게 추가해보세요.</div>`;
    return;
  }
  wrap.innerHTML = '';
  list.forEach(b=>{
    const card = document.createElement('div');
    card.className = 'card';
    const stars = b.rating ? '★'.repeat(b.rating) + '☆'.repeat(5-b.rating) : '';
    const range = fmtRange(b);
    card.innerHTML = `
      <div class="card-main">
        <div class="card-title-row">
          <span class="card-title">${escapeHtml(b.title)}</span>
          <span class="badge ${STATUS[b.status].class}">${STATUS[b.status].label}</span>
        </div>
        ${b.author ? `<div class="card-author">${escapeHtml(b.author)}</div>` : ''}
        <div class="card-meta">
          ${range ? `<span class="date-range">📅 ${range}</span>` : ''}
          ${stars ? `<span class="stars">${stars}</span>` : ''}
        </div>
        ${b.review ? `<div class="card-review">${escapeHtml(b.review)}</div>` : ''}
      </div>
      <div class="card-actions">
        <button class="icon-btn" data-edit="${b.id}" title="수정">✎</button>
        <button class="icon-btn" data-del="${b.id}" title="삭제">✕</button>
      </div>`;
    wrap.appendChild(card);
  });
  $$('[data-edit]', wrap).forEach(btn=> btn.addEventListener('click', ()=> openForm(btn.dataset.edit)));
  $$('[data-del]', wrap).forEach(btn=> btn.addEventListener('click', ()=>{
    if(!confirm('이 책 기록을 삭제할까요?')) return;
    state.books = state.books.filter(b=>b.id!==btn.dataset.del);
    saveBooks(state.books);
    renderCards(); renderShelf();
  }));
}

function openForm(editId){
  const area = $('#formArea');
  if(!area) return;
  const b = editId ? state.books.find(x=>x.id===editId) : null;
  area.innerHTML = `
    <div class="form-card">
      <div class="form-grid">
        <div class="field full"><label>책 제목 *</label>
          <input id="f-title" value="${b?escapeHtml(b.title):''}" placeholder="예: 아몬드" /></div>
        <div class="field"><label>저자</label>
          <input id="f-author" value="${b?escapeHtml(b.author||''):''}" placeholder="예: 손원평" /></div>
        <div class="field"><label>상태</label>
          <select id="f-status">
            <option value="want" ${b?.status==='want'?'selected':''}>읽고 싶음</option>
            <option value="reading" ${b?.status==='reading'?'selected':''}>읽는 중</option>
            <option value="done" ${!b || b.status==='done'?'selected':''}>완료</option>
          </select></div>
        <div class="field full"><label>읽은 기간</label>
          <div class="date-range-row">
            <input id="f-startdate" type="date" value="${b?.startDate||''}" />
            <span class="tilde">부터 ~</span>
            <input id="f-enddate" type="date" value="${b?.endDate||b?.date||''}" />
            <span class="tilde">까지</span>
          </div>
        </div>
        <div class="field"><label>평점</label>
          <div class="star-pick" id="f-stars">
            ${[1,2,3,4,5].map(n=>`<span data-n="${n}" class="${b && b.rating>=n?'on':''}">★</span>`).join('')}
          </div></div>
        <div class="field full"><label>한줄평</label>
          <textarea id="f-review" placeholder="이 책에 대한 한줄평">${b?escapeHtml(b.review||''):''}</textarea></div>
      </div>
      <div class="form-actions">
        <button class="btn ghost" id="f-cancel">취소</button>
        <button class="btn" id="f-save">${b?'수정 저장':'추가하기'}</button>
      </div>
    </div>`;
  let ratingVal = b?.rating || 0;
  $$('#f-stars span', area).forEach(s=>{
    s.addEventListener('click', ()=>{
      ratingVal = parseInt(s.dataset.n);
      $$('#f-stars span', area).forEach(x=> x.classList.toggle('on', parseInt(x.dataset.n)<=ratingVal));
    });
  });
  $('#f-cancel').addEventListener('click', closeForm);
  $('#f-save').addEventListener('click', ()=>{
    const title = $('#f-title').value.trim();
    if(!title){ toast('책 제목을 입력해주세요'); return; }
    const startDate = $('#f-startdate').value;
    const endDate = $('#f-enddate').value;
    if(startDate && endDate && startDate > endDate){
      toast('시작일이 종료일보다 늦을 수 없어요'); return;
    }
    const payload = {
      id: b ? b.id : (Date.now()+Math.random()).toString(36),
      title, author: $('#f-author').value.trim(), status: $('#f-status').value,
      startDate, endDate, rating: ratingVal, review: $('#f-review').value.trim(),
      updatedAt: Date.now(),
    };
    state.books = b ? state.books.map(x=> x.id===b.id ? payload : x) : [...state.books, payload];
    saveBooks(state.books);
    closeForm(); renderCards(); renderShelf();
    toast(b? '수정했어요' : '책장에 추가했어요');
  });
  area.scrollIntoView({behavior:'smooth', block:'center'});
}
function closeForm(){ const area = $('#formArea'); if(area) area.innerHTML=''; }

function initListPage(){
  const addBtn = $('#addBtn');
  if(!addBtn) return;
  addBtn.addEventListener('click', ()=>{
    if($('#formArea').innerHTML.trim()) closeForm(); else openForm(null);
  });
  $$('.chip').forEach(c=>{
    c.addEventListener('click', ()=>{
      $$('.chip').forEach(x=>x.classList.remove('active'));
      c.classList.add('active');
      state.filter = c.dataset.filter;
      renderCards();
    });
  });
  renderCards();
}

// ===== 친구와 함께 (링크 기반 공유, 서버 없음) — board.html =====
function b64encode(obj){ return btoa(unicodeToB64(JSON.stringify(obj))); }
function b64decode(str){ return JSON.parse(b64ToUnicode(atob(str))); }
function unicodeToB64(str){ return encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m,p)=> String.fromCharCode('0x'+p)); }
function b64ToUnicode(str){ return decodeURIComponent(Array.from(str).map(c=> '%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')); }

function myProgress(){
  const done = state.books.filter(b=>b.status==='done' && sameYear(b)).length;
  return { id: state.myId, n: state.settings.nickname || '나', g: state.settings.yearGoal, c: done, t: Date.now() };
}

function initBoardPage(){
  const linkInput = $('#shareLinkInput');
  if(!linkInput) return;

  function buildLink(){
    const code = b64encode(myProgress());
    const url = new URL(window.location.href.split('?')[0]);
    url.search = '?d=' + code;
    linkInput.value = url.toString();
  }
  buildLink();
  window.addEventListener('focus', buildLink);

  $('#copyLinkBtn').addEventListener('click', ()=>{
    linkInput.select();
    try{ document.execCommand('copy'); toast('링크를 복사했어요'); }
    catch(e){ toast('복사에 실패했어요. 직접 선택해 복사해주세요'); }
  });

  // URL에 ?d= 코드가 있으면 friends 목록에 반영 (내 id는 절대 friends로 저장하지 않음)
  const params = new URLSearchParams(window.location.search);
  if(params.get('d')){
    try{
      const data = b64decode(params.get('d'));
      if(data && data.id && data.id !== state.myId){
        let friends = loadFriends();
        friends = friends.filter(f=> f.id !== data.id);
        friends.push(data);
        saveFriends(friends);
        toast((data.n||'친구') + '님의 진행 상황을 받았어요');
      }
    }catch(e){ /* 잘못된 코드 무시 */ }
    window.history.replaceState({}, '', window.location.pathname);
  }

  const pasteBtn = $('#pasteAddBtn');
  if(pasteBtn){
    pasteBtn.addEventListener('click', ()=>{
      const raw = $('#pasteInput').value.trim();
      if(!raw) return;
      try{
        const url = new URL(raw);
        const code = new URLSearchParams(url.search).get('d');
        const data = b64decode(code);
        if(data.id === state.myId){ toast('내 링크는 추가할 수 없어요'); return; }
        let friends = loadFriends();
        friends = friends.filter(f=> f.id !== data.id);
        friends.push(data);
        saveFriends(friends);
        $('#pasteInput').value = '';
        renderBoard();
        toast((data.n||'친구') + '님을 추가했어요');
      }catch(e){ toast('올바른 공유 링크가 아니에요'); }
    });
  }

  renderBoard();
}

function renderBoard(){
  const lb = $('#lbList');
  if(!lb) return;
  const friends = loadFriends().filter(f=> f.id !== state.myId);
  const me = myProgress();
  const all = [...friends, me];

  all.sort((a,b)=> (b.c/Math.max(1,b.g)) - (a.c/Math.max(1,a.g)));
  lb.innerHTML = '';
  all.forEach((e,i)=>{
    const pct = Math.min(100, Math.round((e.c/Math.max(1,e.g))*100));
    const isMe = e.id === state.myId;
    const row = document.createElement('div');
    row.className = 'lb-row';
    row.innerHTML = `
      <div class="lb-rank">${i+1}</div>
      <div class="lb-name">${escapeHtml(e.n)}${isMe?' (나)':''}</div>
      <div class="lb-bar-wrap"><div class="lb-bar" style="width:${pct}%"></div></div>
      <div class="lb-num">${e.c}/${e.g}권</div>
      ${!isMe ? `<button class="lb-del" data-del="${escapeHtml(e.id)}" title="삭제">✕</button>` : '<span style="width:14px"></span>'}
    `;
    lb.appendChild(row);
  });
  if(friends.length===0){
    const note = document.createElement('div');
    note.className = 'empty-state';
    note.innerHTML = `<div class="big">아직 함께하는 친구가 없어요</div>위에서 내 공유 링크를 복사해 친구에게 보내보세요. 친구가 보낸 링크를 열거나 아래에 붙여넣으면 자동으로 추가돼요.`;
    lb.appendChild(note);
  }
  $$('.lb-del', lb).forEach(btn=>{
    btn.addEventListener('click', ()=>{
      let fr = loadFriends().filter(f=> f.id !== btn.dataset.del);
      saveFriends(fr);
      renderBoard();
    });
  });
}

// ===== 기기 간 동기화 (수동, 코드 기반, 서버 없음) — sync.html =====
function exportCode(){
  return b64encode({ v:1, settings: state.settings, books: state.books, exportedAt: Date.now() });
}
function initSyncPage(){
  const exportArea = $('#exportCode');
  if(!exportArea) return;

  function refreshExport(){
    exportArea.value = exportCode();
    const info = $('#exportInfo');
    if(info) info.textContent = `책 ${state.books.length}권 · 목표 ${state.settings.yearGoal}권 포함`;
  }
  refreshExport();

  $('#copyExportBtn').addEventListener('click', ()=>{
    exportArea.select();
    try{ document.execCommand('copy'); toast('코드를 복사했어요'); }
    catch(e){ toast('복사에 실패했어요. 직접 선택해 복사해주세요'); }
  });

  $('#importBtn').addEventListener('click', ()=>{
    const raw = $('#importCode').value.trim();
    if(!raw){ toast('가져올 코드를 붙여넣어주세요'); return; }
    let data;
    try{ data = b64decode(raw); }
    catch(e){ toast('올바른 동기화 코드가 아니에요'); return; }
    if(!data || !Array.isArray(data.books)){ toast('올바른 동기화 코드가 아니에요'); return; }

    // 책 목록은 id 기준으로 합치기 (겹치는 id는 최신 updatedAt 우선)
    const map = {};
    state.books.forEach(b=> map[b.id]=b);
    data.books.forEach(b=>{
      const cur = map[b.id];
      if(!cur || (b.updatedAt||0) > (cur.updatedAt||0)) map[b.id]=b;
    });
    const merged = Object.values(map);
    const addedCount = merged.length - state.books.length;
    state.books = merged;
    saveBooks(state.books);

    if(data.settings){
      const applySettings = confirm(
        `목표 권수(${data.settings.yearGoal}권)와 닉네임(${data.settings.nickname||'미설정'})도 이 코드 기준으로 덮어쓸까요?\n취소하면 책 목록만 합쳐집니다.`
      );
      if(applySettings){
        state.settings = data.settings;
        saveSettings(state.settings);
      }
    }
    $('#importCode').value = '';
    refreshExport();
    toast(`동기화 완료 (새 책 ${Math.max(0,addedCount)}권 반영)`);
  });
}

// ===== 독서 달력 — calendar.html =====
function pad2(n){ return String(n).padStart(2,'0'); }
function ymd(y, m, d){ return y + '-' + pad2(m+1) + '-' + pad2(d); }
function todayStr(){ const t = new Date(); return ymd(t.getFullYear(), t.getMonth(), t.getDate()); }

// 해당 날짜(YYYY-MM-DD)에 읽은 것으로 기록된 책들 (문자열 비교로 시간대 문제 방지)
function booksOnDate(d){
  const today = todayStr();
  return state.books.filter(b=>{
    const s = b.startDate, e = b.endDate || b.date;
    if(s && e) return s <= d && d <= e;
    if(e) return d === e;
    if(s) return b.status === 'reading' ? (s <= d && d <= today) : d === s;
    return false;
  });
}

function initCalendarPage(){
  const grid = $('#calGrid');
  if(!grid) return;
  const now = new Date();
  let cy = now.getFullYear(), cm = now.getMonth();
  let selected = todayStr();
  const WD = ['일','월','화','수','목','금','토'];

  function renderDetail(){
    const box = $('#calDetail');
    const [y, m, d] = selected.split('-').map(Number);
    const wd = WD[new Date(y, m-1, d).getDay()];
    const list = booksOnDate(selected);
    let html = `<h3 class="cal-detail-title">${m}월 ${d}일 (${wd})</h3>`;
    if(list.length === 0){
      html += `<div class="empty-state" style="padding:20px;">이 날 기록된 독서가 없어요. <a href="list.html">독서리스트</a>에서 읽은 기간을 입력해보세요.</div>`;
    } else {
      list.forEach(b=>{
        const stars = b.rating ? '★'.repeat(b.rating) + '☆'.repeat(5-b.rating) : '';
        const range = fmtRange(b);
        const finished = (b.endDate || b.date) === selected && b.status === 'done';
        html += `<div class="card"><div class="card-main">
          <div class="card-title-row">
            <span class="card-title">${escapeHtml(b.title)}</span>
            <span class="badge ${STATUS[b.status].class}">${STATUS[b.status].label}</span>
            ${finished ? '<span class="badge done">✓ 이 날 완독</span>' : ''}
          </div>
          ${b.author ? `<div class="card-author">${escapeHtml(b.author)}</div>` : ''}
          <div class="card-meta">
            ${range ? `<span class="date-range">📅 ${range}</span>` : ''}
            ${stars ? `<span class="stars">${stars}</span>` : ''}
          </div>
          ${b.review ? `<div class="card-review">${escapeHtml(b.review)}</div>` : ''}
        </div></div>`;
      });
    }
    box.innerHTML = html;
  }

  function render(){
    $('#calTitle').textContent = cy + '년 ' + (cm+1) + '월';
    const firstDow = new Date(cy, cm, 1).getDay();
    const daysInMonth = new Date(cy, cm+1, 0).getDate();
    const today = todayStr();
    grid.innerHTML = '';

    WD.forEach((w, i)=>{
      const el = document.createElement('div');
      el.className = 'cal-wd' + (i===0 ? ' sun' : '');
      el.textContent = w;
      grid.appendChild(el);
    });
    for(let i=0; i<firstDow; i++){
      const el = document.createElement('div');
      el.className = 'cal-cell empty';
      grid.appendChild(el);
    }

    let readDays = 0;
    for(let d=1; d<=daysInMonth; d++){
      const ds = ymd(cy, cm, d);
      const list = booksOnDate(ds);
      if(list.length) readDays++;
      const finished = list.some(b=> b.status==='done' && (b.endDate || b.date) === ds);
      const dow = (firstDow + d - 1) % 7;

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'cal-cell' + (dow===0 ? ' sun' : '') + (ds===today ? ' today' : '') + (ds===selected ? ' selected' : '');
      const dots = list.slice(0,4).map(b=> `<span class="cal-dot ${b.status}"></span>`).join('');
      el.innerHTML = `<span class="cal-num">${d}</span>
        <span class="cal-bottom"><span class="cal-dots">${dots}</span>${finished ? '<span class="cal-check">✓</span>' : ''}</span>`;
      el.addEventListener('click', ()=>{ selected = ds; render(); });
      grid.appendChild(el);
    }

    const prefix = cy + '-' + pad2(cm+1);
    const finishedCount = state.books.filter(b=> b.status==='done' && (b.endDate || b.date || '').startsWith(prefix)).length;
    $('#calSummary').textContent = `이달의 완독 ${finishedCount}권 · 독서한 날 ${readDays}일`;
    renderDetail();
  }

  $('#calPrev').addEventListener('click', ()=>{ cm--; if(cm<0){ cm=11; cy--; } render(); });
  $('#calNext').addEventListener('click', ()=>{ cm++; if(cm>11){ cm=0; cy++; } render(); });
  $('#calToday').addEventListener('click', ()=>{
    const t = new Date(); cy = t.getFullYear(); cm = t.getMonth(); selected = todayStr(); render();
  });
  render();
}

// ===== init =====
document.addEventListener('DOMContentLoaded', ()=>{
  initTheme();
  initCookieBanner();
  initGoalControls();
  initNickInput();
  renderShelf();
  initListPage();
  initBoardPage();
  initSyncPage();
  initCalendarPage();
});
