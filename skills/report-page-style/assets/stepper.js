/* report-page-style stepper.js — 分步播放（扩展项）。复制进页面的 <script>。
   用法：<figure class="stepper"> 内放 .stage（含带 data-s="N" 的元素，N 从 1 起；data-hot="N" 表示第 N 步高亮）、
   <ol class="caps" hidden><li>第 1 步说明</li>…</ol>、<div class="ctl"></div>、<p class="cap"></p>。
   打开时停在最后一步（完整的图）；从不自动播放；减少动态效果时只显示完整图。 */
(function(){
  document.querySelectorAll('figure.stepper').forEach(function(fig){
    var caps=[].slice.call(fig.querySelectorAll('ol.caps li')).map(function(li){return li.textContent;});
    var n=caps.length, cur=n, timer=null;
    var parts=[].slice.call(fig.querySelectorAll('.stage [data-s]'));
    var ctl=fig.querySelector('.ctl'), cap=fig.querySelector('.cap');
    function btn(label,fn){var b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);ctl.appendChild(b);return b;}
    var prev=btn('上一步',function(){stop();go(cur-1);});
    var play=btn('从头播放',function(){if(timer){stop();return;}go(1);play.textContent='暂停';timer=setInterval(function(){if(cur>=n){stop();return;}go(cur+1);},1800);});
    var next=btn('下一步',function(){stop();go(cur+1);});
    var pos=document.createElement('span');pos.className='pos';ctl.appendChild(pos);
    function stop(){if(timer){clearInterval(timer);timer=null;}play.textContent='从头播放';}
    function go(i){
      cur=Math.max(1,Math.min(n,i));
      parts.forEach(function(el){
        var s=+el.getAttribute('data-s'), hot=(el.getAttribute('data-hot')||'').split(' ').map(Number);
        el.classList.toggle('off',s>cur);
        el.classList.toggle('hot',cur<n&&hot.indexOf(cur)>=0);
      });
      pos.textContent='第 '+cur+' / '+n+' 步';
      cap.textContent=caps[cur-1]||'';
      prev.disabled=cur===1;next.disabled=cur===n;
    }
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){play.hidden=true;}
    go(n);
  });
})();
