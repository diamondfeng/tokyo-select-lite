(function(){
  const e = React.createElement;
  const root = document.getElementById('root');

  function formatPrice(n, currency){
    try { return new Intl.NumberFormat('zh-TW', {style:'currency', currency: currency || 'TWD', maximumFractionDigits:0}).format(Number(n||0)); }
    catch (_) { return `${n} ${currency||''}`; }
  }
  function daysFromNow(dateStr){
    const one = 86400000; const t = new Date(dateStr).getTime();
    if (!t) return 999;
    return Math.floor((Date.now() - t)/one);
  }
  function withUTM(raw, pid){
    try {
      const url = new URL(raw);
      const now = new Date(); const ym = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`;
      url.searchParams.set("utm_source","tokyoedit");
      url.searchParams.set("utm_medium","site");
      url.searchParams.set("utm_campaign",(window.UTM_PREFIX||"select")+ym);
      url.searchParams.set("utm_content", pid || "");
      return url.toString();
    } catch(_) { return raw; }
  }
  const SPONSORED_REL = "sponsored nofollow noopener noreferrer";

  function Card({p}){
    const isNew = daysFromNow(p.addedAt) <= 7;
    const link = withUTM(p.link, p.id);
    const first = (Array.isArray(p.images) && p.images[0]) || "";
    return e('div', {className:'card', role:'article', 'aria-label': p.name},
      e('div', {className:'media'},
        first ? e('img', {src:first, alt: p.name, loading:'lazy', decoding:'async', sizes:'(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw'}) : null,
        isNew ? e('span', {className:'badge'}, '新') : null
      ),
      e('div', {className:'content'},
        e('div', {className:'row'},
          e('div', {className:'name'}, p.name),
          e('div', {className:'price'}, formatPrice(p.price, p.currency))
        ),
        e('div', {className:'meta'},
          e('span', null, p.category || '日常'),
          e('span', null, p.addedAt ? `上架 ${p.addedAt}` : '')
        ),
        e('a', {className:'buybtn', href:link, target:'_blank', rel: SPONSORED_REL, 'aria-label':`${p.name} 前往購買`}, '前往購買 →')
      )
    );
  }

  function App(){
    const [items, setItems] = React.useState(null);
    const dataUrl = (window.DATA_URL || "").trim();

    React.useEffect(()=>{
      const src = dataUrl ? dataUrl + (dataUrl.includes('?') ? '&':'?') + 't=' + Date.now() : './data/products.sample.json?t=' + Date.now();
      fetch(src).then(r=>r.json()).then(raw=>{
        const norm = (row)=>{
          const images = Array.isArray(row.images) ? row.images :
            String(row.images || row.image_urls || "").split(/\s*[,\n|]\s*/).filter(Boolean);
          const today = new Date().toISOString().slice(0,10);
          return {
            id: String(row.id || row.ID || Math.random().toString(36).slice(2)),
            name: String(row.name || row.title || ""),
            price: Number(row.price || 0),
            currency: String(row.currency || 'TWD'),
            images,
            link: String(row.link || row.url || '#'),
            popularity: Number(row.popularity || 0),
            addedAt: String(row.addedAt || row.added_at || row.date || today),
            category: String(row.category || row.cat || '')
          };
        };
        const arr = Array.isArray(raw) ? raw.map(norm) : [];
        setItems(arr);

        // JSON-LD for SEO
        const ld = {
          "@context":"https://schema.org",
          "@type":"CollectionPage",
          "name":"TOKYO SELECT 選物清單",
          "inLanguage":"zh-Hant",
          "url": location.href,
          "mainEntity":{
            "@type":"ItemList",
            "itemListElement": arr.map((p,i)=>({
              "@type":"Product",
              "position": i+1,
              "name": p.name,
              "image": p.images && p.images[0],
              "brand": p.category || "選物",
              "offers": {"@type":"Offer","price": String(p.price),"priceCurrency": p.currency,"url": withUTM(p.link,p.id)}
            }))
          }
        };
        const tag = document.createElement('script');
        tag.type = 'application/ld+json';
        tag.text = JSON.stringify(ld);
        document.head.appendChild(tag);
      }).catch(()=> setItems([]));
    }, [dataUrl]);

    if (items === null){
      return e('p', null, '載入中…');
    }
    if (!items.length){
      return e('div', null, e('p', null, '目前沒有商品。請稍後再試。'));
    }
    return e('div', {className:'grid'}, items.map(p => e(Card, {p, key:p.id})));
  }

  ReactDOM.createRoot(root).render(e(App));
})();
