(() => {
'use strict';
const $ = (sel,root=document)=>root.querySelector(sel);
const $$ = (sel,root=document)=>Array.from(root.querySelectorAll(sel));
const d = window.GUIDE;
const esc = val=>String(val ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const saved=(key,fallback)=>{try{const v=localStorage.getItem(key);return v===null?fallback:JSON.parse(v)}catch{return fallback}};
const store=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v))}catch{}};
const ROUTE_KEY='ashsilent-guide-route-v1',CHECK_KEY='ashsilent-guide-check-v1',OBJECT_KEY='ashsilent-guide-objects-v1',ERA_KEY='ashsilent-guide-era-v1';
let mode=saved(ROUTE_KEY,'deep'),checked=saved(CHECK_KEY,[]),seen=saved(OBJECT_KEY,[]),eraId=saved(ERA_KEY,'prehistory'),filter='all',expandedStop='prehistory';
if(!['quick','deep','full'].includes(mode))mode='deep';if(!Array.isArray(checked))checked=[];if(!Array.isArray(seen))seen=[];
let notifyTimer;
function toast(msg){const e=$('#toast');e.textContent=msg;e.classList.add('show');clearTimeout(notifyTimer);notifyTimer=setTimeout(()=>e.classList.remove('show'),2200)}
function formatTime(n){const v=((n%(24*60))+(24*60))%(24*60);return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`}
function timeMins(){const t=$('#startTime').value.split(':');return Number(t[0])*60+Number(t[1])}
function getStops(){return d.itinerary.filter(s=>s.mins[mode]>0)}
const topics={food:'透过谷物种类、炊煮器具、宴席与礼器，观察粮食生产、烹饪技术及不同阶层的饮食差异。注意：祭祀用的青铜食器，不等于当时每一个家庭的日常厨房。',money:'沿贝币、刀布币、秦半两、汉五铢、唐开元通宝至交子、会子和明清白银，思考货币的使用成本、国家铸币权与发行信用。纸币产生不是金属货币突然消失，而是多种支付安排同时存在。',china:'沿早期瓷器、唐代窑业、宋代名窑到元明清青花与外销瓷，观察原料、窑炉、工匠集群、运输与国际消费市场。高技术水平不必然等于现代机械化工业。',clothing:'留意礼服、官服、日常服饰与织物技术的差别。衣冠制度把身份秩序转化为可见的色彩和形制，丝织与棉织发展又连接农业、手工业与贸易。'};
function renderRoute(){
 $$('.mode-btn').forEach(b=>{let active=b.dataset.mode===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
 const stops=getStops();let t=timeMins();let sum=stops.reduce((a,s)=>a+s.mins[mode],0);let hours=Math.floor(sum/60),mins=sum%60;
 $('#routeTotal').textContent=`预计 ${hours} 小时${mins?' '+mins+' 分钟':''} · ${formatTime(t)}—${formatTime(t+sum)} · 含入馆与休息`;
 $('#itinerary').innerHTML=stops.map((s,i)=>{let begin=t;let duration=s.mins[mode];t+=duration;let done=checked.includes(s.id),on=expandedStop===s.id;
  return `<div class="route-stop ${done?'is-complete':''} ${on?'expanded':''}" id="stop-${esc(s.id)}"><button class="stop-trigger" data-stop="${esc(s.id)}" aria-expanded="${on}" aria-controls="detail-${esc(s.id)}"><span class="stop-time">${formatTime(begin)}<br><span class="stop-meta">${duration} MIN</span></span><span><span class="stop-meta">${String(i+1).padStart(2,'0')} / ${esc(s.zone)}</span><span class="stop-heading">${esc(s.title)} ${done?'✓':''}</span></span><span class="stop-arrow">＋</span></button>${on?`<div class="stop-details" id="detail-${esc(s.id)}"><p>${esc(s.blurb)}</p>${topics[s.id]?`<p>${esc(topics[s.id])}</p>`:''}<div class="stop-actions"><button class="tiny-btn ${done?'complete':''}" data-check-stop="${esc(s.id)}">${done?'✓ 已完成 · 再次点击取消':'○ 标记已参观'}</button>${s.type==='era'?`<button class="tiny-btn" data-open-era="${esc(s.id)}">阅读完整历史讲解 ↗</button>`:''}</div></div>`:''}</div>`
 }).join('');
 $$('.stop-trigger').forEach(b=>b.addEventListener('click',()=>{expandedStop=expandedStop===b.dataset.stop?'':b.dataset.stop;renderRoute()}));
 $$('[data-check-stop]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.checkStop;checked=checked.includes(id)?checked.filter(x=>x!==id):[...checked,id];store(CHECK_KEY,checked);renderRoute();renderProgress();toast(checked.includes(id)?'这一站已完成。':'已取消该站打卡。')}));
 $$('[data-open-era]').forEach(b=>b.addEventListener('click',()=>{setEra(b.dataset.openEra);document.getElementById('history').scrollIntoView({behavior:'smooth'})}));
 const end=timeMins()+sum;if(end>17*60+30 && mode!=='quick')$('#routeTotal').title='结束时间可能晚于当日闭馆；请提前入馆或缩短部分专题展。';else $('#routeTotal').title='参观时间为估算，遇排队需顺延';
}
function renderProgress(){const stops=getStops(),complete=stops.filter(s=>checked.includes(s.id)).length,percent=Math.round(complete/stops.length*100);$('#progressPercentage').textContent=`${percent}%`;$('#progressCircle').style.background=`conic-gradient(#c9a777 ${percent}%,#445554 ${percent}%)`;$('#progressText').textContent=percent===100?'今天的旅程已全部完成，愿这些器物常留在记忆里。':`已参观 ${complete}/${stops.length} 站。每一次驻足，都在接近历史。`}
function renderEras(){
 $('#eraNav').innerHTML=d.eras.map((e,i)=>`<button class="era-tab" role="tab" id="tab-${esc(e.id)}" aria-controls="eraContent" aria-selected="${e.id===eraId}" tabindex="${e.id===eraId?'0':'-1'}" data-era="${esc(e.id)}"><span class="era-num">CHAPTER ${String(i+1).padStart(2,'0')}</span><strong>${esc(e.name)}</strong><small>${esc(e.short)}</small></button>`).join('');
 $$('[data-era]').forEach(b=>b.addEventListener('click',()=>setEra(b.dataset.era)));
 setEra(eraId,false);
}
function setEra(id,scroll=false){const e=d.eras.find(a=>a.id===id)||d.eras[0],i=d.eras.indexOf(e);eraId=e.id;store(ERA_KEY,id);
 $$('.era-tab').forEach(b=>{const active=b.dataset.era===id;b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1});
 let chapters=e.chapters.map((c,j)=>`<section class="era-chapter"><h4>${String(j+1).padStart(2,'0')}. ${esc(c[0])}</h4>${c.slice(1).map(p=>`<p>${esc(p)}</p>`).join('')}</section>`).join('');
 let objs=e.objects.map(objectId=>{let ob=d.artifacts.find(a=>a.id===objectId);return ob?`<a class="era-artifact-link" href="#artifact-${esc(ob.id)}">${esc(ob.name)}<small>${esc(ob.era)} ↗</small></a>`:''}).join('');
 $('#eraContent').innerHTML=`<div class="era-main"><span class="era-label">CHAPTER ${String(i+1).padStart(2,'0')} / HISTORICAL CONTEXT</span><h3>${esc(e.name)}<br><span class="era-dates">${esc(e.dates)}</span></h3><p class="era-abstract">${esc(e.lead)}</p>${chapters}<button class="era-next" id="nextEra" type="button">${i===7?'回到第一个时代 ↗':`继续阅读 · ${esc(d.eras[i+1].name)} ↗`}</button></div><aside class="era-aside"><h4>重点文物 / WHAT TO SEE</h4>${objs}<div class="era-question"><h5>展厅里的一个问题</h5><p>${esc(e.question)}</p></div><p class="era-caution"><strong>史料边界：</strong>${esc(e.caution)}</p></aside>`;
 $('#nextEra').addEventListener('click',()=>{setEra(d.eras[(i+1)%8].id);$('#eraNav').scrollIntoView({behavior:'smooth',block:'start'})});
 if(scroll)$('#eraContent').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderArtifacts(){
 const assets = window.IMAGE_ASSETS || {};
 const shown = d.artifacts.filter(o=>filter==='all'||o.group===filter);
 $('#treasureGrid').innerHTML = shown.map(o=>{
   const meta=assets[o.id]||{};
   const done=seen.includes(o.id);
   const photoUrl=meta.src||'';
   const origin=meta.source || (o.image?'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(o.image.replace(/ /g,'_')):'');
   const photo=photoUrl ? '<a class="treasure-image-link" href="'+esc(origin)+'" target="_blank" rel="noopener noreferrer" aria-label="打开'+esc(o.name)+'的原始照片与许可"><img src="'+esc(photoUrl)+'" alt="'+esc(meta.caption||o.name)+'" loading="lazy" decoding="async" onerror="this.parentElement.parentElement.classList.add(&quot;failed&quot;)"></a>' : '';
   const missing = '<div class="picture-unavailable"><span>文物影像暂不可用</span><small>图片未通过本地资源检查，请从来源页查看。</small>'+(origin?'<a href="'+esc(origin)+'" target="_blank" rel="noopener noreferrer">查看原始照片 ↗</a>':'')+'</div>';
   const credits=origin?'<a class="photo-source" href="'+esc(origin)+'" target="_blank" rel="noopener noreferrer" title="查看照片来源及开放许可">摄影：'+esc(meta.author||o.author||'Wikimedia Commons')+' · '+esc(meta.license||o.license||'查看许可')+' ↗</a>':'<span class="photo-source">待补充馆藏实拍图</span>';
   return '<article class="treasure-card" id="artifact-'+esc(o.id)+'"><div class="treasure-photo '+(photoUrl?'has-photo':'failed')+'">'+photo+missing+'</div><div class="treasure-body"><span class="treasure-era">'+esc(o.era)+'</span><h3>'+esc(o.name)+'</h3>'+(meta.representative?'<span class="representative-note">专题代表性实物照片</span>':'')+'<p>'+esc(o.description)+'</p><p style="font-size:11px;color:#d8c49e"><b>现场看点：</b>'+esc(o.look)+'</p><p style="font-size:11px"><b>注意：</b>'+esc(o.note)+'</p><div class="treasure-meta"><button class="check-btn '+(done?'done':'')+'" data-object="'+esc(o.id)+'">'+(done?'✓ 已看过':'○ 文物打卡')+'</button>'+credits+'</div></div></article>';
 }).join('');
 $$('[data-object]').forEach(b=>b.addEventListener('click',()=>{
  const id=b.dataset.object;
  seen=seen.includes(id)?seen.filter(x=>x!==id):[...seen,id];
  store(OBJECT_KEY,seen);renderArtifacts();
  toast(seen.includes(id)?'已记录这件文物。':'已取消文物记录。');
 }));
}
function renderEssays(){
 $('#essays').innerHTML=d.essays.map((e,i)=>`<article class="essay"><span class="essay-no">ESSAY / ${String(i+1).padStart(2,'0')}</span><h3>${esc(e.title)}</h3><span class="era-label">${esc(e.subtitle)}</span><p>${esc(e.summary)}</p><div class="deep-para">${e.details.map(t=>`<p>${esc(t)}</p>`).join('')}</div><button class="essay-toggle" type="button" aria-expanded="false">展开阅读全文 ＋</button></article>`).join('');
 $$('.essay-toggle').forEach(b=>b.addEventListener('click',()=>{const e=b.closest('.essay');e.classList.toggle('expanded');const show=e.classList.contains('expanded');b.textContent=show?'收起文章 −':'展开阅读全文 ＋';b.setAttribute('aria-expanded',show)}));
}
function doSearch(q){const needle=q.trim().toLowerCase(),output=$('#searchResults');if(!needle){output.innerHTML='<p>可以搜索历史时代、文物名称与关键词。</p>';return}
 const matches=[];d.eras.forEach(e=>{let text=[e.name,e.short,e.lead,...e.chapters.flat()].join(' ').toLowerCase();if(text.includes(needle))matches.push({type:'时代讲解',label:e.name,detail:e.short,id:e.id,kind:'era'})});d.artifacts.forEach(o=>{const t=Object.values(o).filter(x=>typeof x==='string').join(' ').toLowerCase();if(t.includes(needle))matches.push({type:'文物图鉴',label:o.name,detail:o.era,id:o.id,kind:'artifact'})});d.essays.forEach((e,i)=>{if([e.title,e.subtitle,e.summary,...e.details].join(' ').toLowerCase().includes(needle))matches.push({type:'深度阅读',label:e.title,detail:e.subtitle,id:i,kind:'essay'})});
 output.innerHTML=matches.length?matches.slice(0,20).map(m=>`<button data-search-kind="${m.kind}" data-search-id="${esc(m.id)}"><small>${esc(m.type)} / ${esc(m.detail)}</small>${esc(m.label)} ↗</button>`).join(''):'<p>没有搜索到对应内容。可以试试“青铜”“唐”“货币”等关键词。</p>';
 $$('[data-search-kind]').forEach(b=>b.addEventListener('click',()=>{const kind=b.dataset.searchKind,id=b.dataset.searchId;closeSearch();if(kind==='era'){setEra(id);$('#history').scrollIntoView({behavior:'smooth'})}if(kind==='artifact'){filter='all';updateFilters();renderArtifacts();document.getElementById('artifact-'+id)?.scrollIntoView({behavior:'smooth'})}if(kind==='essay'){$$('.essay')[Number(id)]?.scrollIntoView({behavior:'smooth'})}}));
}
function openSearch(){$('#searchModal').hidden=false;document.body.classList.add('modal-open');$('#searchInput').focus();doSearch('')}
function closeSearch(){$('#searchModal').hidden=true;document.body.classList.remove('modal-open')}
function updateFilters(){$$('.filter').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter))}
function copyText(value){if(navigator.clipboard?.writeText){navigator.clipboard.writeText(value).then(()=>toast('已复制到剪贴板。')).catch(()=>fallbackCopy(value))}else fallbackCopy(value)}
function fallbackCopy(value){const t=document.createElement('textarea');t.value=value;t.style.cssText='position:fixed;left:-2000px';document.body.appendChild(t);t.select();try{document.execCommand('copy');toast('已复制到剪贴板。')}catch{toast('复制失败，请手动选择文本。')}t.remove()}
function setup(){
 // The sticky header is always visible, so native #top navigation can
 // mistakenly treat it as the destination without scrolling the document.
 // Force an actual scroll to the document origin for both return links.
 $('a[href="#top"]').forEach(link => link.addEventListener('click', event => {
   event.preventDefault();
   if (location.hash) {
     try { history.replaceState(history.state, '', location.pathname + location.search); }
     catch (_) { /* A history-restricted browser can still scroll. */ }
   }
   const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   try { window.scrollTo({top: 0, left: 0, behavior: reducedMotion ? 'instant' : 'smooth'}); }
   catch (_) { window.scrollTo(0, 0); }
 }));
 $$('.mode-btn').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;store(ROUTE_KEY,mode);expandedStop=getStops()[1]?.id||'enter';renderRoute();renderProgress();toast(`已切换为${mode==='quick'?'精华版':mode==='deep'?'深度版':'全天版'}路线`)}));
 $('#startTime').addEventListener('change',renderRoute);
 $('#resetProgress').addEventListener('click',()=>{if(!confirm('确定要清空全部路线打卡记录吗？文物图鉴打卡不受影响。'))return;checked=[];store(CHECK_KEY,checked);renderRoute();renderProgress();toast('参观进度已重置。')});
 $('#copyRoute').addEventListener('click',()=>{let t=timeMins();const out=getStops().map((s,i)=>{const line=`${String(i+1).padStart(2,'0')}. ${formatTime(t)}—${formatTime(t+s.mins[mode])} ${s.title}（${s.zone}）`;t+=s.mins[mode];return line});copyText('国博漫游 · '+(mode==='quick'?'精华版':mode==='deep'?'深度版':'全天版')+'\n'+out.join('\n')+'\n\n展陈和开放时间以中国国家博物馆官网为准。')});
 $$('.filter').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;updateFilters();renderArtifacts()}));
 $('#searchToggle').addEventListener('click',openSearch);$('#searchClose').addEventListener('click',closeSearch);$('[data-close-search]').addEventListener('click',closeSearch);$('#searchInput').addEventListener('input',e=>doSearch(e.target.value));window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#searchModal').hidden)closeSearch();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#searchModal').hidden?openSearch():closeSearch()}});
 $('#menuToggle').addEventListener('click',()=>{const show=$('#mobileNav').classList.toggle('show');$('#menuToggle').setAttribute('aria-expanded',show)});$$('#mobileNav a').forEach(a=>a.addEventListener('click',()=>{$('#mobileNav').classList.remove('show');$('#menuToggle').setAttribute('aria-expanded',false)}));
 let scheduled=false;addEventListener('scroll',()=>{if(!scheduled){requestAnimationFrame(()=>{const body=document.documentElement;const max=body.scrollHeight-innerHeight;$('#scrollLine').style.width=(max>0?Math.max(0,Math.min(100,scrollY/max*100)):0)+'%';scheduled=false});scheduled=true}},{passive:true});
 // Native tab keyboard navigation.
 $('#eraNav').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=d.eras.findIndex(a=>a.id===eraId);const next=e.key==='Home'?0:e.key==='End'?7:e.key==='ArrowLeft'?(i+7)%8:(i+1)%8;setEra(d.eras[next].id);$(`[data-era="${d.eras[next].id}"]`).focus()});
 renderRoute();renderProgress();renderEras();renderArtifacts();renderEssays();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();