/* Operación X · comportamiento del marco ancho (menú oculto por defecto + iframes que se ajustan solos).
   Las misiones y los fragmentos incrustados avisan su alto con postMessage; este script ajusta el iframe. */
(function(){
  var de=document.documentElement;
  var KEY='ox-nav',stored=null;
  try{stored=sessionStorage.getItem(KEY)}catch(_e){}
  var hasParam=/[?&]nav=false/.test(location.search);
  var hideNav=hasParam||stored!=='on';
  if(hideNav)de.classList.add('ox-pre');

  function frames(){return Array.prototype.slice.call(document.querySelectorAll('iframe[src*="content/resources/"]'))}
  function docTop(f){return f.getBoundingClientRect().top+(window.pageYOffset||0)}
  function footH(){var s=document.getElementById('siteFooter');return s?Math.ceil(s.getBoundingClientRect().height):0}
  function avail(f){return Math.max(420,Math.floor(window.innerHeight-docTop(f)-footH()))}
  function tell(f){try{f.contentWindow.postMessage({ox:1,t:'avail',h:avail(f)},'*')}catch(_e){}}
  function isFrag(f){return /CANDADO/.test(f.getAttribute('src')||'')}
  function setH(f,h){f.style.height=(isFrag(f)?Math.round(h):Math.max(Math.round(h),avail(f)))+'px'}
  function own(src){return frames().filter(function(f){return f.contentWindow===src})[0]}

  window.addEventListener('message',function(e){
    var d=e.data;if(!d||d.ox!==1)return;
    var f=own(e.source);if(!f)return;
    if(d.t==='hello'){tell(f);return}
    if(d.t==='size'){f.setAttribute('data-oxh',d.h);setH(f,d.h);tell(f);return}
    if(d.t==='top'){var t=docTop(f)-56;if(window.pageYOffset>t)window.scrollTo(0,Math.max(0,t));return}
    if(d.t==='modal'){
      var r=f.getBoundingClientRect(),mid=r.top+r.height/2;
      if(mid<0||mid>window.innerHeight){window.scrollBy(0,mid-window.innerHeight/2)}
    }
  });


  /* Páginas en línea (bienvenida, evaluación, candado): mismo ajuste de tamaño que los juegos, sin iframe */
  var ZOK=!!(window.CSS&&CSS.supports&&CSS.supports('zoom','1.1'));
  var PST=new WeakMap();
  function pages(){return Array.prototype.slice.call(document.querySelectorAll('.ox-page[data-fill]'))}
  function fitPage(h){
    var av=Math.max(300,Math.floor(window.innerHeight-docTop(h)-footH()));
    var tall=+h.getAttribute('data-ref-tall')||600,short=+h.getAttribute('data-ref-short')||600;
    var key=av+'x'+window.innerWidth,st=PST.get(h)||{};
    var set=function(z){h.style.setProperty('--z',String(z))};
    h.style.setProperty('--avail',av+'px');
    if(!ZOK){set(1);return}
    var zmax=Math.max(.8,Math.min(1.3,window.innerWidth/1060,av/(av<800?short:tall)));
    var pick=.75;
    for(var z=zmax;z>=.75;z-=.04){var zz=Math.round(z*100)/100;set(zz);h.style.setProperty('--avail','0px');var nat=h.getBoundingClientRect().height;h.style.setProperty('--avail',av+'px');if(nat<=av){pick=zz;break}}
    set(pick);PST.set(h,{key:key});
  }
  function fitPages(){pages().forEach(fitPage)}
  window.addEventListener('load',fitPages);
  window.addEventListener('resize',function(){clearTimeout(window.__oxpt);window.__oxpt=setTimeout(fitPages,80)});

  var rt=0;
  window.addEventListener('resize',function(){
    clearTimeout(rt);rt=setTimeout(function(){frames().forEach(function(f){tell(f);setH(f,+f.getAttribute('data-oxh')||0)})},80);
  });

  function ready(fn){if(document.readyState!=='loading')fn();else document.addEventListener('DOMContentLoaded',fn)}
  ready(function(){
    /* el tema registra su propio inicio con jQuery; esperamos a que termine de crear el botón del menú */
    setTimeout(function(){
      var b=document.body;
      if(hideNav&&!b.classList.contains('siteNav-off')){
        b.classList.add('siteNav-off');
        try{if(window.eXeUniversalStyle&&!hasParam)window.eXeUniversalStyle.params('add')}catch(_e){}
      }
      de.classList.remove('ox-pre');
      var tg=document.getElementById('siteNavToggler');
      if(tg)tg.addEventListener('click',function(){
        setTimeout(function(){try{sessionStorage.setItem(KEY,b.classList.contains('siteNav-off')?'off':'on')}catch(_e){}
          frames().forEach(function(f){tell(f);setH(f,+f.getAttribute('data-oxh')||0)});fitPages()},30);
      });
      frames().forEach(tell);fitPages();
    },0);
  });
})();
