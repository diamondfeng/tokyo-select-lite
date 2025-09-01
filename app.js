(function(){
  const e = React.createElement;
  const {useState, useEffect, useMemo} = React;
  const root = document.getElementById('root');

  // ===== 工具 =====
  const SPONSORED_REL = "sponsored nofollow noopener noreferrer";
  function formatPrice(n, currency){ try{ return new Intl.NumberFormat('zh-TW',{style:'currency',currency:currency||'TWD',maximumFractionDigits:0}).format(Number(n||0)); }catch{return `${n} ${currency||''}`;}}
  function daysFromNow(dateStr){ const one=86400000; const t=new Date(dateStr).getTime(); if(!t) return 999; return Math.floor((Date.now()-t)/one); }
  function withUTM(raw, pid){ try{ const url=new URL(raw); const now=new Date(); const ym=`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`; url.searchParams.set('utm_source','tokyoedit'); url.searchParams.set('utm_medium','site'); url.searchParams.set('utm_campaign',(window.UTM_PREFIX||'select')+ym); url.searchParams.set('utm_content', pid||''); return url.toString(); }catch{ return raw; } }

  // ===== 小圖標（SVG，免安裝） =====
  const Icon = {
    Clock: (props)=> e('svg',{...props,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','strokeWidth':2,'strokeLinecap':'round','strokeLinejoin':'round'}, e('circle',{cx:12,cy:12,r:10}), e('polyline',{points:'12 6 12 12 16 14'})),
    Flame: (props)=> e('svg',{...props,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','strokeWidth':2,'strokeLinecap':'round','strokeLinejoin':'round'}, e('path',{d:'M8.5 14a3.5 3.5 0 1 0 7 0c0-2-1.5-3.5-1.5-5.5 0-2-1.5-3.5-3.5-5-1 2-3 3.5-3 5.5 0 2 .5 2.5 1.5 5z'})),
    Heart: (props)=> e('svg',{...props,viewBox:'0 0 24 24',fill:'currentColor'}, e('path',{d:'M12 21s-7-4.35-9.33-8.07C.77 9.6 2.4 6 5.66 6A4.6 4.6 0 0 1 12 8.26 4.6 4.6 0 0 1 18.34 6c3.26 0 4.89 3.6 3 6.93C19 16.65 12 21 12 21z'})),
    HeartLine: (props)=> e('svg',{...props,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','strokeWidth':2,'strokeLinecap':'round','strokeLinejoin':'round'}, e('path',{d:'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z'})),
    ChevronLeft: (p)=> e('svg',{...p,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','strokeWidth':2,'strokeLinecap':'round','strokeLinejoin':'round'}, e('polyline',{points:'15 18 9 12 15 6'})),
    ChevronRight:(p)=> e('svg',{...p,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','strokeWidth':2,'strokeLinecap':'round','strokeLinejoin':'round'}, e('polyline',{points:'9 18 15 12 9 6'})),
    External:(p)=> e('svg',{...p,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','strokeWidth':2,'strokeLinecap':'round','strokeLinejoin':'round'}, e('path',{d:'M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'}), e('polyline',{points:'15 3 21 3 21 9'}), e('line',{x1:10,y1:14,x2:21,y2:3})),
    Sparkles:(p)=> e('svg',{...p,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','strokeWidth':2,'strokeLinecap':'round','strokeLinejoin':'round'}, e('path',{d:'M5 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z'}), e('path',{d:'M16 7l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z'})),
    Filter:(p)=> e('svg',{...p,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','strokeWidth':2,'strokeLinecap':'round','strokeLinejoin':'round'}, e('polygon',{points:'22 3 2 3 10 12 10 19 14 21 14 12'}))
  };

  // ===== 收藏（LocalStorage） =====
  function useFavorites(){
    const KEY='te_favorites';
    const [fav,setFav]=useState(()=>{ try{ const v=localStorage.getItem(KEY); return v? JSON.parse(v):[] }catch{return[]}});
    useEffect(()=>{ try{ localStorage.setItem(KEY, JSON.stringify(fav)) }catch{} },[fav]);
    const toggle=(id)=> setFav(prev=> prev.includes(id)? prev.filter(x=>x!==id): [...prev,id]);
    return {fav,toggle};
  }

  // ===== 輪播 =====
  function ProductCarousel({images=[], alt}){
    const [idx,setIdx]=useState(0);
    const count=images.length;
    if(!count) return e('div',{className:'aspect-square w-full rounded-xl bg-white border border-neutral-200'});
    const btnBase='absolute top-1/2 -translate-y-1/2 rounded-full border border-neutral-200 bg-white/90 p-2 shadow hover:bg-white';
    return e('div',{className:'relative aspect-square w-full overflow-hidden rounded-xl bg-white'},
      e('img',{src:images[idx],alt,loading:'lazy',decoding:'async',className:'h-full w-full object-contain'}),
      count>1 && e('button',{className:`left-2 ${btnBase}`,'aria-label':'上一張',onClick:()=>setIdx((idx-1+count)%count)}, e(Icon.ChevronLeft,{className:'h-4 w-4'})),
      count>1 && e('button',{className:`right-2 ${btnBase}`,'aria-label':'下一張',onClick:()=>setIdx((idx+1)%count)}, e(Icon.ChevronRight,{className:'h-4 w-4'})),
      count>1 && e('div',{className:'absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1'},
        images.map((_,i)=> e('button',{key:i,onClick:()=>setIdx(i),className:`h-1.5 w-4 rounded-full ${i===idx?'bg-black/80':'bg-black/30'}`,'aria-label':`第 ${i+1} 張`}))
      )
    );
  }

  // ===== 主程式 =====
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
      const src = dataUrl ? dataUrl + (dataUrl.includes('?')?'&':'?') + 't=' + Date.now() : '';
      fetch(src).then(r=>r.json()).then(raw=>{
        const norm = (row)=>{
          const images = Array.isArray(row.images)? row.images : String(row.images||row.image_urls||'').split(/\s*[,\n|]\s*/).filter(Boolean);
          const today = new Date().toISOString().slice(0,10);
          return {
            id:String(row.id||row.ID||Math.random().toString(36).slice(2)),
            name:String(row.name||row.title||''),
            price:Number(row.price||0), currency:String(row.currency||'TWD'),
            images, link:String(row.link||row.url||'#'),
            popularity:Number(row.popularity||0),
            addedAt:String(row.addedAt||row.added_at||row.date||today),
            category:String(row.category||row.cat||'')
          };
        };
        const arr = Array.isArray(raw)? raw.map(norm): [];
        setItems(arr);

        // JSON-LD
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

    // 小開關：項目很少時自動收斂 UI
    const showSearch = items.length >= 6;
    const showSort   = items.length >= 4;
    const showFavBtn = items.length >= 3;
    const showCat    = categories.length > 2;

    return e(React.Fragment, null,
      // 控制列
      e('div',{className:'mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'},
        e('div',{className:'flex items-center gap-2'},
          showSort && e('div',{className:'inline-flex overflow-hidden rounded-md border border-neutral-200'},
            e('button',{className:`flex items-center gap-1 px-3 py-2 text-sm ${sortBy==='latest'?'bg-neutral-900 text-white':'bg-white text-neutral-700'}`,onClick:()=>setSortBy('latest'),'aria-label':'最新'}, e(Icon.Clock,{className:'h-4 w-4'}),'最新'),
            e('button',{className:`flex items-center gap-1 border-l border-neutral-200 px-3 py-2 text-sm ${sortBy==='popular'?'bg-neutral-900 text-white':'bg-white text-neutral-700'}`,onClick:()=>setSortBy('popular'),'aria-label':'人氣'}, e(Icon.Flame,{className:'h-4 w-4'}),'人氣')
          ),
          showFavBtn && e('button',{className:`ml-1 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm border ${onlyFav?'border-neutral-900 bg-neutral-900 text-white':'border-neutral-200 bg-white text-neutral-700'}`,onClick:()=>setOnlyFav(v=>!v),'aria-pressed':onlyFav},
            (onlyFav? e(Icon.Heart,{className:'h-4 w-4'}): e(Icon.HeartLine,{className:'h-4 w-4'})),
            '我的收藏'
          )
        ),
        (showCat || showSearch) && e('div',{className:'flex items-center gap-2'},
          showCat && e('div',{className:'hidden items-center gap-1 text-xs text-neutral-500 sm:flex'}, e(Icon.Filter,{className:'h-3.5 w-3.5'}),'篩選'),
          showCat && e('select',{className:'h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-sm',value:cat,onChange:(ev)=>setCat(ev.target.value)}, categories.map(c=> e('option',{key:c,value:c},c))),
          showSearch && e('input',{className:'h-9 w-48 rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-sm',placeholder:'搜尋品名…',value:q,onChange:(ev)=>setQ(ev.target.value)})
        )
      ),
      // 商品網格
      e('section',{className:'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'},
        sorted.map(p=>{
          const isNew = daysFromNow(p.addedAt) <= 7;
          const link = withUTM(p.link, p.id);
          const liked = fav.includes(p.id);
          return e('article',{key:p.id,className:'overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200/70'},
            e('div',{className:'relative'},
              e('a',{href:link,target:'_blank',rel:'noopener noreferrer','aria-label':`${p.name} 前往購買`},
                e(ProductCarousel,{images:p.images,alt:p.name})
              ),
              e('div',{className:'absolute left-3 top-3 flex gap-2'},
                isNew && e('span',{className:'rounded-full bg-black px-2 py-1 text-xs font-medium text-white'},'新')
              ),
              e('button',{className:'absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow ring-1 ring-neutral-200 hover:bg-white','aria-label':liked?'移除收藏':'加入收藏','aria-pressed':liked,onClick:()=>toggle(p.id)},
                liked ? e(Icon.Heart,{className:'h-4 w-4 text-red-500'}) : e(Icon.HeartLine,{className:'h-4 w-4 text-neutral-700'})
              )
            ),
            e('div',{className:'space-y-2 p-4'},
              e('div',{className:'flex items-start justify-between gap-3'},
                e('h3',{className:'te-line2 text-base font-medium leading-snug'}, p.name),
                e('div',{className:'shrink-0 text-right text-sm font-semibold'}, formatPrice(p.price,p.currency))
              ),
              e('div',{className:'flex items-center justify-between text-xs text-neutral-500'},
                e('span',null,p.category||'日常'),
                e('span',null, sortBy==='latest'? `上架 ${p.addedAt}`: `人氣分數 ${p.popularity||0}`)
              ),
              e('div',{className:'pt-1'},
                e('a',{href:link,target:'_blank',rel:SPONSORED_REL,className:'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 font-medium text-white hover:opacity-90','aria-label':`${p.name} 前往購買`}, '前往購買', e(Icon.External,{className:'h-4 w-4'}))
              )
            )
          )
        })
      )
    );
  }

  ReactDOM.createRoot(root).render(e(App));
})();
