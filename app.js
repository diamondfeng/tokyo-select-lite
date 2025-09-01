(function(){
  const e = React.createElement;
  const {useState, useEffect, useMemo} = React;
  const root = document.getElementById('root');

  // ===== 工具 =====
  const SPONSORED_REL = "sponsored nofollow noopener noreferrer";
  function formatPrice(n, currency){
    try{ return new Intl.NumberFormat('zh-TW',{style:'currency',currency:currency||'TWD',maximumFractionDigits:0}).format(Number(n||0)); }
    catch{ return `${n} ${currency||''}`; }
  }
  function fmtYMD(x){
    if (!x) return '';
    if (typeof x === 'string' && x.includes('T')) {
      const d = new Date(x); if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return x.split('T')[0];
    }
    const d = new Date(x);
    return isNaN(d) ? String(x) : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function daysFromNow(dateStr){ const d=new Date(dateStr); const one=86400000; return isNaN(d)?999:Math.floor((Date.now()-d.getTime())/one); }
  function withUTM(raw, pid){
    try{ const url=new URL(raw); const now=new Date(); const ym=`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`;
      url.searchParams.set('utm_source','tokyoedit'); url.searchParams.set('utm_medium','site');
      url.searchParams.set('utm_campaign',(window.UTM_PREFIX||'select')+ym); url.searchParams.set('utm_content', pid||''); return url.toString();
    }catch{ return raw; }
  }
  // 產生穩定 id（當表上沒填時，與後端規則一致）
  function slugify(s){ return String(s||'').toLowerCase().replace(/^https?:\/\//,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,40); }

  // 回報點擊：每次點擊產生唯一 hid；同一次點擊可能送兩次（beacon+GET），伺服器用 hid 去重
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

  // 收藏
  function useFavorites(){
    const KEY='te_favorites';
    const [fav,setFav]=useState(()=>{ try{ const v=localStorage.getItem(KEY); return v? JSON.parse(v):[] }catch{return[]}});
    useEffect(()=>{ try{ localStorage.setItem(KEY, JSON.stringify(fav)) }catch{} },[fav]);
    const toggle=(id)=> setFav(prev=> prev.includes(id)? prev.filter(x=>x!==id): [...prev,id]);
    return {fav,toggle};
  }

  // 輪播
  function ProductCarousel({images=[], alt}){
    const [idx,setIdx]=useState(0);
    const count=images.length;
    if(!count) return e('div',{className:'aspect-square w-full rounded-xl bg-white border border-line'});
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
    const [sortBy,setSortBy]=useState('latest'); // latest | popular
    const [q,setQ]=useState('');
    const [cat,setCat]=useState('全部');
    const [onlyFav,setOnlyFav]=useState(false);
    const {fav,toggle}=useFavorites();
    const dataUrl=(window.DATA_URL||'').trim();

    // 載入資料
    useEffect(()=>{
      if(!dataUrl) return;
      const src = dataUrl + (dataUrl.includes('?')?'&':'?') + 't=' + Date.now();
      fetch(src).then(r=>r.json()).then(raw=>{
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

        // JSON-LD（SEO）
        const ld = {
          "@context":"https://schema.org","@type":"CollectionPage","name":"TOKYO SELECT 選物清單","inLanguage":"zh-Hant","url":location.href,
          "mainEntity":{"@type":"ItemList","itemListElement":arr.map((p,i)=>({"@type":"Product","position":i+1,"name":p.name,"image":p.images&&p.images[0],"brand":p.category||"選物","offers":{"@type":"Offer","price":String(p.price),"priceCurrency":p.currency,"url":withUTM(p.link,p.id)}}))}
        };
        const tag=document.createElement('script'); tag.type='application/ld+json'; tag.text=JSON.stringify(ld); document.head.appendChild(tag);
      }).catch(()=> setItems([]));
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
      // 商品網格（手機優先：價格大、按鈕好點）
      e('section',{className:'grid grid-cols-1 gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3'},
        sorted.map(p=>{
          const isNew = daysFromNow(p.addedAt) <= 7;
          const link = withUTM(p.link, p.id);
          const liked = fav.includes(p.id);
          const price = formatPrice(p.price,p.currency);

          return e('article',{key:p.id,className:'overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line/70'},
            e('div',{className:'relative'},
              e('a',{href:link,target:'_blank',rel:'noopener noreferrer','aria-label':`${p.name} 前往購買`},
                e(ProductCarousel,{images:p.images,alt:p.name})
              ),
              e('div',{className:'absolute left-3 top-3 flex gap-2'},
                isNew && e('span',{className:'rounded-full bg-brand px-2 py-1 text-xs font-medium text-white'},'新')
              ),
              e('button',{className:'absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow ring-1 ring-line hover:bg-white','aria-label':liked?'移除收藏':'加入收藏','aria-pressed':liked,onClick:()=>toggle(p.id)}, liked?'❤️':'🤍')
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
                  onAuxClick: (ev)=>{ if (ev.button === 1) hit(p.id); }, // 中鍵開新分頁也計一次
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
