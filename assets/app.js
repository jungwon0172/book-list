// ===== 책장 :: 공통 로직 (localStorage 기반, 백엔드 없음) =====
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

const STATUS = {
  reading: { label:'읽는 중', class:'reading' },
  done: { label:'완료', class:'done' },
  want: { label:'읽고 싶음', class:'want' },
};

const LS_KEYS = { settings:'bookshelf.settings', books:'bookshelf.books', friends:'bookshelf.friends' };

function loadSettings(){
  try{
    const raw = localStorage.getItem(LS_KEYS.settings);
    return raw ? JSON.parse(raw) : { nickname:'', yearGoal:50 };
  }catch(e){ return { nickname:'', yearGoal:50 }; }
}
function saveSettings(s){
  try{ localStorage.setItem(LS_KEYS.settings, JSON.stringify(s)); }catch(e){}
}
function loadBooks(){
  try{
    const raw = localStorage.getItem(LS_KEYS.books);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveBooks(books){
  try{ localStorage.setItem(LS_KEYS.books, JSON.stringify(books)); }catch(e){}
}
function loadFriends(){
  try{
    const raw = localStorage.getItem(LS_KEYS.friends);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveFriends(friends){
  try{ localStorage.setItem(LS_KEYS.friends, JSON.stringify(friends)); }catch(e){}
}

let state = {
  settings: loadSettings(),
  books: loadBooks(),
  year: new Date().getFullYear(),
  filter: 'all',
};

function toast(msg){
  let t = $('#toast');
  if(!t){
    t = document.createElement('div');
    t.id = 'toast'; t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(()=> t.classList.remove('show'), 2200);
}

function sameYear(dateStr){
  if(!dateStr) return true;
  return new Date(dateStr).getFullYear() === state.year;
}
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function seededRand(seed){
  const x = Math.sin(seed*999)*10000;
  return x - Math.floor(x);
}

// ===== 쿠키 동의 배너 =====
function initCookieBanner(){
  if(localStorage.getItem('bookshelf.cookieConsent')) return;
  const el = document.createElement('div');
  el.className = 'cookie-banner';
  el.innerHTML = `
    <p>이 사이트는 서비스 개선과 광고 게재를 위해 쿠키를 사용합니다. 자세한 내용은
    <a href="/privacy.html">개인정보처리방침</a>에서 확인하세요.</p>
    <div class="actions">
      <button class="btn small" id="cookieAccept">동의</button>
    </div>`;
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
  const done = state.books.filter(b=>b.status==='done' && sameYear(b.date));
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
  const nick = $('#nickInput');
  if(!nick) return;
  nick.value = state.settings.nickname;
  nick.addEventListener('change', (e)=>{
    state.settings.nickname = e.target.value.trim();
    saveSettings(state.settings);
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
    card.innerHTML = `
      <div class="card-main">
        <div class="card-title-row">
          <span class="card-title">${escapeHtml(b.title)}</span>
          <span class="badge ${STATUS[b.status].class}">${STATUS[b.status].label}</span>
        </div>
        ${b.author ? `<div class="card-author">${escapeHtml(b.author)}</div>` : ''}
        <div class="card-meta">
          ${b.date ? `<span>${b.date}</span>` : ''}
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
        <div class="field"><label>읽은 날짜</label>
          <input id="f-date" type="date" value="${b?.date||''}" /></div>
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
    const payload = {
      id: b ? b.id : (Date.now()+Math.random()).toString(36),
      title, author: $('#f-author').value.trim(), status: $('#f-status').value,
      date: $('#f-date').value, rating: ratingVal, review: $('#f-review').value.trim(),
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
  const done = state.books.filter(b=>b.status==='done' && sameYear(b.date)).length;
  return { n: state.settings.nickname || '나', g: state.settings.yearGoal, c: done, t: Date.now() };
}

function initBoardPage(){
  const linkInput = $('#shareLinkInput');
  if(!linkInput) return;

  // 내 진행 상황으로 공유 링크 생성
  function buildLink(){
    const code = b64encode(myProgress());
    const url = new URL(window.location.href);
    url.search = '?d=' + code;
    linkInput.value = url.toString();
  }
  buildLink();
  const goalInputWatch = $('#goalInput');
  // settings may change on other pages; rebuild link on focus
  window.addEventListener('focus', buildLink);

  $('#copyLinkBtn').addEventListener('click', ()=>{
    linkInput.select();
    try{ document.execCommand('copy'); toast('링크를 복사했어요'); }
    catch(e){ toast('복사에 실패했어요. 직접 선택해 복사해주세요'); }
  });

  // URL에 ?d= 코드가 있으면 friends 목록에 반영
  const params = new URLSearchParams(window.location.search);
  if(params.get('d')){
    try{
      const data = b64decode(params.get('d'));
      if(data && data.n){
        let friends = loadFriends();
        friends = friends.filter(f=> f.n !== data.n);
        friends.push(data);
        saveFriends(friends);
        toast(data.n + '님의 진행 상황을 받았어요');
      }
    }catch(e){ /* 잘못된 코드 무시 */ }
    // URL 정리
    window.history.replaceState({}, '', window.location.pathname);
  }

  // 닉네임으로 직접 추가하기 (같은 기기에서 링크로 못 받은 경우 수동 입력용은 아님 — 코드 붙여넣기)
  const pasteBtn = $('#pasteAddBtn');
  if(pasteBtn){
    pasteBtn.addEventListener('click', ()=>{
      const raw = $('#pasteInput').value.trim();
      if(!raw) return;
      try{
        const url = new URL(raw);
        const code = new URLSearchParams(url.search).get('d');
        const data = b64decode(code);
        let friends = loadFriends();
        friends = friends.filter(f=> f.n !== data.n);
        friends.push(data);
        saveFriends(friends);
        $('#pasteInput').value = '';
        renderBoard();
        toast(data.n + '님을 추가했어요');
      }catch(e){ toast('올바른 공유 링크가 아니에요'); }
    });
  }

  renderBoard();
}

function renderBoard(){
  const lb = $('#lbList');
  if(!lb) return;
  const friends = loadFriends();
  const me = myProgress();
  const all = [...friends.filter(f=>f.n!==me.n), me];
  if(all.length<=1 && friends.length===0){
    lb.innerHTML = `<div class="empty-state"><div class="big">아직 함께하는 친구가 없어요</div>위에서 내 공유 링크를 복사해 친구에게 보내보세요. 친구가 보낸 링크를 열면 자동으로 목록에 추가돼요.</div>`;
  }
  all.sort((a,b)=> (b.c/Math.max(1,b.g)) - (a.c/Math.max(1,a.g)));
  lb.innerHTML = '';
  all.forEach((e,i)=>{
    const pct = Math.min(100, Math.round((e.c/Math.max(1,e.g))*100));
    const isMe = e.n === me.n;
    const row = document.createElement('div');
    row.className = 'lb-row';
    row.innerHTML = `
      <div class="lb-rank">${i+1}</div>
      <div class="lb-name">${escapeHtml(e.n)}${isMe?' (나)':''}</div>
      <div class="lb-bar-wrap"><div class="lb-bar" style="width:${pct}%"></div></div>
      <div class="lb-num">${e.c}/${e.g}권</div>
      ${!isMe ? `<button class="lb-del" data-del="${escapeHtml(e.n)}" title="삭제">✕</button>` : '<span style="width:14px"></span>'}
    `;
    lb.appendChild(row);
  });
  $$('.lb-del', lb).forEach(btn=>{
    btn.addEventListener('click', ()=>{
      let friends = loadFriends().filter(f=> f.n !== btn.dataset.del);
      saveFriends(friends);
      renderBoard();
    });
  });
}

// ===== init =====
document.addEventListener('DOMContentLoaded', ()=>{
  initCookieBanner();
  initGoalControls();
  initNickInput();
  renderShelf();
  initListPage();
  initBoardPage();
});
