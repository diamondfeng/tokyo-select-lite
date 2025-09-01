// app.js — TOKYO SELECT 前端 v2.4+favfix
(function(){
  const e = React.createElement;
  const {useState, useEffect, useMemo} = React;
  const root = document.getElementById('root');

  // ===== 工具 =====
  const SPONSORED_REL = "sponsored nofollow noopener noreferrer";
  const CACHE_KEY = "te_items_cache_v1";
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

  function formatPrice(n, currency){
    try{
      return new Intl.NumberFormat('zh-TW', {
        style:'currency', currency:currency||'TWD', maximumFractionDigits:0
      }).format(Number(n||0));
    }catch{ return `${n} ${currency||''}`; }
  }
  function fmtYMD(x){
    if (!x) return '';
    if (typeof x === 'string' && x.includes('T')) {
      const d = new Date(x);
      if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return x.split('T')[0];
    }
    const d = new Date(x);
    return isNaN(d) ? String(x) : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function daysFromNow(dateStr){
    const d=new Date(dateStr), ONE=86400000;
    return isNaN(d)?999:Math.floor((Date.now()-d.getTime())/ONE);
  }
  function withUTM(raw, pid){
    try{
      const url=new URL(raw);
      const now=new Date(); const ym=`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`;
      url.searchParams.set('utm_source','tokyoedit');
      url.searchParams.set('utm_medium','site');
      url.searchParams.set('utm_campaign',(window.UTM_PREFIX||'select')+ym);
      url.searchParams.set('utm_content', pid||'');
      return url.toString();
    }catch{ return raw; }
  }
  function slugify(s){
    return String(s||'').toLowerCase()
      .replace(/^https?:\/\//,'').replace(/[^a-z0-9]+/g,'-')
      .replace(/(^-|-$)/g,'').slice(0,40);
  }

  // 回報點擊：每次點擊帶唯一 hid；伺服器以 hid 去重（同人多次點皆算）
  function hit(id){
    try{
      const u = new URL(window.DATA_URL);
      const hid = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      u.searchParams.set('action','hit');
      u.searchParams.set('id', id);
      u.searchParams.set('ua', navigator.userAgent || '');
      u.searchParams.set('ref', location.href || '');
      u.searchParams.set('hid', hid);
      u.searchParams.set('t', String(Date.now())); // 防快取

      // 1) Beacon（POST）
      if (navigator.sendBeacon){
        const blob = new Blob(['1'], {type:'text/plain'});
        navigator.sendBeacon(u.toString(), blob);
      }
      // 2) 備援 GET（keepalive）
      fetch(u.toString(), {method:'GET', mode:'no-cors', keepalive:true, cache:'no-store'}).catch(()=>{});
    }catch{}
  }

  // 收藏（本機）
  function useFavorites(){
    const KEY='te_favorites';
    const [fav,setFav]=useState(()=>{ try{
      const v=localStorage.getItem(KEY); return v? JSON.parse(v):[];
    }catch{return[];}});
    useEffect(()=>{ try{ localStorage.setItem(KEY, JSON.stringify(fav)); }catch{} },[fav]);
    const toggle=(id)=> setFav(prev=> prev.includes(id)? prev.filter(x=>x!==id): [...prev,id]);
    return {fav,toggle};
  }

  // Skeleton 動效
  const style = document.createElement('style');
  style.textContent = `
    @keyframes te-shimmer { 0%{background-position:-200px 0} 100%{background-position:200px 0} }
    .te-skel { background:linear-gradient(90deg,#f3efe7 0,#ece6db 50%,#f3efe7 100%); background-size:400px 100%; animation:te-shimmer 1.2s infinite; }
  `;
  document.head.appendChild(style);

  // 圖片輪播
  function ProductCarousel({images=[], alt}){
    const [idx,setIdx]=useState(0);
    const count=images.length;
    if(!count) return e('div',{className:'aspect-square w-full rounded-xl bg-white border border-line te-skel'});
    const btnBase='absolute top-1/2 -translate-y-1/2 rounded-full border border-line bg-white/90 p-2 shadow hover:bg-white';
    return e('div',{className:'relative aspect-square w-full overflow-hidden rounded-xl bg-white'},
      e('img',{src:images[idx],alt,loading:'lazy',decoding:'async',className:'h-full w-full object-contain'}),
      count>1 && e('button',{className:`left-2 ${btnBase}`,'aria-label':'上一張',onClick:()=>setIdx((idx-1+count)%count)}, '◀'),
      count>1 && e('button',{className:`right-2 ${btnBase}`,'aria-label':'下一張',onClick:()=>setIdx((idx+1)%count)}, '▶'),
      count>1 && e('div',{className:'absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1'},
        images.map((_,i)=> e('button',{key:i,onClick:()=>setIdx(i),className:`h-1.5 w-4 rounded-full ${i===idx?'bg-black/80':'bg-black/30'}`,'aria-label':`第 ${i+1} 張`}))
      )
    );
  }

  // 主程式
  function App(){
    const [items,setItems]=useState([]);
    const [loading,setLoading]=useState(true);
    const [sortBy,setSortBy]=useState('latest'); // 'latest' | 'popular'
    const [q,setQ]=useState('');
    const [cat,setCat]=useState('全部');
    const [onlyFav,setOnlyFav]=useState(false);
    const {fav,toggle}=useFavorites(); // ★ 只在這裡呼叫一次

    const dataUrl=(window.DATA_URL||'').trim();

    // 1) 讀 localStorage 快取，秒出畫面
    useEffect(()=>{
      try{
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw){
          const {ts,data} = JSON.parse(raw);
          if (Array.isArray(data) && Date.now()-ts < CACHE_TTL){
            setItems(data);
            setLoading(false);
          }
        }
      }catch{}
    },[]);

    // 2) 背景抓最新 → 更新畫面 & 回存快取
    useEffect(()=>{
      if(!dataUrl) return;
      const src = dataUrl + (dataUrl.includes('?')?'&':'?') + 'v=1';
      fetch(src, {cache:'no-cache'})
        .then(r=>r.json())
        .then(raw=>{
          const norm = (row)=>{
            const images = Array.isArray(row.images)? row.images : String(row.images||row.image_urls||'').split(/\s*[,\n|]\s*/).filter(Boolean);
            const today = new Date().toISOString().slice(0,10);
            const derivedId = slugify(row.name || row.title || row.link || '');
            return {
              id:String(row.id || row.ID || derivedId || ('p'+Math.random().toString(36).slice(2,8))),
              name:String(row.name||row.title||''),
              price:Number(row.price||0), currency:String(row.currency||'TWD'),
              images, link:String(row.link||row.url||'#'),
              popularity:Number(row.popularity||0),
              addedAt:fmtYMD(row.addedAt || row.added_at || row.date || today),
              category:String(row.category||row.cat||'')
            };
          };
          const arr = Array.isArray(raw)? raw.map(norm): [];
          setItems(arr);
          setLoading(false);
          try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts:Date.now(), data:arr})); }catch{}

          // JSON-LD（建一次即可）
          if (!document.querySelector('script[type="application/ld+json"][data-te]')){
            const ld = {
              "@context":"https://schema.org","@type":"CollectionPage","name":"TOKYO SELECT 選物清單","inLanguage":"zh-Hant","url":location.href,
              "mainEntity":{"@type":"ItemList","itemListElement":arr.map((p,i)=>({"@type":"Product","position":i+1,"name":p.name,"image":p.images&&p.images[0],"brand":p.category||"選物","offers":{"@type":"Offer","price":String(p.price),"priceCurrency":p.currency,"url":withUTM(p.link,p.id)}}))}
            };
            const tag=document.createElement('script'); tag.type='application/ld+json'; tag.dataset.te='1'; tag.text=JSON.stringify(ld); document.head.appendChild(tag);
          }
        })
        .catch(()=>{ setLoading(false); });
    }, [dataUrl]);

    const categories = useMemo(()=> ['全部', ...Array.from(new Set(items.map(p=>p.category).filter(Boolean)))], [items]);

    const baseFiltered = useMemo(()=> items
      .filter(p=> cat==='全部'? true : p.category===cat)
      .filter(p=> (p.name||'').toLowerCase().includes(q.toLowerCase().trim()))
      .filter(p=> onlyFav? fav.includes(p.id): true)
    , [items,cat,q,onlyFav,fav]);

    const sorted = useMemo(()=>{
      if (sortBy==='latest'){
        return [...baseFiltered].sort((a,b)=> Number(new Date(b.addedAt)) - Number(new Date(a.addedAt)));
      }
      return [...baseFiltered].sort((a,b)=> (b.popularity||0) - (a.popularity||0));
    }, [baseFiltered,sortBy]);

    // Skeleton（首次沒快取時）
    if (loading && items.length === 0){
      return e('section',{className:'grid grid-cols-1 gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3'},
        [0,1,2].map(i=> e('article',{key:i,className:'overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line/70'},
          e('div',{className:'aspect-square w-full te-skel'}),
          e('div',{className:'space-y-2 p-4'},
            e('div',{className:'h-4 w-3/4 te-skel rounded'}),
            e('div',{className:'h-3 w-1/3 te-skel rounded'}),
            e('div',{className:'h-6 w-24 te-skel rounded'}),
            e('div',{className:'h-10 w-full te-skel rounded'})
          )
        ))
      );
    }

    // 控制列
    const showSearch = true, showSort = true, showFavBtn = true, showCat = true;

    return e(React.Fragment, null,
      e('div',{className:'mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'},
        e('div',{className:'flex items-center gap-2'},
          showSort && e('div',{className:'inline-flex overflow-hidden rounded-full border border-line'},
            e('button',{className:`px-3 py-2 text-sm ${sortBy==='latest'?'bg-ink text-white':'bg-white text-neutral-700'}`,onClick:()=>setSortBy('latest'),'aria-label':'最新'}, '🕒 最新'),
            e('button',{className:`border-l border-line px-3 py-2 text-sm ${sortBy==='popular'?'bg-ink text-white':'bg-white text-neutral-700'}`,onClick:()=>setSortBy('popular'),'aria-label':'人氣'}, '🔥 人氣')
          ),
          showFavBtn && e('button',{className:`ml-1 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm border ${onlyFav?'border-ink bg-ink text-white':'border-line bg-white text-neutral-700'}`,onClick:()=>setOnlyFav(v=>!v),'aria-pressed':onlyFav}, onlyFav?'❤️':'🤍','我的收藏')
        ),
        (showCat || showSearch) && e('div',{className:'flex items-center gap-2'},
          showCat && e('span',{className:'hidden items-center gap-1 text-xs text-neutral-600 sm:flex'}, '篩選'),
          showCat && e('select',{className:'h-9 rounded-lg border border-line bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30',value:cat,onChange:(ev)=>setCat(ev.target.value)}, categories.map(c=> e('option',{key:c,value:c},c))),
          showSearch && e('input',{className:'h-9 w-40 sm:w-48 rounded-lg border border-line bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30',placeholder:'搜尋品名…',value:q,onChange:(ev)=>setQ(ev.target.value)})
        )
      ),

      // 商品網格（手機優先：價格顯著、按鈕好點）
      e('section',{className:'grid grid-cols-1 gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3'},
        sorted.map(p=>{
          const isNew = daysFromNow(p.addedAt) <= 7;
          const link = withUTM(p.link, p.id);
          const liked = fav.includes(p.id);               // ★ 用外層 hook 的狀態
          const price = formatPrice(p.price,p.currency);

          return e('article',{key:p.id,className:'overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line/70'},
            e('div',{className:'relative'},
              e('a',{href:link,target:'_blank',rel:'noopener noreferrer','aria-label':`${p.name} 前往購買`},
                e(ProductCarousel,{images:p.images,alt:p.name})
              ),
              e('div',{className:'absolute left-3 top-3 flex gap-2'},
                isNew && e('span',{className:'rounded-full bg-brand px-2 py-1 text-xs font-medium text-white'},'新')
              ),
              // ❤ 收藏（liked 時變紅）
              e('button',{
                className:'absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow ring-1 ring-line hover:bg-white',
                'aria-label': liked ? '移除收藏' : '加入收藏',
                'aria-pressed': liked,
                onClick:()=> toggle(p.id)
              },
                e('svg',{
                  xmlns:'http://www.w3.org/2000/svg', viewBox:'0 0 24 24',
                  width:18, height:18, className: liked ? 'text-red-500' : 'text-neutral-700', style:{display:'block'}
                },
                  e('path',{
                    d:'M12.001 20.727s-6.418-3.72-9.2-7.41C1.36 11.3 2.02 7.9 4.79 6.36c2.08-1.17 4.64-.58 6.01 1.1 1.37-1.68 3.93-2.27 6.01-1.1 2.77 1.54 3.44 4.94 1.99 6.957-2.78 3.69-9.2 7.42-9.2 7.42z',
                    fill: liked ? 'currentColor' : 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linejoin':'round'
                  })
                )
              )
            ),
            e('div',{className:'space-y-2 p-4'},
              e('h3',{className:'te-line2 text-base sm:text-[15px] font-medium leading-snug'}, p.name),
              e('div',{className:'flex items-center justify-between text-xs text-neutral-600'},
                e('span',null,p.category||'日常'),
                e('span',null, sortBy==='latest'? `上架 ${fmtYMD(p.addedAt)}`: `人氣分數 ${p.popularity||0}`)
              ),
              e('div',{className:'pt-1'},
                e('div',{className:'text-lg sm:text-base font-extrabold tracking-wide'}, price)
              ),
              e('div',null,
                e('a',{
                  href: link, target: '_blank', rel: SPONSORED_REL,
                  onClick: ()=> hit(p.id),
                  onAuxClick: (ev)=>{ if (ev.button === 1) hit(p.id); }, // 中鍵也計一次
                  className:'mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand bg-brand px-4 py-2.5 text-[15px] font-semibold text-white shadow-sm hover:opacity-90 active:translate-y-[1px]',
                  'aria-label': `${p.name} 前往購買`
                }, '前往購買 →')
              )
            )
          )
        })
      )
    );
  }

  ReactDOM.createRoot(root).render(e(App));
})();
