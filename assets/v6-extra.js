/* eece274 v6-extra.js - course widgets for the EECE274 notes site.
   Widgets: kmap, fsm-player, timing-diagram, ff-timing, gate-playground,
            twos-complement, twos-adder, ieee754
   Style: white bg, ink #1a1a1a, red #9e2b25 accent only. Registered via V6.register. */
(function(){
"use strict";
if(!window.V6){console.warn("v6-extra: V6 runtime missing");return;}
var V6=window.V6,INK=V6.INK||"#1a1a1a",RED=V6.RED||"#9e2b25",GRID=V6.GRID||"#e8e6e0",MUTE="#8a8a8a";
var mine={};
function reg(name,fn){mine[name]=fn;V6.register(name,fn);}
/* v6.js mounts widgets as soon as it runs (before this deferred file registers), so mount ours here too. */
function mountMine(){
  var els=document.querySelectorAll(".v6-widget[data-widget]");
  for(var i=0;i<els.length;i++){var el=els[i],fn=mine[el.getAttribute("data-widget")];
    if(!fn||el.getAttribute("data-v6x")||el.children.length)continue;
    el.setAttribute("data-v6x","1");
    var cfg;try{cfg=JSON.parse(el.getAttribute("data-config")||"{}");}catch(e){el.insertAdjacentHTML("beforeend","<div style='color:#9e2b25;font-size:12px'>widget config error</div>");continue;}
    try{fn(el,cfg);}catch(e){if(window.__v6xErr)window.__v6xErr(e);el.insertAdjacentHTML("beforeend","<div style='color:#9e2b25;font-size:12px'>widget error</div>");}
  }
}
var SVGNS="http://www.w3.org/2000/svg";
var FONT="'Noto Sans KR',sans-serif";
/* ---------- tiny DOM helpers ---------- */
function H(tag,attrs,kids){var e=document.createElement(tag);
  if(attrs)for(var k in attrs){if(k==="text")e.textContent=attrs[k];else if(k==="html")e.innerHTML=attrs[k];
    else if(k.indexOf("on")===0)e[k]=attrs[k];else e.setAttribute(k,attrs[k]);}
  (kids||[]).forEach(function(c){if(c)e.appendChild(c);});return e;}
function S(tag,attrs,kids){var e=document.createElementNS(SVGNS,tag);
  if(attrs)for(var k in attrs){if(k==="text")e.textContent=attrs[k];else e.setAttribute(k,attrs[k]);}
  (kids||[]).forEach(function(c){if(c)e.appendChild(c);});return e;}
function svgRoot(w,h){var s=S("svg",{viewBox:"0 0 "+w+" "+h,width:"100%"});s.style.display="block";s.style.maxWidth=w+"px";
  s.style.fontFamily=FONT;s.style.background="#fff";return s;}
function btn(label,fn,cls){var b=H("button",{"class":"v6-btn"+(cls?" "+cls:""),type:"button",text:label});b.onclick=fn;return b;}
function row(){var d=H("div",{"class":"v6-controls"});return d;}
function noteBox(){var d=H("div",{"class":"v6-state"});d.style.whiteSpace="normal";d.style.lineHeight="1.6";return d;}
function sub(s){return s;}
function sel(opts,val,fn){var s=H("select");s.style.cssText="border:1.2px solid "+INK+";border-radius:3px;background:#fff;font-family:inherit;font-size:12.5px;padding:2px 4px";
  opts.forEach(function(o){var op=H("option",{value:o[0],text:o[1]});if(String(o[0])===String(val))op.selected=true;s.appendChild(op);});
  s.onchange=function(){fn(s.value);};return s;}
function txt(val,w,fn,ph){var i=H("input",{type:"text"});i.value=val;i.style.cssText="border:1.2px solid "+INK+";border-radius:3px;padding:2px 6px;font-family:'Consolas','Noto Sans KR',monospace;font-size:13px;width:"+w+"px";
  if(ph)i.placeholder=ph;i.oninput=function(){fn(i.value);};return i;}
function bin(n,w){var s=(n>>>0).toString(2);while(s.length<w)s="0"+s;return s.slice(-w);}
function popcnt(x){var c=0;while(x){c+=x&1;x>>=1;}return c;}
var PR="\u2032"; /* prime sign used in the notes */

/* ================= Boolean core: QM + parser ================= */
/* implicant: {v:value bits, m:dash mask}. covers minterm i iff (i & ~m)==v */
function covers(imp,i){return ((i&~imp.m)===imp.v);}
function primeImplicants(n,ones,dcs){
  var all=ones.concat(dcs),seen={},cur=[];
  all.forEach(function(i){if(!seen[i]){seen[i]=1;cur.push({v:i,m:0});}});
  var pis=[];
  while(cur.length){
    var used={},next={},nextArr=[];
    for(var a=0;a<cur.length;a++)for(var b=a+1;b<cur.length;b++){
      var A=cur[a],B=cur[b];
      if(A.m!==B.m)continue;
      var d=A.v^B.v;
      if(d&&(d&(d-1))===0){
        used[a]=1;used[b]=1;
        var nm=A.m|d,nv=A.v&~d,key=nv+"/"+nm;
        if(!next[key]){next[key]=1;nextArr.push({v:nv,m:nm});}
      }
    }
    for(var k=0;k<cur.length;k++)if(!used[k])pis.push(cur[k]);
    cur=nextArr;
  }
  return pis;
}
function litCount(n,imp){return n-popcnt(imp.m);}
/* returns {pis, epis(indexes), cover(indexes order: essentials first), altCount, ones} */
function minimize(n,ones,dcs){
  var res={n:n,ones:ones.slice(),pis:[],epi:[],cover:[],alt:1};
  if(!ones.length){return res;}
  var pis=primeImplicants(n,ones,dcs);res.pis=pis;
  var cov=ones.map(function(o){var r=[];pis.forEach(function(p,i){if(covers(p,o))r.push(i);});return r;});
  var ess={};cov.forEach(function(r){if(r.length===1)ess[r[0]]=1;});
  var epi=Object.keys(ess).map(Number).sort(function(a,b){return a-b;});res.epi=epi;
  var remaining=[];ones.forEach(function(o,k){var done=false;epi.forEach(function(e){if(covers(pis[e],o))done=true;});if(!done)remaining.push(k);});
  var cand=[];pis.forEach(function(p,i){if(!ess[i]){var useful=remaining.some(function(k){return covers(p,ones[k]);});if(useful)cand.push(i);}});
  var best=null,bestCost=null,count=0;
  if(!remaining.length){best=[];bestCost=[0,0];count=1;}
  else if(cand.length<=18){
    var L=cand.length;
    for(var mask=1;mask<(1<<L);mask++){
      var ok=true;
      for(var r=0;r<remaining.length&&ok;r++){var hit=false;
        for(var j=0;j<L;j++)if((mask>>j)&1&&covers(pis[cand[j]],ones[remaining[r]])){hit=true;break;}
        if(!hit)ok=false;}
      if(!ok)continue;
      var terms=0,lits=0,sel=[];
      for(var j2=0;j2<L;j2++)if((mask>>j2)&1){terms++;lits+=litCount(n,pis[cand[j2]]);sel.push(cand[j2]);}
      var cost=[terms,lits];
      if(!bestCost||cost[0]<bestCost[0]||(cost[0]===bestCost[0]&&cost[1]<bestCost[1])){best=sel;bestCost=cost;count=1;}
      else if(cost[0]===bestCost[0]&&cost[1]===bestCost[1])count++;
    }
  }else{ /* greedy fallback */
    var left=remaining.slice();best=[];
    while(left.length){var bi=-1,bc=-1;cand.forEach(function(c){var k=0;left.forEach(function(r){if(covers(pis[c],ones[r]))k++;});if(k>bc){bc=k;bi=c;}});
      best.push(bi);left=left.filter(function(r){return !covers(pis[bi],ones[r]);});}
    count=1;
  }
  res.cover=epi.concat(best);res.alt=count;return res;
}
function varNames(n,given){var d=["A","B","C","D","E","F"];var r=[];for(var i=0;i<n;i++)r.push((given&&given[i])||d[i]);return r;}
/* implicant -> product term string (SOP) */
function termSOP(imp,n,names){var s="";for(var i=0;i<n;i++){var bit=1<<(n-1-i);if(imp.m&bit)continue;s+=names[i]+((imp.v&bit)?"":PR);}return s||"1";}
/* implicant of F' -> sum term of F */
function termPOS(imp,n,names){var parts=[];for(var i=0;i<n;i++){var bit=1<<(n-1-i);if(imp.m&bit)continue;parts.push(names[i]+((imp.v&bit)?PR:""));}
  if(!parts.length)return "0";return parts.length===1?parts[0]:"("+parts.join(" + ")+")";}
function exprFromCover(res,n,names,pos,idxs){
  var list=(idxs||res.cover).map(function(i){return res.pis[i];});
  if(!res.ones.length)return pos?"1":"0";
  if(!list.length)return "";
  if(pos)return list.map(function(p){return termPOS(p,n,names);}).join("");
  return list.map(function(p){return termSOP(p,n,names);}).join(" + ");
}
/* ---- expression parser: ! ~ ' prime(\u2032) NOT; * & . implicit AND; ^ XOR; + | OR ---- */
function parseExpr(src){
  var s=src.replace(/\u00b7|\u2227|\u22c5/g,"*").replace(/\u2228/g,"+").replace(/\u2295/g,"^").replace(/\u2032|\u2019/g,"'").replace(/\s+/g,"");
  var p=0;
  function peek(){return s.charAt(p);}
  function fail(m){throw new Error(m);}
  function parseOr(){var a=parseXor();var kids=[a];while(peek()==="+"||peek()==="|"){p++;kids.push(parseXor());}
    return kids.length===1?a:{t:"or",k:kids};}
  function parseXor(){var a=parseAnd();var kids=[a];while(peek()==="^"){p++;kids.push(parseAnd());}
    return kids.length===1?a:{t:"xor",k:kids};}
  function startsAtom(c){return c&&(/[A-Za-z01(!~]/.test(c));}
  function parseAnd(){var a=parseUn();var kids=[a];
    while(true){var c=peek();if(c==="*"||c==="&"){p++;kids.push(parseUn());}else if(startsAtom(c)){kids.push(parseUn());}else break;}
    return kids.length===1?a:{t:"and",k:kids};}
  function parseUn(){var c=peek();
    if(c==="!"||c==="~"){p++;return mkNot(parseUn());}
    var a=parseAtom();while(peek()==="'"){p++;a=mkNot(a);}return a;}
  function mkNot(a){return {t:"not",k:[a]};}
  function parseAtom(){var c=peek();
    if(c==="("){p++;var e=parseOr();if(peek()!==")")fail("\uad04\ud638\uac00 \ub2eb\ud788\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4");p++;return e;}
    if(/[A-Za-z]/.test(c)){p++;return {t:"var",n:c.toUpperCase()};}
    if(c==="0"||c==="1"){p++;return {t:"const",v:+c};}
    fail(c?("\uc774\ud574\ud560 \uc218 \uc5c6\ub294 \ubb38\uc790 '"+c+"'"):"\uc2dd\uc774 \ub05d\ub0ac\uc2b5\ub2c8\ub2e4");}
  if(!s)fail("\uc2dd\uc774 \ube44\uc5b4 \uc788\uc2b5\ub2c8\ub2e4");
  var t=parseOr();if(p<s.length)fail("\uc774\ud574\ud560 \uc218 \uc5c6\ub294 \ubb38\uc790 '"+s.charAt(p)+"'");return t;
}
function astVars(t,acc){acc=acc||{};if(t.t==="var")acc[t.n]=1;else if(t.k)t.k.forEach(function(k){astVars(k,acc);});return Object.keys(acc).sort();}
function astEval(t,env){switch(t.t){
  case "var":return env[t.n]?1:0;case "const":return t.v;
  case "not":return astEval(t.k[0],env)?0:1;
  case "and":return t.k.every(function(k){return astEval(k,env);})?1:0;
  case "or":return t.k.some(function(k){return astEval(k,env);})?1:0;
  case "xor":return t.k.reduce(function(a,k){return a^astEval(k,env);},0);}}
/* truth table over sorted var list; index bit order: first var = MSB */
function truthTable(ast,vars){var n=vars.length,out=[];
  for(var i=0;i<(1<<n);i++){var env={};vars.forEach(function(v,j){env[v]=(i>>(n-1-j))&1;});out.push(astEval(ast,env));}return out;}

/* ================= K-map ================= */
/* cfg: {title, vars:2|3|4, minterms:[], dontcares:[], names:["A","B","C","D"], mode:"sop"|"pos",
         editable:true, vars_select:true, presets:[{label,vars,m:[],d:[]}], note} */
var GRAY1=[0,1],GRAY2=[0,1,3,2];
reg("kmap",function(el,cfg){
  V6.title(el,cfg.title||"K-map \ucd5c\uc18c\ud654");
  var n=Math.min(4,Math.max(2,cfg.vars||3));
  var names=cfg.names||null;
  var mode=cfg.mode==="pos"?"pos":"sop";
  var vals=[];function reset(nn){vals=[];for(var i=0;i<(1<<nn);i++)vals.push(0);}
  function load(nn,m,d){n=nn;reset(n);(m||[]).forEach(function(i){if(i<vals.length)vals[i]=1;});(d||[]).forEach(function(i){if(i<vals.length)vals[i]=2;});}
  load(n,cfg.minterms,cfg.dontcares);
  var editable=cfg.editable!==false,showIdx=true,showAll=false,shown=null,hi=-1;
  var host=H("div");el.appendChild(host);
  var ctl=row(),svgBox=H("div"),info=noteBox();
  host.appendChild(ctl);host.appendChild(svgBox);host.appendChild(info);
  var CW=62,CH=56;
  function geom(){var rb=n===4?2:1,cb=n-rb;return {rb:rb,cb:cb,nr:1<<rb,nc:1<<cb,rg:rb===2?GRAY2:GRAY1,cg:cb===2?GRAY2:GRAY1};}
  function cellMin(g,r,c){return (g.rg[r]<<g.cb)|g.cg[c];}
  function arcOf(N,idx){if(idx.length===N)return {s:0,l:N};
    for(var a=0;a<idx.length;a++){var s=idx[a],ok=true;for(var k=0;k<idx.length;k++)if(idx.indexOf((s+k)%N)<0){ok=false;break;}
      if(ok)return {s:s,l:idx.length};}return {s:idx[0],l:idx.length};}
  function segs(N,a){if(a.s+a.l<=N)return [{s:a.s,l:a.l,o1:false,o2:false}];
    return [{s:a.s,l:N-a.s,o1:false,o2:true},{s:0,l:a.s+a.l-N,o1:true,o2:false}];}
  function bits(imp,g){var cm=(1<<g.cb)-1;return {rv:imp.v>>g.cb,rm:imp.m>>g.cb,cv:imp.v&cm,cm:imp.m&cm};}
  function drawLoop(svg,imp,g,x0,y0,inset,color,w,dash){
    var b=bits(imp,g),ri=[],ci=[];
    for(var r=0;r<g.nr;r++)if((g.rg[r]&~b.rm)===b.rv)ri.push(r);
    for(var c=0;c<g.nc;c++)if((g.cg[c]&~b.cm)===b.cv)ci.push(c);
    var rs=segs(g.nr,arcOf(g.nr,ri)),cs=segs(g.nc,arcOf(g.nc,ci));
    rs.forEach(function(R){cs.forEach(function(C){
      var xa=x0+C.s*CW+inset,xb=x0+(C.s+C.l)*CW-inset,ya=y0+R.s*CH+inset,yb=y0+(R.s+R.l)*CH-inset;
      var openT=R.o1,openB=R.o2,openL=C.o1,openR=C.o2;
      if(!openT&&!openB&&!openL&&!openR){
        svg.appendChild(S("rect",{x:xa,y:ya,width:xb-xa,height:yb-ya,rx:13,fill:"none",stroke:color,"stroke-width":w,"stroke-dasharray":dash||""}));
      }else{
        var ext=inset+2; /* open sides run to the map edge */
        var xl=openL?xa-ext:xa,xr=openR?xb+ext:xb,yt=openT?ya-ext:ya,yb2=openB?yb+ext:yb;
        function ln(x1,y1,x2,y2){svg.appendChild(S("line",{x1:x1,y1:y1,x2:x2,y2:y2,stroke:color,"stroke-width":w,"stroke-linecap":"round","stroke-dasharray":dash||""}));}
        if(!openT)ln(xl,ya,xr,ya);if(!openB)ln(xl,yb,xr,yb);if(!openL)ln(xa,yt,xa,yb2);if(!openR)ln(xb,yt,xb,yb2);
      }
    });});
  }
  function solve(){
    var tgt=mode==="sop"?1:0,ones=[],dcs=[];
    vals.forEach(function(v,i){if(v===2)dcs.push(i);else if(v===tgt)ones.push(i);});
    return minimize(n,ones,dcs);
  }
  var cur=null;
  function paint(){
    var g=cur.g,nm=cur.nm,res=cur.res,order=cur.order;
    var W=96+g.nc*CW+30,Hh=70+g.nr*CH+22,x0=96,y0=62;
    var svg=svgRoot(W,Hh);
    var rowNames=nm.slice(0,g.rb).join(""),colNames=nm.slice(g.rb).join("");
    svg.appendChild(S("line",{x1:x0-70,y1:y0-46,x2:x0,y2:y0,stroke:INK,"stroke-width":1.2}));
    svg.appendChild(S("text",{x:x0-8,y:y0-34,"text-anchor":"end","font-size":13,"font-weight":700,fill:INK,text:colNames}));
    svg.appendChild(S("text",{x:x0-66,y:y0-6,"text-anchor":"start","font-size":13,"font-weight":700,fill:INK,text:rowNames}));
    for(var c=0;c<g.nc;c++)svg.appendChild(S("text",{x:x0+c*CW+CW/2,y:y0-10,"text-anchor":"middle","font-size":13,"font-family":"Consolas,monospace",fill:INK,text:bin(g.cg[c],g.cb)}));
    for(var r=0;r<g.nr;r++)svg.appendChild(S("text",{x:x0-10,y:y0+r*CH+CH/2+5,"text-anchor":"end","font-size":13,"font-family":"Consolas,monospace",fill:INK,text:bin(g.rg[r],g.rb)}));
    for(var r2=0;r2<g.nr;r2++)for(var c2=0;c2<g.nc;c2++){
      var mt=cellMin(g,r2,c2),v=vals[mt];
      var cell=S("g",{});
      var rc=S("rect",{x:x0+c2*CW,y:y0+r2*CH,width:CW,height:CH,fill:"#fff",stroke:INK,"stroke-width":1.2});
      cell.appendChild(rc);
      cell.appendChild(S("text",{x:x0+c2*CW+CW/2,y:y0+r2*CH+CH/2+8,"text-anchor":"middle","font-size":24,"font-weight":700,
        fill:v===2?RED:((v===(mode==="sop"?1:0))?INK:"#bbb"),text:v===2?"X":String(v)}));
      if(showIdx)cell.appendChild(S("text",{x:x0+c2*CW+4,y:y0+r2*CH+12,"font-size":10,fill:MUTE,"font-family":"Consolas,monospace",text:"m"+mt}));
      if(editable){cell.style.cursor="pointer";(function(mt){cell.onclick=function(){vals[mt]=(vals[mt]+1)%3;shown=null;render();};})(mt);}
      svg.appendChild(cell);
    }
    /* loops */
    if(showAll){res.pis.forEach(function(p,i){if(order.indexOf(i)<0)drawLoop(svg,p,g,x0,y0,6,MUTE,1.3,"4 3");});}
    order.forEach(function(pi,k){
      if(k>=shown)return;
      var epi=res.epi.indexOf(pi)>=0;
      drawLoop(svg,res.pis[pi],g,x0,y0,5+(k%3)*3,epi?RED:INK,(pi===hi||k===shown-1)?3:2,epi?"":"");
    });
    if(hi>=0&&hi<res.pis.length&&order.indexOf(hi)<0)drawLoop(svg,res.pis[hi],g,x0,y0,8,RED,2,"5 3");
    svgBox.innerHTML="";svgBox.appendChild(svg);
  }
  function render(){
    var g=geom(),nm=varNames(n,names),res=solve();
    var order=res.cover.slice();
    if(shown===null||shown>order.length)shown=order.length;
    cur={g:g,nm:nm,res:res,order:order};paint();
    /* controls */
    ctl.innerHTML="";
    if(cfg.vars_select!==false)ctl.appendChild(H("label",{text:"\ubcc0\uc218 "},[sel([[2,"2"],[3,"3"],[4,"4"]],n,function(x){var old=vals.slice();n=+x;reset(n);for(var i=0;i<Math.min(old.length,vals.length);i++)vals[i]=old[i];shown=null;render();})]));
    var bs=btn("SOP (1 \ubb36\uae30)",function(){mode="sop";shown=null;render();});
    var bp=btn("POS (0 \ubb36\uae30)",function(){mode="pos";shown=null;render();});
    (mode==="sop"?bs:bp).style.cssText+="background:"+INK+";color:#fff";
    ctl.appendChild(bs);ctl.appendChild(bp);
    ctl.appendChild(btn("\ucd08\uae30\ud654",function(){reset(n);shown=null;render();}));
    ctl.appendChild(H("label",{},[H("input",{type:"checkbox",onchange:function(){showIdx=this.checked;render();}}),H("span",{text:" m \ubc88\ud638"})]));
    ctl.lastChild.firstChild.checked=showIdx;
    var cb2=H("input",{type:"checkbox",onchange:function(){showAll=this.checked;render();}});cb2.checked=showAll;
    ctl.appendChild(H("label",{},[cb2,H("span",{text:" \ubaa8\ub4e0 PI \ubcf4\uae30(\uc810\uc120)"})]));
    if(cfg.presets&&cfg.presets.length){var po=[["","\uc608\uc81c \ubd88\ub7ec\uc624\uae30"]];cfg.presets.forEach(function(p,i){po.push([i,p.label]);});
      ctl.appendChild(sel(po,"",function(x){if(x==="")return;var p=cfg.presets[+x];load(p.vars||n,p.m,p.d);shown=null;render();}));}
    /* step bar */
    var stepRow=row();
    stepRow.appendChild(btn("\u2190 \ubb36\uc74c \ud558\ub098 \ube7c\uae30",function(){if(shown>0){shown--;render();}}));
    stepRow.appendChild(btn("\ubb36\uc74c \ud558\ub098 \ucd94\uac00 \u2192",function(){if(shown<order.length){shown++;render();}}));
    stepRow.appendChild(btn("\uc804\ubd80",function(){shown=order.length;render();}));
    stepRow.appendChild(H("span",{text:"\ubb36\uc74c "+shown+" / "+order.length+" (EPI \uba3c\uc800, \ube68\uac04 \uc2e4\uc120)"}));
    /* info */
    var ones=[],dcs=[],tgt=mode==="sop"?1:0;vals.forEach(function(v,i){if(v===1)ones.push(i);if(v===2)dcs.push(i);});
    var zeros=[];vals.forEach(function(v,i){if(v===0)zeros.push(i);});
    var h="<b>F</b> = \u03a3m("+(ones.join(",")||"\uc5c6\uc74c")+")"+(dcs.length?" + d("+dcs.join(",")+")":"")+"<br>";
    var expr;
    var target=mode==="sop"?ones:zeros;
    if(!target.length)expr=mode==="sop"?"0":"1";
    else if(shown<order.length){
      var part=order.slice(0,shown);
      expr=part.length?exprFromCover(res,n,nm,mode==="pos",part):"";
      expr=expr?(mode==="sop"?expr+" + \u22ef":expr+" \u22ef"):"\u22ef";}
    else expr=exprFromCover(res,n,nm,mode==="pos");
    h+="<b>"+(mode==="sop"?"\ucd5c\uc18c SOP":"\ucd5c\uc18c POS")+"</b>: F = <span style='color:"+RED+";font-weight:700;font-size:15px'>"+expr+"</span>";
    if(res.ones.length&&res.alt>1)h+="<br><span style='color:#555'>\ucd5c\uc18c\ud574\uac00 "+res.alt+"\uac1c \uc788\uc74c (\uac19\uc740 \ud56d \uc218\u00b7\ub9ac\ud130\ub7f4 \uc218). \uc5ec\uae30\uc11c\ub294 \uadf8 \uc911 \ud558\ub098\ub97c \ubcf4\uc5ec\uc90c.</span>";
    h+="<br><span style='color:#555'>"+(mode==="sop"?"1\uacfc X \ub97c \ubb36\uc5b4 \uacf1\ud56d\uc744 \ub9cc\ub4e0\ub2e4.":"0\uacfc X \ub97c \ubb36\uc5b4 F\u2032 \uc758 \uacf1\ud56d\uc744 \uad6c\ud55c \ub4a4 De Morgan \uc73c\ub85c \ud569\ud56d(\ud569\uc758 \uacf1)\uc744 \ub9cc\ub4e0\ub2e4.")+" X \ub294 \ubb36\uc5d0 \ub3c4\uc6c0\uc774 \ub420 \ub54c\ub9cc \uc4f4\ub2e4.</span>";
    /* PI table */
    if(res.pis.length){
      h+="<table style='margin-top:8px'><tr><th>PI</th><th>\ud56d</th><th>\ub36e\ub294 "+(mode==="sop"?"minterm":"maxterm")+"</th><th>\uc5ed\ud560</th></tr>";
      res.pis.forEach(function(p,i){
        var cv=res.ones.filter(function(o){return covers(p,o);});
        var role="";var ei=res.epi.indexOf(i);
        if(ei>=0){var only=res.ones.filter(function(o){var c=0;res.pis.forEach(function(q){if(covers(q,o))c++;});return covers(p,o)&&c===1;});
          role="<b style='color:"+RED+"'>EPI</b> ("+(mode==="sop"?"m":"M")+only.join(",")+" \ub97c \uc774 PI \ub9cc \ub36e\uc74c)";}
        else role=order.indexOf(i)>=0?"\uc120\ud0dd\ub41c PI":"\uc120\ud0dd \uc548 \ub428 (\uc911\ubcf5)";
        var term=mode==="sop"?termSOP(p,n,nm):termPOS(p,n,nm);
        h+="<tr data-pi='"+i+"' style='cursor:default'><td>"+(i+1)+"</td><td>"+term+"</td><td>"+cv.join(", ")+"</td><td>"+role+"</td></tr>";
      });
      h+="</table>";
    }
    info.innerHTML="";info.appendChild(stepRow);
    var d=H("div",{html:h});info.appendChild(d);
    d.querySelectorAll("tr[data-pi]").forEach(function(tr){var i=+tr.getAttribute("data-pi");
      tr.onmouseenter=function(){hi=i;paint();};tr.onmouseleave=function(){hi=-1;paint();};});
    if(cfg.note){info.appendChild(H("div",{html:cfg.note,style:"margin-top:6px;color:#555"}));}
  }
  render();
});

/* ================= FSM player ================= */
/* cfg: {title,type:"moore"|"mealy",w,h,init:"S0",
   states:[{id,x,y,out?}], edges:[{from,to,in:"0,1"|"*",out?,loop:"up|down|left|right",bend:number}],
   input:"1011011", note} */
reg("fsm-player",function(el,cfg){
  V6.title(el,cfg.title||"FSM \uc0c1\ud0dc \uc804\uc774 \uc7ac\uc0dd");
  var W=cfg.w||720,Hh=cfg.h||300,R=26,moore=cfg.type!=="mealy";
  var st={};cfg.states.forEach(function(s){st[s.id]=s;});
  var edges=cfg.edges.map(function(e){return {from:e.from,to:e.to,ins:String(e.in).split(",").map(function(x){return x.trim();}),inLabel:String(e.in),out:e.out,loop:e.loop||"up",bend:e.bend};});
  function find(state,sym){for(var i=0;i<edges.length;i++){var e=edges[i];if(e.from!==state)continue;
    if(e.ins.indexOf(sym)>=0||e.ins.indexOf("*")>=0)return i;}return -1;}
  var input=cfg.input||"",trace,pos=0,timer=null;
  function simulate(){
    trace=[{state:cfg.init||cfg.states[0].id,edge:-1,sym:"",out:moore?st[cfg.init||cfg.states[0].id].out:""}];
    for(var i=0;i<input.length;i++){
      var cur=trace[trace.length-1].state,sym=input.charAt(i),ei=find(cur,sym);
      if(ei<0){trace.push({state:cur,edge:-1,sym:sym,out:"",halt:true});break;}
      var e=edges[ei],ns=e.to;
      trace.push({state:ns,edge:ei,sym:sym,out:moore?(st[ns].out):(e.out)});
    }
    if(pos>trace.length-1)pos=trace.length-1;
  }
  var svgBox=H("div"),ctl=row(),info=noteBox();
  el.appendChild(svgBox);
  var inRow=row();
  var inBox=txt(input,170,function(v){input=v.replace(/[^01A-Za-z]/g,"");pos=0;simulate();draw();},"\uc785\ub825 \uc5f4");
  inRow.appendChild(H("label",{text:"\uc785\ub825 \uc5f4 "},[inBox]));
  inRow.appendChild(H("span",{text:(moore?"Moore: \ucd9c\ub825\uc740 \uc0c1\ud0dc\uc5d0 \ubd99\uc74c  S/\ucd9c\ub825":"Mealy: \ucd9c\ub825\uc740 \uc804\uc774\uc5d0 \ubd99\uc74c  \uc785\ub825/\ucd9c\ub825"),style:"color:#555"}));
  el.appendChild(inRow);el.appendChild(ctl);el.appendChild(info);
  function geom(e){
    var a=st[e.from],b=st[e.to];
    if(e.from===e.to){var dir={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[e.loop]||[0,-1];
      var nx=-dir[1],ny=dir[0];var cx=a.x+dir[0]*R,cy=a.y+dir[1]*R;
      var p1={x:cx+nx*14,y:cy+ny*14},p2={x:cx-nx*14,y:cy-ny*14};
      var c1={x:cx+dir[0]*34+nx*26,y:cy+dir[1]*34+ny*26},c2={x:cx+dir[0]*34-nx*26,y:cy+dir[1]*34-ny*26};
      return {d:"M"+p1.x+" "+p1.y+" C"+c1.x+" "+c1.y+" "+c2.x+" "+c2.y+" "+p2.x+" "+p2.y,lx:cx+dir[0]*40,ly:cy+dir[1]*40+(dir[1]?0:4),anchor:dir[0]<0?"end":(dir[0]>0?"start":"middle"),end:p2,from:c2};}
    var dx=b.x-a.x,dy=b.y-a.y,len=Math.sqrt(dx*dx+dy*dy)||1,ux=dx/len,uy=dy/len;
    var rev=edges.some(function(o){return o.from===e.to&&o.to===e.from;});
    var bend=e.bend!==undefined?e.bend:(rev?30:0);
    var mx=(a.x+b.x)/2-uy*bend,my=(a.y+b.y)/2+ux*bend;
    var q={x:mx,y:my};
    function trim(p,from){var vx=q.x-p.x,vy=q.y-p.y,l=Math.sqrt(vx*vx+vy*vy)||1;
      if(bend===0){vx=(from?1:-1)*dx;vy=(from?1:-1)*dy;l=len;}
      return {x:p.x+vx/l*R,y:p.y+vy/l*R};}
    var p1=trim(a,true),p2t=trim(b,false);
    /* quadratic control chosen so curve passes near q */
    var cxp=bend===0?q.x:2*q.x-(p1.x+p2t.x)/2,cyp=bend===0?q.y:2*q.y-(p1.y+p2t.y)/2;
    var lx=(p1.x+2*cxp+p2t.x)/4,ly=(p1.y+2*cyp+p2t.y)/4;
    var nxl=-uy*(bend>=0?-1:1),nyl=ux*(bend>=0?-1:1);
    /* label pushed to the outer side of the curve (or above straight edge) */
    var ox=bend===0?uy*12:(mx-(a.x+b.x)/2)/Math.max(1,Math.abs(bend))*12,oy=bend===0?-ux*12:(my-(a.y+b.y)/2)/Math.max(1,Math.abs(bend))*12;
    if(bend===0&&oy>0){ox=-ox;oy=-oy;}
    return {d:"M"+p1.x+" "+p1.y+" Q"+cxp+" "+cyp+" "+p2t.x+" "+p2t.y,lx:lx+ox,ly:ly+oy+4,anchor:"middle",end:p2t,from:{x:cxp,y:cyp}};
  }
  function draw(){
    var cur=trace[pos],svg=svgRoot(W,Hh);
    var defs=S("defs");
    [["a",INK],["r",RED]].forEach(function(m){defs.appendChild(S("marker",{id:"fsm-arr-"+m[0]+uid,viewBox:"0 0 10 10",refX:9,refY:5,markerWidth:7,markerHeight:7,orient:"auto-start-reverse"},[S("path",{d:"M0 0 L10 5 L0 10 z",fill:m[1]})]));});
    svg.appendChild(defs);
    var active=cur.edge;
    edges.forEach(function(e,i){
      var g=geom(e),on=(i===active);
      svg.appendChild(S("path",{d:g.d,fill:"none",stroke:on?RED:INK,"stroke-width":on?3:1.4,"marker-end":"url(#fsm-arr-"+(on?"r":"a")+uid+")"}));
      var label=moore?e.inLabel:(e.inLabel+"/"+(e.out===undefined?"":e.out));
      svg.appendChild(S("text",{x:g.lx,y:g.ly,"text-anchor":g.anchor,"font-size":13,"font-weight":on?700:400,fill:on?RED:INK,"font-family":"Consolas,monospace",text:label}));
    });
    /* initial arrow */
    var init=st[cfg.init||cfg.states[0].id];
    svg.appendChild(S("line",{x1:init.x-R-34,y1:init.y,x2:init.x-R-2,y2:init.y,stroke:INK,"stroke-width":1.4,"marker-end":"url(#fsm-arr-a"+uid+")"}));
    cfg.states.forEach(function(s){
      var now=s.id===cur.state;
      svg.appendChild(S("circle",{cx:s.x,cy:s.y,r:R,fill:now?"#f6e9e8":"#fff",stroke:now?RED:INK,"stroke-width":now?3:1.5}));
      if(s.final)svg.appendChild(S("circle",{cx:s.x,cy:s.y,r:R-4,fill:"none",stroke:INK,"stroke-width":1.2}));
      var t=moore&&s.out!==undefined?s.id+"/"+s.out:s.id;
      svg.appendChild(S("text",{x:s.x,y:s.y+5,"text-anchor":"middle","font-size":moore&&s.out!==undefined?13:14,"font-weight":700,fill:now?RED:INK,text:t}));
    });
    svgBox.innerHTML="";svgBox.appendChild(svg);
    /* controls + trace */
    ctl.innerHTML="";
    function go(p){pos=Math.max(0,Math.min(trace.length-1,p));stop();draw();}
    ctl.appendChild(btn("\u23ee \ucc98\uc74c",function(){go(0);}));
    ctl.appendChild(btn("\u25c0 \uc774\uc804",function(){go(pos-1);}));
    ctl.appendChild(btn("\ub2e4\uc74c \u25b6",function(){go(pos+1);}));
    ctl.appendChild(btn(timer?"\u23f8 \uba48\ucda4":"\u25b6\u25b6 \uc790\ub3d9 \uc7ac\uc0dd",function(){if(timer){stop();draw();return;}
      if(pos>=trace.length-1)pos=0;
      timer=setInterval(function(){if(pos<trace.length-1){pos++;draw();}else{stop();draw();}},cfg.speed||900);draw();}));
    ctl.appendChild(H("span",{text:"t = "+pos+" / "+(trace.length-1)}));
    var h="<table><tr><th>t</th><th>\uc785\ub825</th><th>\ud604\uc7ac \uc0c1\ud0dc</th><th>\ub2e4\uc74c \uc0c1\ud0dc</th><th>\ucd9c\ub825</th></tr>";
    for(var i=1;i<trace.length;i++){var tr=trace[i],prev=trace[i-1];
      var act=(i===pos);var sty=i<=pos?"":"color:#bbb";
      if(tr.halt)h+="<tr style='"+sty+"'><td>"+(i-1)+"</td><td>"+tr.sym+"</td><td>"+prev.state+"</td><td colspan='2'>\uc804\uc774 \uc5c6\uc74c \u2192 \uba48\ucda4</td></tr>";
      else h+="<tr style='"+sty+(act?";outline:2px solid "+RED:"")+"'><td>"+(i-1)+"</td><td>"+tr.sym+"</td><td>"+prev.state+"</td><td>"+tr.state+"</td><td>"+(tr.out===undefined?"":tr.out)+"</td></tr>";}
    h+="</table>";
    var outs="";for(var k=(moore?0:1);k<=pos;k++)if(trace[k].out!==undefined&&!trace[k].halt)outs+=trace[k].out;
    h+="<div style='margin-top:6px'>\ucd9c\ub825\uc5f4: <b style='color:"+RED+";font-family:Consolas,monospace;letter-spacing:.1em'>"+(outs||"\u2014")+"</b>"+
       (moore?" <span style='color:#555'>(Moore \ub294 \ucd08\uae30 \uc0c1\ud0dc\uc758 \ucd9c\ub825\ubd80\ud130 \ub098\uc654\uc73c\ubbc0\ub85c \uc785\ub825\ubcf4\ub2e4 \ud558\ub098 \ub354 \uae38\ub2e4)</span>":"")+"</div>";
    if(cfg.note)h+="<div style='margin-top:4px;color:#555'>"+cfg.note+"</div>";
    info.innerHTML=h;
  }
  function stop(){if(timer){clearInterval(timer);timer=null;}}
  var uid=Math.floor(Math.random()*1e6);
  simulate();draw();
});

/* ================= timing-diagram: gate delay simulator ================= */
var GATE_FN={not:function(a){return a[0]?0:1;},buf:function(a){return a[0];},
  and:function(a){return a.every(Boolean)?1:0;},or:function(a){return a.some(Boolean)?1:0;},
  nand:function(a){return a.every(Boolean)?0:1;},nor:function(a){return a.some(Boolean)?0:1;},
  xor:function(a){return a.reduce(function(x,y){return x^y;},0);}};
var TD_PRESETS={
  delay:{label:"F = (A + B\u2032)\u00b7C  \uac8c\uc774\ud2b8 \uc9c0\uc5f0 (L07 \uc608)",T:130,dt:0.5,dmax:30,dstep:2.5,snap:5,grid:10,
    gates:[{out:"B\u2032",op:"not",in:["B"],d:10},{out:"X",op:"or",in:["A","B\u2032"],d:10},{out:"F",op:"and",in:["X","C"],d:10}],
    inputs:{A:{init:0,edges:[10,40]},B:{init:1,edges:[70]},C:{init:1,edges:[110]}},out:"F",
    note:"\uc785\ub825\uc774 \ubc14\ub014 \ub4a4 \uac8c\uc774\ud2b8\ub9c8\ub2e4 \uc9c0\uc5f0\uc774 \ub354\ud574\uc838 \ucd9c\ub825\uc774 \ub2a6\uac8c \ubc14\ub010\ub2e4. B \uac00 \ub0b4\ub824\uac00\uba74 B\u2032 \u2192 X \u2192 F \uc21c\uc11c\ub85c 10 ns \uc529 \ub2a6\uc5b4\uc838 100 ns \uc5d0 F \uac00 \ubc14\ub010\ub2e4 (\uac00\uc7a5 \uae34 \uacbd\ub85c 30 ns)."},
  hazard:{label:"F = AB + A\u2032C  static hazard",T:26,
    gates:[{out:"A\u2032",op:"not",in:["A"],d:2},{out:"AB",op:"and",in:["A","B"],d:1},{out:"A\u2032C",op:"and",in:["A\u2032","C"],d:1},{out:"F",op:"or",in:["AB","A\u2032C"],d:1}],
    inputs:{A:{init:1,edges:[6,16]},B:{init:1,edges:[]},C:{init:1,edges:[]}},out:"F",
    note:"B = C = 1 \uc774\uba74 \uc774\uc0c1\uc801\uc73c\ub85c F \ub294 A \uc640 \ubb34\uad00\ud558\uac8c 1 \uc774\ub2e4. A \uac00 1\u21920 \uc77c \ub54c\ub294 AB \uac00 \uba3c\uc800 \uaebc\uc9c0\uace0 A\u2032C \ub294 \ub2a6\uac8c \ucf1c\uc838 F \uc5d0 0 \uc9c0\ud130(glitch)\uac00 \uc0dd\uae34\ub2e4. 0\u21921 \uc77c \ub54c\ub294 \uc21c\uc11c\uac00 \ubc18\ub300\ub77c \uc548 \uc0dd\uae34\ub2e4. \uc778\ubc84\ud130 \uc9c0\uc5f0\uc744 0 \ub610\ub294 AND \uc9c0\uc5f0\ubcf4\ub2e4 \ud06c\uac8c/\uc791\uac8c \ubc14\uafd4 \ubcf4\uc790."},
  pulse:{label:"Pulse shaper  F = A\u00b7(A \uc9c0\uc5f0 \ubc18\uc804)",T:24,
    gates:[{out:"a1",op:"not",in:["A"],d:1},{out:"a2",op:"not",in:["a1"],d:1},{out:"a3",op:"not",in:["a2"],d:1},{out:"F",op:"and",in:["A","a3"],d:1}],
    inputs:{A:{init:0,edges:[4,14]}},out:"F",
    note:"A \uac00 \uc62c\ub77c\uac00\ub294 \uc21c\uac04 a3 (= A \ub97c 3\uac1c \uc778\ubc84\ud130\ub85c \uc9c0\uc5f0\u00b7\ubc18\uc804)\ub294 \uc544\uc9c1 1 \uc774\ub77c AND \ucd9c\ub825\uc774 \uc7a0\uae50 1 \uc774 \ub41c\ub2e4. \ud3ed\uc740 \uc778\ubc84\uc2a4 \uccb4\uc778 \uc9c0\uc5f0 \ud569\uc5d0 \ud574\ub2f9\ud55c\ub2e4."}
};
reg("timing-diagram",function(el,cfg){
  V6.title(el,cfg.title||"\ud0c0\uc774\ubc0d \ub2e4\uc774\uc5b4\uadf8\ub7a8 (\uac8c\uc774\ud2b8 \uc9c0\uc5f0)");
  var names=cfg.circuits||Object.keys(TD_PRESETS);
  var key=cfg.circuit&&TD_PRESETS[cfg.circuit]?cfg.circuit:(cfg.netlist?"custom":names[0]);
  var circ,inputs,delays,inertial=cfg.inertial===true;
  var DT=0.25,UNITPH=1;
  function load(k){
    var p=k==="custom"?{label:cfg.title||"custom",T:cfg.T||24,gates:cfg.netlist,inputs:cfg.inputs,out:cfg.out,note:cfg.note}:TD_PRESETS[k];
    circ=p;DT=p.dt||0.25;inputs={};Object.keys(p.inputs).forEach(function(n){inputs[n]={init:p.inputs[n].init,edges:p.inputs[n].edges.slice()};});
    delays=p.gates.map(function(g){return g.d;});key=k;
  }
  load(key);
  var host=H("div");el.appendChild(host);
  var ctl=row(),box=H("div"),dly=row(),info=noteBox();
  host.appendChild(ctl);host.appendChild(box);host.appendChild(dly);host.appendChild(info);
  function inWave(inp,N){var a=[],v=inp.init,e=inp.edges.slice().sort(function(x,y){return x-y;}),j=0;
    for(var k=0;k<=N;k++){var t=k*DT;while(j<e.length&&e[j]<=t+1e-9){v^=1;j++;}a.push(v);}return a;}
  function runSim(zero){
    var N=Math.round(circ.T/DT),w={};
    Object.keys(inputs).forEach(function(n){w[n]=inWave(inputs[n],N);});
    circ.gates.forEach(function(g,gi){
      var dk=zero?0:Math.round(delays[gi]/DT),out=[],ins=g.in.map(function(n){return w[n];});
      for(var k=0;k<=N;k++){var kk=Math.max(0,k-dk);out.push(GATE_FN[g.op](ins.map(function(a){return a[kk];})));}
      if(inertial&&dk>0){var changed=true;
        while(changed){changed=false;var runs=[],s=0;
          for(var k2=1;k2<=N+1;k2++){if(k2===N+1||out[k2]!==out[s]){runs.push([s,k2-1]);s=k2;}}
          for(var r=1;r<runs.length-1;r++){var len=runs[r][1]-runs[r][0]+1;
            if(len<dk){for(var q=runs[r][0];q<=runs[r][1];q++)out[q]=out[runs[r][0]-1];changed=true;break;}}}}
      w[g.out]=out;});
    return w;
  }
  function trans(a){var t=[];for(var k=1;k<a.length;k++)if(a[k]!==a[k-1])t.push(k*DT);return t;}
  function draw(){
    var w=runSim(false),wi=runSim(true),N=Math.round(circ.T/DT);
    var sigs=Object.keys(inputs).concat(circ.gates.map(function(g){return g.out;}));
    var outName=circ.out,total=0;
    var rowsN=sigs.length+1,RH=36,L=70,Wd=720,R=14,top=26,Hh=top+rowsN*RH+18;
    var sx=(Wd-L-R)/circ.T,svg=svgRoot(Wd,Hh);
    var gridStep=circ.grid||(circ.T>30?5:2);
    for(var t=0;t<=circ.T+1e-9;t+=gridStep){svg.appendChild(S("line",{x1:L+t*sx,y1:top-6,x2:L+t*sx,y2:Hh-14,stroke:GRID,"stroke-width":1}));
      svg.appendChild(S("text",{x:L+t*sx,y:top-10,"text-anchor":"middle","font-size":10,fill:MUTE,text:String(t)}));}
    svg.appendChild(S("text",{x:Wd-R,y:Hh-3,"text-anchor":"end","font-size":10,fill:MUTE,text:"t (ns)"}));
    var tr=trans(w[outName]),tri=trans(wi[outName]);
    var glitch=tr.length>tri.length;
    var maxD=delays.reduce(function(a,b){return a+b;},0);
    function wave(a,y0,color,wd,dash){
      var hi=y0+6,lo=y0+RH-14,p="",prev=null;
      for(var k=0;k<=N;k++){var y=a[k]?hi:lo,x=L+k*DT*sx;
        if(prev===null)p+="M"+x+" "+y;else if(y!==prev)p+=" L"+x+" "+prev+" L"+x+" "+y;
        prev=y;}
      p+=" L"+(L+N*DT*sx)+" "+prev;
      svg.appendChild(S("path",{d:p,fill:"none",stroke:color,"stroke-width":wd,"stroke-dasharray":dash||"","stroke-linejoin":"round"}));
    }
    sigs.forEach(function(n,i){
      var y0=top+i*RH,isIn=!!inputs[n],isOut=n===outName;
      svg.appendChild(S("text",{x:L-8,y:y0+RH/2+1,"text-anchor":"end","font-size":13,"font-weight":isOut?700:400,fill:isOut?RED:INK,"font-family":"Consolas,'Noto Sans KR',monospace",text:n}));
      if(isOut&&glitch){ /* highlight short pulses */
        var a=w[n],s=0,runs=[];for(var k=1;k<=N+1;k++){if(k===N+1||a[k]!==a[s]){runs.push([s,k-1]);s=k;}}
        for(var r=1;r<runs.length-1;r++){var wd=(runs[r][1]-runs[r][0]+1)*DT;
          if(wd<=maxD)svg.appendChild(S("rect",{x:L+runs[r][0]*DT*sx,y:y0,width:wd*sx,height:RH-6,fill:RED,opacity:.14}));}}
      wave(w[n],y0,isOut?RED:INK,isOut?2.4:1.6);
      if(isIn&&inputs[n]){var hit=S("rect",{x:L,y:y0,width:circ.T*sx,height:RH-4,fill:"#fff","fill-opacity":0,style:"cursor:crosshair"});
        hit.onclick=function(ev){var rect=svg.getBoundingClientRect(),scale=Wd/rect.width;
          var t=((ev.clientX-rect.left)*scale-L)/sx;var sn=circ.snap||0.5;t=Math.round(t/sn)*sn;if(t<=0||t>=circ.T)return;
          var ed=inputs[n].edges,idx=ed.indexOf(t);if(idx>=0)ed.splice(idx,1);else ed.push(t);draw();};
        svg.appendChild(hit);}
    });
    var yi=top+sigs.length*RH;
    svg.appendChild(S("text",{x:L-8,y:yi+RH/2+1,"text-anchor":"end","font-size":11,fill:MUTE,"font-family":"Consolas,'Noto Sans KR',monospace",text:outName+"(ideal)"}));
    wave(wi[outName],yi,MUTE,1.4,"5 4");
    box.innerHTML="";box.appendChild(svg);
    /* delay sliders */
    dly.innerHTML="";
    circ.gates.forEach(function(g,gi){
      var lab=H("label",{text:g.out+" ("+g.op.toUpperCase()+") "});
      var r=H("input",{type:"range",min:0,max:circ.dmax||4,step:circ.dstep||0.25,value:delays[gi]});
      var v=H("span",{"class":"v6-val",text:delays[gi].toFixed(circ.dmax?1:2)+" ns"});
      r.oninput=function(){delays[gi]=parseFloat(r.value);draw();};
      lab.appendChild(r);lab.appendChild(v);dly.appendChild(lab);});
    var h="";
    h+=glitch?("<b style='color:"+RED+"'>glitch \ubc1c\uc0dd</b>: \uc774\uc0c1\uc801\uc73c\ub85c "+outName+" \ub294 "+tri.length+"\ubc88 \ubc14\ub00c\uc5b4\uc57c \ud558\ub294\ub370 \uc2e4\uc81c\ub85c\ub294 "+tr.length+"\ubc88 \ubc14\ub010\ub2e4 (\ube68\uac04 \uc74c\uc601).<br>"):
      ("\ucd9c\ub825 "+outName+" \uc740 \uc774\uc0c1\uc801\uc778 \ub3d9\uc791\uacfc \uac19\uc740 \ud69f\uc218("+tri.length+"\ubc88)\ub9cc \ubc14\ub010\ub2e4. \ub2e8\uc9c0 \uc9c0\uc5f0\ub418\uc5b4 \ub098\ud0c0\ub0a0 \ubfd0.<br>");
    h+="<span style='color:#555'>\uc785\ub825 \ud30c\ud615\uc744 \ud074\ub9ad\ud558\uba74 \uadf8 \uc2dc\uac01("+(circ.snap||0.5)+" ns \ub2e8\uc704)\uc5d0 \uc5e3\uc9c0\uac00 \ucd94\uac00/\uc81c\uac70\ub41c\ub2e4. \uc810\uc120 = \uc9c0\uc5f0 0 \uc77c \ub54c\uc758 \uc774\uc0c1\uc801 \ucd9c\ub825.</span>";
    if(circ.note)h+="<br><span style='color:#555'>"+circ.note+"</span>";
    info.innerHTML=h;
    ctl.innerHTML="";
    if(!cfg.netlist||cfg.circuits){var opts=names.map(function(k){return [k,TD_PRESETS[k].label];});
      if(cfg.netlist)opts.push(["custom",cfg.title||"custom"]);
      if(opts.length>1)ctl.appendChild(sel(opts,key,function(k){load(k);draw();}));}
    var cb=H("input",{type:"checkbox",onchange:function(){inertial=this.checked;draw();}});cb.checked=inertial;
    ctl.appendChild(H("label",{},[cb,H("span",{text:" inertial delay (\uc9c0\uc5f0\ubcf4\ub2e4 \uc9e7\uc740 \ud39c\uc2a4\ub294 \uac8c\uc774\ud2b8\uac00 \uc9c0\uc6c0)"})]));
    ctl.appendChild(btn("\ucd08\uae30\ud654",function(){load(key);draw();}));
  }
  draw();
});

/* ================= ff-timing: setup / hold / skew ================= */
/* cfg: {title, params:{Tcq,CLmax,CLmin,Tsu,Th,Tperiod,Tskew}} (ns) */
reg("ff-timing",function(el,cfg){
  V6.title(el,cfg.title||"Setup / Hold / Clock skew");
  var P=Object.assign({Tcq:2,CLmax:5,CLmin:1,Tsu:1,Th:1,Tperiod:8,Tskew:0},cfg.params||{});
  var spec={Tcq:[0.5,4,0.25,"T_cq"],CLmax:[0,10,0.25,"CL max"],CLmin:[0,6,0.25,"CL min"],Tsu:[0,3,0.25,"T_su"],Th:[0,3,0.25,"T_h"],Tperiod:[3,16,0.25,"T_period"],Tskew:[-3,3,0.25,"T_skew"]};
  var box=H("div"),ctl=row(),info=noteBox();el.appendChild(box);el.appendChild(ctl);el.appendChild(info);
  var uid=Math.floor(Math.random()*1e6);
  function draw(){
    if(P.CLmin>P.CLmax)P.CLmin=P.CLmax;
    var Tpmax=P.Tcq+P.CLmax,Tpmin=P.Tcq+P.CLmin,Pd=P.Tperiod,sk=P.Tskew;
    var setupSlack=Pd-P.Tsu+sk-Tpmax,holdSlack=Tpmin-sk-P.Th;
    var tmin=-2.5,tmax=Math.max(Pd+Math.max(0,sk)+3.5,Tpmax+3);
    var Wd=720,L=84,Rr=14,sx=(Wd-L-Rr)/(tmax-tmin),X=function(t){return L+(t-tmin)*sx;};
    var RH=52,top=30,Hh=top+3*RH+36,svg=svgRoot(Wd,Hh);
    var defs=S("defs",{},[S("pattern",{id:"ffh"+uid,width:6,height:6,patternUnits:"userSpaceOnUse",patternTransform:"rotate(45)"},[S("line",{x1:0,y1:0,x2:0,y2:6,stroke:INK,"stroke-width":1})])]);
    svg.appendChild(defs);
    for(var t=Math.ceil(tmin);t<=tmax;t++){svg.appendChild(S("line",{x1:X(t),y1:top-4,x2:X(t),y2:Hh-24,stroke:GRID,"stroke-width":1}));
      if(t%2===0)svg.appendChild(S("text",{x:X(t),y:top-9,"text-anchor":"middle","font-size":10,fill:MUTE,text:String(t)}));}
    svg.appendChild(S("text",{x:Wd-Rr,y:Hh-6,"text-anchor":"end","font-size":10,fill:MUTE,text:"t (ns)"}));
    function lab(y,txt2){svg.appendChild(S("text",{x:L-8,y:y+RH/2,"text-anchor":"end","font-size":12,"font-weight":700,fill:INK,"font-family":"Consolas,monospace",text:txt2}));}
    function clock(y0,off,color,lbl){
      var hi=y0+8,lo=y0+RH-14,half=Pd/2,p="",cur=null;
      /* rising at off+k*Pd, falling at +half ; draw from tmin to tmax */
      var t0=off-Math.ceil((off-tmin)/Pd)*Pd-Pd;var pts=[];
      for(var t2=t0;t2<tmax+Pd;t2+=Pd){pts.push([t2,1],[t2+half,0]);}
      var lvl=0,d="";
      pts.forEach(function(pt,i){var x=X(Math.max(tmin,Math.min(tmax,pt[0]))),y=pt[1]?hi:lo;
        if(i===0){d="M"+X(tmin)+" "+(pt[1]?lo:hi);}
        d+=" L"+x+" "+(pt[1]?lo:hi)+" L"+x+" "+y;});
      svg.appendChild(S("path",{d:d,fill:"none",stroke:color,"stroke-width":1.8,"clip-path":"url(#ffc"+uid+")"}));
      lab(y0,lbl);
    }
    svg.appendChild(S("defs",{},[S("clipPath",{id:"ffc"+uid},[S("rect",{x:L,y:0,width:Wd-L-Rr,height:Hh})])]));
    clock(top,0,INK,"CLK A");
    clock(top+RH,sk,INK,"CLK B");
    /* launch/capture markers */
    function vline(t,y1,y2,color,dash){svg.appendChild(S("line",{x1:X(t),y1:y1,x2:X(t),y2:y2,stroke:color,"stroke-width":1.3,"stroke-dasharray":dash||""}));}
    /* windows on CLK B row */
    function box2(t1,t2,y,color,label){svg.appendChild(S("rect",{x:X(t1),y:y+2,width:Math.max(1,X(t2)-X(t1)),height:RH-6,fill:"none",stroke:color,"stroke-width":1.4,"stroke-dasharray":"4 3"}));
      svg.appendChild(S("text",{x:(X(t1)+X(t2))/2,y:y+RH+8,"text-anchor":"middle","font-size":10,fill:color,text:label}));}
    var yD=top+2*RH,yB=top+RH;
    box2(Pd+sk-P.Tsu,Pd+sk,yB,RED,"T_su");
    box2(sk,sk+P.Th,yB,RED,"T_h");
    /* D1: old value hi -> unstable [Tpmin,Tpmax] -> new value lo */
    var hi=yD+8,lo=yD+RH-14;
    svg.appendChild(S("line",{x1:X(tmin),y1:hi,x2:X(Tpmin),y2:hi,stroke:INK,"stroke-width":1.8}));
    svg.appendChild(S("rect",{x:X(Tpmin),y:hi,width:Math.max(1,X(Tpmax)-X(Tpmin)),height:lo-hi,fill:"url(#ffh"+uid+")",stroke:"none",opacity:.45}));
    svg.appendChild(S("path",{d:"M"+X(Tpmin)+" "+hi+" L"+X(Tpmax)+" "+lo+" M"+X(Tpmin)+" "+lo+" L"+X(Tpmax)+" "+hi,fill:"none",stroke:INK,"stroke-width":1.2}));
    svg.appendChild(S("line",{x1:X(Tpmax),y1:lo,x2:X(tmax),y2:lo,stroke:INK,"stroke-width":1.8}));
    svg.appendChild(S("line",{x1:X(Tpmax),y1:hi,x2:X(Tpmax),y2:lo,stroke:INK,"stroke-width":1.2}));
    lab(yD,"D1");
    svg.appendChild(S("text",{x:X((Tpmin+Tpmax)/2),y:yD+RH+8,"text-anchor":"middle","font-size":10,fill:INK,text:"D1 \ubcc0\ud654 \uad6c\uac04 (T_p,min ~ T_p,max)"}));
    /* guide lines for launch edge and the capture edge */
    vline(0,top-4,yD+RH,MUTE,"2 3");vline(Pd+sk,top-4,yD+RH,MUTE,"2 3");
    svg.appendChild(S("text",{x:X(0)+3,y:Hh-6,"font-size":10,fill:MUTE,text:"launch"}));
    svg.appendChild(S("text",{x:X(Pd+sk)+3,y:Hh-6,"font-size":10,fill:MUTE,text:"capture"}));
    box.innerHTML="";box.appendChild(svg);
    ctl.innerHTML="";
    Object.keys(spec).forEach(function(k){var sp=spec[k];
      var lb=H("label",{text:sp[3]+" "});var r=H("input",{type:"range",min:sp[0],max:sp[1],step:sp[2],value:P[k]});
      var v=H("span",{"class":"v6-val",text:P[k]+" ns"});
      r.oninput=function(){P[k]=parseFloat(r.value);draw();};lb.appendChild(r);lb.appendChild(v);ctl.appendChild(lb);});
    var tminPeriod=Tpmax+P.Tsu-sk;
    function ok(x){return x>=0?"<b>OK</b>":"<b style='color:"+RED+"'>\uc704\ubc18</b>";}
    var h="T<sub>p,max</sub> = T<sub>cq</sub> + CL<sub>max</sub> = "+Tpmax.toFixed(2)+" ns, T<sub>p,min</sub> = T<sub>cq</sub> + CL<sub>min</sub> = "+Tpmin.toFixed(2)+" ns<br>"+
      "Setup: T<sub>p,max</sub> &lt; T<sub>period</sub> \u2212 T<sub>su</sub> + T<sub>skew</sub> \u2192 \uc5ec\uc720 "+setupSlack.toFixed(2)+" ns "+ok(setupSlack)+
      " &nbsp; (\ucd5c\uc18c \uc8fc\uae30 "+tminPeriod.toFixed(2)+" ns, f<sub>max</sub> \u2248 "+(tminPeriod>0?(1000/tminPeriod).toFixed(0):"\u221e")+" MHz)<br>"+
      "Hold: T<sub>p,min</sub> &gt; T<sub>skew</sub> + T<sub>h</sub> \u2192 \uc5ec\uc720 "+holdSlack.toFixed(2)+" ns "+ok(holdSlack)+
      (holdSlack<0?" <span style='color:#555'>(T<sub>period</sub> \ub97c \ud0a4\uc6cc\ub3c4 \uc548 \uace0\uccd0\uc9d0: hold \uc2dd\uc5d0\ub294 T<sub>period</sub> \uac00 \uc5c6\ub2e4)</span>":"")+
      "<br><span style='color:#555'>T<sub>skew</sub> = t(clock B) \u2212 t(clock A). \uc591\uc218\uba74 setup \uc5d0 \uc720\ub9ac, hold \uc5d0 \ubd88\ub9ac.</span>";
    info.innerHTML=h;
  }
  draw();
});

/* ================= gate-playground ================= */
/* cfg: {title, expr:"A'B + AC", presets:["A B + A' C", ...], compare:"", note} */
function buildNet(ast,nand){
  var nodes=[];
  function mk(op,ins,extra){var n={id:nodes.length,op:op,ins:ins};if(extra)for(var k in extra)n[k]=extra[k];nodes.push(n);return n.id;}
  function leaf(a,inv){var id;if(a.t==="const")id=mk("const",[],{v:a.v});else id=mk("leaf",[],{v:a.n});return inv?mk("not",[id]):id;}
  function build(a,inv){
    switch(a.t){
      case "var":case "const":return leaf(a,inv);
      case "not":return build(a.k[0],!inv);
      case "and":
        if(nand){var nd=mk("nand",a.k.map(function(c){return build(c,false);}));return inv?nd:mk("not",[nd]);}
        else{var ad=mk("and",a.k.map(function(c){return build(c,false);}));return inv?mk("not",[ad]):ad;}
      case "or":
        if(nand){var od=mk("nand",a.k.map(function(c){return build(c,true);}));return inv?mk("not",[od]):od;}
        else{var o=mk("or",a.k.map(function(c){return build(c,false);}));return inv?mk("not",[o]):o;}
      case "xor":{var cur=build(a.k[0],false);
        for(var i=1;i<a.k.length;i++)cur=mk("xor",[cur,build(a.k[i],false)]);
        return inv?mk("not",[cur]):cur;}
    }
  }
  var root=build(ast,false);
  return {nodes:nodes,root:root};
}
function netEval(net,env){var val=[];
  net.nodes.forEach(function(n,i){var v;
    if(n.op==="leaf")v=env[n.v]?1:0;else if(n.op==="const")v=n.v;
    else v=GATE_FN[n.op](n.ins.map(function(j){return val[j];}));val[i]=v;});return val;}
reg("gate-playground",function(el,cfg){
  V6.title(el,cfg.title||"\ub17c\ub9ac \uac8c\uc774\ud2b8 \ud50c\ub808\uc774\uadf8\ub77c\uc6b4\ub4dc");
  var expr=cfg.expr||"AB + A'C",cmp=cfg.compare||"",nandMode=cfg.nand===true,env={};
  var ctl=row(),inRow=row(),err=H("div",{style:"color:"+RED+";font-size:12.5px;min-height:1em"}),box=H("div"),info=noteBox();
  el.appendChild(inRow);el.appendChild(ctl);el.appendChild(err);el.appendChild(box);el.appendChild(info);
  var exprIn=txt(expr,260,function(v){expr=v;render();},"\uc608: AB + A'C");
  inRow.appendChild(H("label",{text:"F = "},[exprIn]));
  inRow.appendChild(H("span",{text:"\uc5f0\uc0b0\uc790: ' \ub610\ub294 ! (NOT)  * \ub610\ub294 \uc778\uc811 (AND)  ^ (XOR)  + (OR)",style:"color:#555"}));
  function render(){
    err.textContent="";var ast,vars;
    try{ast=parseExpr(expr);vars=astVars(ast);if(vars.length>5)throw new Error("\ubcc0\uc218\ub294 \ucd5c\ub300 5\uac1c\uae4c\uc9c0");}
    catch(e){err.textContent="\uc2dd \uc624\ub958: "+e.message;return;}
    vars.forEach(function(v){if(env[v]===undefined)env[v]=0;});
    var net=buildNet(ast,nandMode),val=netEval(net,env),n=vars.length;
    /* layout */
    var ROWH=46,leaves=0,lvl=[],yy=[];
    (function lay(id){var nd=net.nodes[id];
      if(!nd.ins.length){yy[id]=leaves*ROWH+46;leaves++;lvl[id]=0;return;}
      var ys=0,ml=0;nd.ins.forEach(function(c){lay(c);ys+=yy[c];ml=Math.max(ml,lvl[c]);});
      yy[id]=nd.op==="not"?yy[nd.ins[0]]:ys/nd.ins.length;lvl[id]=ml+1;})(net.root);
    var maxLvl=lvl[net.root],RW=Math.max(n,1)*22+16,GX=function(l){return RW+30+(l-1)*108;};
    var Wd=Math.max(560,GX(maxLvl)+48+90),Hh=Math.max(1,leaves)*ROWH+66;
    var svg=svgRoot(Wd,Hh);
    var railX={};vars.forEach(function(v,i){railX[v]=14+i*22;});
    /* rails */
    vars.forEach(function(v){var x=railX[v],on=env[v];
      svg.appendChild(S("line",{x1:x,y1:30,x2:x,y2:Hh-12,stroke:on?RED:INK,"stroke-width":on?2.6:1.2}));
      var g=S("g",{style:"cursor:pointer"});
      g.appendChild(S("rect",{x:x-10,y:4,width:20,height:22,rx:3,fill:on?RED:"#fff",stroke:on?RED:INK,"stroke-width":1.3}));
      g.appendChild(S("text",{x:x,y:19,"text-anchor":"middle","font-size":12,"font-weight":700,fill:on?"#fff":INK,text:v}));
      g.onclick=function(){env[v]=env[v]?0:1;render();};svg.appendChild(g);});
    function wireColor(v){return v?RED:INK;}
    function pinY(id,k){var nd=net.nodes[id],m=nd.ins.length;if(nd.op==="not")return yy[id];var h=gh(id);return yy[id]-h/2+h*(k+0.5)/m;}
    function gh(id){var m=net.nodes[id].ins.length;return Math.max(38,m*16);}
    function poly(pts,v){svg.appendChild(S("polyline",{points:pts.map(function(p){return p[0]+","+p[1];}).join(" "),fill:"none",stroke:wireColor(v),"stroke-width":v?2.6:1.3,"stroke-linejoin":"round"}));}
    /* wires first */
    net.nodes.forEach(function(nd,id){
      nd.ins.forEach(function(c,k){
        var cn=net.nodes[c],xin=GX(lvl[id]),py=pinY(id,k),vv=val[c];
        if(!cn.ins.length){ /* leaf: wire from rail */
          var x0=cn.op==="leaf"?railX[cn.v]:10,y0=yy[c];
          if(cn.op==="const"){svg.appendChild(S("text",{x:RW-2,y:y0+4,"text-anchor":"end","font-size":12,"font-weight":700,fill:INK,text:String(cn.v)}));x0=RW+2;}
          else svg.appendChild(S("circle",{cx:x0,cy:y0,r:3.2,fill:wireColor(vv)}));
          var xm=xin-14-6*(k%3);poly([[x0,y0],[xm,y0],[xm,py],[xin,py]],vv);
        }else{var xo=GX(lvl[c])+52,yo=yy[c],xm2=xin-14-6*(k%3);poly([[xo,yo],[xm2,yo],[xm2,py],[xin,py]],vv);}
      });});
    /* gates */
    net.nodes.forEach(function(nd,id){
      if(!nd.ins.length)return;
      var x=GX(lvl[id]),y=yy[id],h=gh(id),w=52,out=val[id];
      var shape,bubble=false,op=nd.op;
      var common={fill:"#fff",stroke:INK,"stroke-width":1.6};
      var bw=(op==="nand"||op==="nor"||op==="not")?w-8:w;
      if(op==="and"||op==="nand")shape=S("path",Object.assign({d:"M"+x+" "+(y-h/2)+" L"+(x+bw*0.5)+" "+(y-h/2)+" A"+(bw*0.5)+" "+(h/2)+" 0 0 1 "+(x+bw*0.5)+" "+(y+h/2)+" L"+x+" "+(y+h/2)+" Z"},common));
      else if(op==="or"||op==="nor"||op==="xor")shape=S("path",Object.assign({d:"M"+x+" "+(y-h/2)+" Q"+(x+bw*0.65)+" "+(y-h/2)+" "+(x+bw)+" "+y+" Q"+(x+bw*0.65)+" "+(y+h/2)+" "+x+" "+(y+h/2)+" Q"+(x+bw*0.3)+" "+y+" "+x+" "+(y-h/2)+" Z"},common));
      else shape=S("path",Object.assign({d:"M"+x+" "+(y-13)+" L"+(x+bw)+" "+y+" L"+x+" "+(y+13)+" Z"},common));
      svg.appendChild(shape);
      if(op==="nand"||op==="nor"||op==="not")svg.appendChild(S("circle",{cx:x+w-4,cy:y,r:4,fill:"#fff",stroke:INK,"stroke-width":1.6}));
      if(op==="xor")svg.appendChild(S("path",{d:"M"+(x-7)+" "+(y-h/2)+" Q"+(x-7+bw*0.3)+" "+y+" "+(x-7)+" "+(y+h/2),fill:"none",stroke:INK,"stroke-width":1.6}));
      var lbl={and:"AND",or:"OR",nand:"NAND",nor:"NOR",xor:"XOR",not:""}[op];
      if(lbl)svg.appendChild(S("text",{x:x+bw*0.46,y:y+3.5,"text-anchor":"middle","font-size":9.5,fill:"#666",text:lbl}));
      /* output stub wire value dot */
      svg.appendChild(S("text",{x:x+w+4,y:y-6,"font-size":10,"font-weight":700,fill:out?RED:MUTE,"font-family":"Consolas,monospace",text:String(out)}));
    });
    /* output */
    var ro=net.root,xr=GX(lvl[ro])+52,yr=yy[ro],ov=val[ro];
    poly([[xr,yr],[xr+36,yr]],ov);
    svg.appendChild(S("circle",{cx:xr+46,cy:yr,r:10,fill:ov?RED:"#fff",stroke:ov?RED:INK,"stroke-width":1.5}));
    svg.appendChild(S("text",{x:xr+46,y:yr+4,"text-anchor":"middle","font-size":12,"font-weight":700,fill:ov?"#fff":INK,text:String(ov)}));
    svg.appendChild(S("text",{x:xr+62,y:yr+4,"font-size":13,"font-weight":700,fill:INK,text:"F"}));
    box.innerHTML="";box.appendChild(svg);
    /* gate counts */
    var gc={};net.nodes.forEach(function(nd){if(nd.ins.length){gc[nd.op]=(gc[nd.op]||0)+1;}});
    var gcs=Object.keys(gc).map(function(k){return k.toUpperCase()+" "+gc[k];}).join(", ")||"\uac8c\uc774\ud2b8 \uc5c6\uc74c";
    /* truth table + minimal SOP */
    var tt=truthTable(ast,vars),cur=0;vars.forEach(function(v,j){cur|=(env[v]?1:0)<<(n-1-j);});
    var ones=[];tt.forEach(function(x,i){if(x)ones.push(i);});
    var nm=vars;var res=minimize(n,ones,[]);
    var min=ones.length===0?"0":(ones.length===tt.length?"1":exprFromCover(res,n,nm,false));
    var h="<div style='display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start'>";
    h+="<table><tr>"+vars.map(function(v){return "<th>"+v+"</th>";}).join("")+"<th>F</th></tr>";
    tt.forEach(function(x,i){h+="<tr data-r='"+i+"' style='cursor:pointer"+(i===cur?";outline:2px solid "+RED+";outline-offset:-2px":"")+"'>"+
      vars.map(function(v,j){return "<td>"+((i>>(n-1-j))&1)+"</td>";}).join("")+"<td style='font-weight:700;"+(x?"color:"+RED:"")+"'>"+x+"</td></tr>";});
    h+="</table><div style='flex:1;min-width:240px'>";
    h+="\uac8c\uc774\ud2b8: "+gcs+(nandMode?" (NAND \uc73c\ub85c \ubcc0\ud658)":"")+"<br>";
    h+="\uc785\ub825 "+vars.map(function(v){return v+"="+env[v];}).join(", ")+" \u2192 F = <b style='color:"+RED+"'>"+ov+"</b><br>";
    h+="\uc9c4\ub9ac\ud45c \uae30\uc900 \ucd5c\uc18c SOP: <b style='color:"+RED+"'>"+min+"</b>";
    if(ones.length&&exprFromCover(res,n,nm,false)!==""){var lits=0;res.cover.forEach(function(i){lits+=litCount(n,res.pis[i]);});}
    h+="<br><span style='color:#555'>F = \u03a3m("+(ones.join(",")||"\uc5c6\uc74c")+")</span>";
    h+="<div id='cmpbox' style='margin-top:10px'></div></div></div>";
    info.innerHTML=h;
    info.querySelectorAll("tr[data-r]").forEach(function(tr){tr.onclick=function(){var i=+tr.getAttribute("data-r");vars.forEach(function(v,j){env[v]=(i>>(n-1-j))&1;});render();};});
    /* compare box */
    var cb=info.querySelector("#cmpbox");cb.removeAttribute("id");
    var cin=txt(cmp,200,function(v){cmp=v;updateCmp();},"\ube44\uad50\ud560 \uc2dd (\uc608: \ucd5c\uc18c\ud654\ud55c \uc2dd)");
    var cres=H("div",{style:"margin-top:4px"});
    cb.appendChild(H("label",{text:"\ube44\uad50 \uc2dd G = "},[cin]));cb.appendChild(cres);
    function updateCmp(){
      if(!cmp.trim()){cres.textContent="";return;}
      try{var a2=parseExpr(cmp),v2=astVars(a2),all=vars.concat(v2.filter(function(x){return vars.indexOf(x)<0;})).sort();
        var bad=null;for(var i=0;i<(1<<all.length)&&bad===null;i++){var e2={};all.forEach(function(v,j){e2[v]=(i>>(all.length-1-j))&1;});
          if(astEval(ast,e2)!==astEval(a2,e2))bad=e2;}
        if(bad===null)cres.innerHTML="<b>\ub3d9\uce58</b>: \ubaa8\ub4e0 \uc785\ub825\uc5d0\uc11c F = G.";
        else cres.innerHTML="<b style='color:"+RED+"'>\ub2e4\ub984</b>: "+all.map(function(v){return v+"="+bad[v];}).join(", ")+" \uc5d0\uc11c F="+astEval(ast,bad)+", G="+astEval(parseExpr(cmp),bad);
      }catch(e){cres.innerHTML="<span style='color:"+RED+"'>\uc2dd \uc624\ub958: "+e.message+"</span>";}
    }
    updateCmp();
    /* controls */
    ctl.innerHTML="";
    var b1=btn("AND / OR / NOT",function(){nandMode=false;render();}),b2=btn("NAND \ub9cc \uc0ac\uc6a9",function(){nandMode=true;render();});
    (nandMode?b2:b1).style.cssText+="background:"+INK+";color:#fff";
    ctl.appendChild(b1);ctl.appendChild(b2);
    ctl.appendChild(btn("\uc785\ub825 \ubaa8\ub450 0",function(){vars.forEach(function(v){env[v]=0;});render();}));
    ctl.appendChild(btn("\ub2e4\uc74c \uc9c4\ub9ac\ud45c \ud589",function(){var i=(cur+1)%(1<<n);vars.forEach(function(v,j){env[v]=(i>>(n-1-j))&1;});render();}));
    if(cfg.presets&&cfg.presets.length){var po=[["","\uc608\uc81c \uc2dd"]];cfg.presets.forEach(function(p,i){po.push([i,p]);});
      ctl.appendChild(sel(po,"",function(x){if(x==="")return;expr=cfg.presets[+x];exprIn.value=expr;env={};render();}));}
    if(cfg.note)info.appendChild(H("div",{html:cfg.note,style:"margin-top:8px;color:#555"}));
  }
  render();
});

/* ================= two's complement ================= */
function sgn(u,n){return u>=Math.pow(2,n-1)?u-Math.pow(2,n):u;}
function fromSigned(v,n){return v<0?v+Math.pow(2,n):v;}
function rangeStr(n){return (-Math.pow(2,n-1))+" ~ "+(Math.pow(2,n-1)-1);}
function minus(x){return x<0?"\u2212"+(-x):String(x);}
reg("twos-complement",function(el,cfg){
  V6.title(el,cfg.title||"2\uc758 \ubcf4\uc218 \ubcc0\ud658\uae30");
  var n=cfg.bits||4,u=fromSigned(cfg.value===undefined?-3:cfg.value,n);
  var ctl=row(),box=H("div"),info=noteBox();el.appendChild(ctl);el.appendChild(box);el.appendChild(info);
  var msg="",decStr=null;
  function render(){
    var mod=Math.pow(2,n),mask=mod-1,half=mod/2;
    var s2=sgn(u,n),sign=u>=half?1:0,mag=u%half;
    var sm=sign?-mag:mag,o1=sign?-((~u)&mask):u,smStr=sign&&mag===0?"\u22120":minus(sm),o1Str=sign&&((~u)&mask)===0?"\u22120":minus(o1);
    /* bit cells */
    var svg=svgRoot(Math.max(420,n*52+40),150),cw=Math.min(52,Math.floor(660/n)),x0=20;
    for(var i=0;i<n;i++){var bit=(u>>(n-1-i))&1,x=x0+i*cw,w=(i===0)?-Math.pow(2,n-1):Math.pow(2,n-1-i);
      var g=S("g",{style:"cursor:pointer"});
      g.appendChild(S("rect",{x:x,y:34,width:cw-4,height:44,fill:bit?INK:"#fff",stroke:i===0?RED:INK,"stroke-width":i===0?2.4:1.4}));
      g.appendChild(S("text",{x:x+(cw-4)/2,y:64,"text-anchor":"middle","font-size":24,"font-weight":700,fill:bit?"#fff":INK,"font-family":"Consolas,monospace",text:String(bit)}));
      (function(i){g.onclick=function(){u=(u^(1<<(n-1-i)))>>>0;decStr=null;msg="";render();};})(i);
      svg.appendChild(g);
      svg.appendChild(S("text",{x:x+(cw-4)/2,y:26,"text-anchor":"middle","font-size":11,fill:i===0?RED:MUTE,"font-weight":i===0?700:400,text:i===0?"\u2212"+Math.pow(2,n-1):String(Math.pow(2,n-1-i))}));
      svg.appendChild(S("text",{x:x+(cw-4)/2,y:98,"text-anchor":"middle","font-size":12,fill:bit?(i===0?RED:INK):"#bbb","font-family":"Consolas,monospace",text:bit?(i===0?"\u2212"+Math.pow(2,n-1):"+"+w):"0"}));
    }
    svg.appendChild(S("text",{x:x0,y:9,"font-size":11,fill:MUTE,text:"\ubd80\ud638 \ube44\ud2b8 = \uac00\uc911\uce58 \u2212"+Math.pow(2,n-1)+" (\ube68\uac04 \ud14c\ub450\ub9ac). \ube44\ud2b8\ub97c \ud074\ub9ad\ud574 \ubc14\uafbc\ub2e4."}));
    var terms=[];for(var j=0;j<n;j++){var b=(u>>(n-1-j))&1;if(b)terms.push(j===0?"(\u2212"+Math.pow(2,n-1)+")":String(Math.pow(2,n-1-j)));}
    svg.appendChild(S("text",{x:x0,y:128,"font-size":13,fill:INK,"font-family":"Consolas,'Noto Sans KR',monospace",text:"\ud569 = "+(terms.length?terms.join(" + "):"0")+" = "+minus(s2)}));
    box.innerHTML="";box.appendChild(svg);
    /* table */
    var h="<table><tr><th>\ud574\uc11d</th><th>\uac12</th><th>\ud45c\ud604 \ubc94\uc704 ("+n+"\ube44\ud2b8)</th></tr>"+
      "<tr><td>unsigned</td><td>"+u+"</td><td>0 ~ "+(mod-1)+"</td></tr>"+
      "<tr><td>sign-magnitude</td><td>"+smStr+"</td><td>"+(-(half-1))+" ~ "+(half-1)+" (0 \uc774 \ub450 \uac1c)</td></tr>"+
      "<tr><td>1\uc758 \ubcf4\uc218</td><td>"+o1Str+"</td><td>"+(-(half-1))+" ~ "+(half-1)+" (0 \uc774 \ub450 \uac1c)</td></tr>"+
      "<tr style='outline:2px solid "+RED+";outline-offset:-2px'><td><b>2\uc758 \ubcf4\uc218</b></td><td><b style='color:"+RED+"'>"+minus(s2)+"</b></td><td>"+rangeStr(n)+" (0 \uc774 \ud558\ub098)</td></tr></table>";
    /* negate steps */
    var inv=(~u)&mask,neg=(inv+1)&mask,carryOut=(inv+1)>mask;
    h+="<div style='margin-top:8px'><b>\ubd80\ud638 \ubc14\uafb8\uae30</b> (\u2212x = x\u0304 + 1): "+bin(u,n)+" \u2192 \ube44\ud2b8 \ubc18\uc804 "+bin(inv,n)+" \u2192 +1 \u2192 <b style='color:"+RED+"'>"+bin(neg,n)+"</b> = "+minus(sgn(neg,n));
    if(u===half)h+="<br><span style='color:"+RED+"'>\uc774 \uac12\uc740 \ucd5c\uc19f\uac12 \u2212"+half+" \uc774\ub2e4. \ubd80\uc815\ud574\ub3c4 \uc790\uae30 \uc790\uc2e0\uc774 \ub41c\ub2e4 (+"+half+" \uc740 "+n+"\ube44\ud2b8\ub85c \ud45c\ud604 \ubd88\uac00).</span>";
    else if(u===0)h+="<br><span style='color:#555'>0 \uc758 \ubd80\uc815\uc740 0. \uc62c\ub9bc(carry)\uc774 \ubc16\uc73c\ub85c \ub098\uac00\uc9c0\ub9cc \ubc84\ub9b0\ub2e4.</span>";
    h+="</div>";
    h+="<div style='margin-top:4px'><b>\ubd80\ud638 \ud655\uc7a5</b> ("+n+"\u2192"+(n+4)+"\ube44\ud2b8): \ubd80\ud638 \ube44\ud2b8 "+sign+" \ub97c \uc55e\uc5d0 4\uac1c \ucc44\uc6b4\ub2e4 \u2192 "+bin(u,n).replace(/^/,String(sign).repeat(4))+" (\uac12 "+minus(s2)+" \uadf8\ub300\ub85c)</div>";
    info.innerHTML=h;
    /* controls */
    ctl.innerHTML="";
    ctl.appendChild(H("label",{text:"\ube44\ud2b8 \uc218 "},[sel([[3,"3"],[4,"4"],[5,"5"],[6,"6"],[8,"8"],[12,"12"],[16,"16"]],n,function(x){var old=s2;n=+x;var lim=Math.pow(2,n-1);if(old>=lim||old<-lim)old=Math.max(-lim,Math.min(lim-1,old));u=fromSigned(old,n);decStr=null;msg="";render();})]));
    var inp=txt(decStr!==null?decStr:String(s2),70,function(v){decStr=v;var x=parseInt(v,10);
      if(v.trim()===""||v.trim()==="-"||isNaN(x)||String(x)!==v.trim().replace(/^\+/,"")){m.textContent="\uc815\uc218\ub97c \uc785\ub825";return;}
      var lim=Math.pow(2,n-1);if(x<-lim||x>=lim){m.textContent=x+" \uc740(\ub294) "+n+"\ube44\ud2b8 2\uc758 \ubcf4\uc218 \ubc94\uc704 ("+rangeStr(n)+") \ubc16 \u2192 overflow";return;}
      u=fromSigned(x,n);m.textContent="";render2(true);},"-3");
    var m=H("span",{style:"color:"+RED+";font-size:12.5px"});
    ctl.appendChild(H("label",{text:"10\uc9c4 \uc785\ub825 "},[inp]));ctl.appendChild(m);
    ctl.appendChild(btn("\ubd80\ud638 \ubc14\uafb8\uae30 (\u2212x)",function(){u=neg;decStr=null;render();}));
    ctl.appendChild(btn("+1",function(){u=(u+1)&mask;decStr=null;render();}));
    function render2(keepInput){var keep=decStr;render();decStr=keep;/* input element recreated; restore focus */
      var ni=ctl.querySelector("input[type=text]");if(ni){ni.value=keep;ni.focus();ni.setSelectionRange(keep.length,keep.length);}}
  }
  render();
});

/* ================= two's complement adder ================= */
reg("twos-adder",function(el,cfg){
  V6.title(el,cfg.title||"2\uc758 \ubcf4\uc218 \ub367\uc148\u00b7\ubf40\uc148\uacfc overflow");
  var n=cfg.bits||4,a=cfg.a===undefined?5:cfg.a,b=cfg.b===undefined?3:cfg.b,op=cfg.op==="sub"?"sub":"add";
  var ctl=row(),box=H("div"),info=noteBox();el.appendChild(ctl);el.appendChild(box);el.appendChild(info);
  function clamp(v){var lim=Math.pow(2,n-1);return Math.max(-lim,Math.min(lim-1,v));}
  function render(){
    a=clamp(a);b=clamp(b);
    var mod=Math.pow(2,n),mask=mod-1,A=fromSigned(a,n),B0=fromSigned(b,n),B=op==="sub"?((~B0)&mask):B0,cin=op==="sub"?1:0;
    var c=[cin],sum=[];
    for(var i=0;i<n;i++){var ai=(A>>i)&1,bi=(B>>i)&1,ci=c[i];sum[i]=ai^bi^ci;c[i+1]=(ai&bi)|(ai&ci)|(bi&ci);}
    var S2=0;for(var k=0;k<n;k++)S2|=sum[k]<<k;
    var res=sgn(S2,n),truth=op==="add"?a+b:a-b,lim=Math.pow(2,n-1),ovf=(c[n]^c[n-1])===1,range=(truth<-lim||truth>=lim);
    /* grid: columns 0..n (index n = extra carry-out column on the left) */
    var cw=Math.min(54,Math.floor(560/(n+2))),x0=110,Wd=x0+(n+1)*cw+130,Hh=196,svg=svgRoot(Math.max(Wd,460),Hh);
    function colX(i){return x0+(n-i)*cw+cw/2;}
    function cell(i,y,t,color,bold){svg.appendChild(S("text",{x:colX(i),y:y,"text-anchor":"middle","font-size":19,"font-family":"Consolas,monospace","font-weight":bold?700:400,fill:color||INK,text:String(t)}));}
    function lab(y,t,color){svg.appendChild(S("text",{x:x0-8,y:y,"text-anchor":"end","font-size":12,fill:color||INK,"font-weight":700,text:t}));}
    for(var q=0;q<n;q++)svg.appendChild(S("text",{x:colX(q),y:14,"text-anchor":"middle","font-size":10,fill:MUTE,text:"bit "+q}));
    lab(44,"carry C");
    for(var i3=0;i3<=n;i3++){var hot=ovf&&(i3===n||i3===n-1);
      cell(i3,44,c[i3],hot?RED:(i3===0&&op==="sub"?INK:MUTE),hot);
      if(hot)svg.appendChild(S("text",{x:colX(i3),y:58,"text-anchor":"middle","font-size":9,fill:RED,text:i3===n?"C\u2099":"C\u2099\u208b\u2081"}));}
    lab(86,op==="sub"?"A":"A = "+minus(a));if(op==="sub")svg.lastChild.textContent="A = "+minus(a);
    for(var i4=0;i4<n;i4++)cell(i4,86,(A>>i4)&1);
    lab(116,op==="sub"?"B\u0304 (B \ubc18\uc804)":"B = "+minus(b));for(var i5=0;i5<n;i5++)cell(i5,116,(B>>i5)&1);
    svg.appendChild(S("line",{x1:x0,y1:126,x2:x0+n*cw+cw,y2:126,stroke:INK,"stroke-width":1.6}));
    lab(154,"Sum");for(var i6=0;i6<n;i6++)cell(i6,154,sum[i6],INK,true);
    cell(n,154,c[n],MUTE,false);
    svg.appendChild(S("text",{x:x0+(n+1)*cw+10,y:154,"font-size":13,"font-weight":700,fill:INK,text:"= "+minus(res)}));
    svg.appendChild(S("text",{x:x0,y:184,"font-size":11,fill:MUTE,text:(op==="sub"?"C\u2080 = 1. ":"C\u2080 = 0. ")+"\ube44\ud2b8 \uc704 \uac12 = \uadf8 \ube44\ud2b8\ub85c \ub4e4\uc5b4\uc624\ub294 carry, \ub9e8 \uc67c\ucabd C\u2099 = carry-out."}));
    box.innerHTML="";box.appendChild(svg);
    var h="<div>"+(op==="sub"?"A \u2212 B = A + B\u0304 + 1 (B \ub97c \ubc18\uc804\ud558\uace0 carry-in = 1)":"A + B")+" \u2192 \uc2e4\uc81c \uac12 "+minus(truth)+", \ube44\ud2b8 \uacb0\uacfc <b>"+bin(S2,n)+"</b> = "+minus(res)+"</div>";
    h+="<div style='margin-top:4px'>C<sub>n\u22121</sub> = "+c[n-1]+", C<sub>n</sub> = "+c[n]+" \u2192 overflow = C<sub>n\u22121</sub> \u2295 C<sub>n</sub> = <b style='color:"+(ovf?RED:INK)+"'>"+(ovf?1:0)+"</b></div>";
    h+="<div style='margin-top:4px'>"+(ovf?"<b style='color:"+RED+"'>signed overflow</b>: \uc2e4\uc81c \uac12 "+minus(truth)+" \uc774 "+n+"\ube44\ud2b8 \ubc94\uc704("+rangeStr(n)+") \ubc16\uc774\ub77c \ube44\ud2b8 \uacb0\uacfc "+minus(res)+" \uac00 \ud2c0\ub9b0\ub2e4.":"signed overflow \uc5c6\uc74c: \uc2e4\uc81c \uac12\uc774 \ubc94\uc704 \uc548\uc774\ub77c \uacb0\uacfc\uac00 \ub9de\ub294\ub2e4.")+"</div>";
    var un=op==="add"?(A+B0):(A-B0);
    h+="<div style='margin-top:4px;color:#555'>unsigned \ub85c \ubcf4\uba74 "+A+(op==="add"?" + ":" \u2212 ")+B0+" = "+un+" ("+(op==="add"?(c[n]?"CO=1 \u2192 unsigned overflow":"CO=0 \u2192 unsigned \ubc94\uc704 \uc548"):(c[n]?"CO=1 \u2192 borrow \uc5c6\uc74c":"CO=0 \u2192 unsigned borrow \ubc1c\uc0dd"))+"). \uac19\uc740 \ube44\ud2b8 \uc5f0\uc0b0\uc774\uc9c0\ub9cc signed overflow \uc640 unsigned overflow \ub294 \ub530\ub85c \ud310\ub2e8\ud55c\ub2e4.</div>";
    info.innerHTML=h;
    /* controls */
    ctl.innerHTML="";
    ctl.appendChild(H("label",{text:"\ube44\ud2b8 \uc218 "},[sel([[3,"3"],[4,"4"],[5,"5"],[6,"6"],[8,"8"]],n,function(x){n=+x;render();})]));
    function numIn(label,get,set){var i=txt(String(get()),56,function(v){var x=parseInt(v,10);if(!isNaN(x)&&String(x)===v.trim()){set(clamp(x));renderKeep(i);}});
      return H("label",{text:label+" "},[i]);}
    function renderKeep(inp){var ae=inp.value;render();var inps=ctl.querySelectorAll("input[type=text]");
      for(var z=0;z<inps.length;z++){if(inps[z].getAttribute("data-k")===inp.getAttribute("data-k")){inps[z].focus();}}}
    var ia=numIn("A",function(){return a;},function(v){a=v;}),ib=numIn("B",function(){return b;},function(v){b=v;});
    ia.lastChild.setAttribute("data-k","a");ib.lastChild.setAttribute("data-k","b");
    ctl.appendChild(ia);ctl.appendChild(ib);
    var bAdd=btn("A + B",function(){op="add";render();}),bSub=btn("A \u2212 B",function(){op="sub";render();});
    (op==="add"?bAdd:bSub).style.cssText+="background:"+INK+";color:#fff";
    ctl.appendChild(bAdd);ctl.appendChild(bSub);
    ctl.appendChild(H("span",{text:"\uc785\ub825\uc740 "+rangeStr(n)+" \ubc94\uc704\ub85c \uc790\ub978\ub2e4",style:"color:#555"}));
  }
  render();
});

/* ================= IEEE 754 ================= */
var FMT={half:{name:"half (16)",e:5,f:10,bias:15},single:{name:"single (32)",e:8,f:23,bias:127},double:{name:"double (64)",e:11,f:52,bias:1023}};
function big(x){return BigInt(x);}
function encodeFloat(x,fmt){
  var eb=fmt.e,fb=fmt.f,bias=fmt.bias,maxE=(1<<eb)-1,sign=(x<0||(x===0&&1/x<0))?1n:0n;
  function pack(ef,f){return (sign<<big(eb+fb))|(big(ef)<<big(fb))|f;}
  if(isNaN(x))return (0n<<big(eb+fb))|(big(maxE)<<big(fb))|(1n<<big(fb-1));
  if(!isFinite(x))return pack(maxE,0n);
  if(x===0)return pack(0,0n);
  var dv=new DataView(new ArrayBuffer(8));dv.setFloat64(0,Math.abs(x));
  var hi=big(dv.getUint32(0)),lo=big(dv.getUint32(4)),bits=(hi<<32n)|lo;
  var expd=Number((bits>>52n)&0x7ffn),frac=bits&((1n<<52n)-1n),M,E;
  if(expd===0){M=frac;E=-1074;}else{M=frac|(1n<<52n);E=expd-1075;}
  var len=M.toString(2).length,q=len-1+E,emin=1-bias,qq=Math.max(q,emin),qe=qq-fb,sh=E-qe,N;
  if(sh>=0)N=M<<big(sh);
  else{var s=big(-sh);N=M>>s;var rem=M&((1n<<s)-1n),half=1n<<(s-1n);if(rem>half||(rem===half&&(N&1n)===1n))N+=1n;}
  var hidden=1n<<big(fb);
  if(N>=hidden){ /* normal (or rounded up into normal) */
    if(N>=(hidden<<1n)){N>>=1n;qq+=1;}
    var ef=qq+bias;if(ef>=maxE)return pack(maxE,0n);
    return pack(ef,N-hidden);
  }
  return pack(0,N);
}
function decodeFloat(bits,fmt){
  var eb=fmt.e,fb=fmt.f,bias=fmt.bias,maxE=(1<<eb)-1;
  var f=bits&((1n<<big(fb))-1n),e=Number((bits>>big(fb))&big(maxE)),s=Number((bits>>big(eb+fb))&1n);
  var o={s:s,e:e,f:f,bias:bias,cls:""};
  if(e===0&&f===0n){o.cls="zero";o.N=0n;o.X=0;}
  else if(e===0){o.cls="subnormal";o.N=f;o.X=1-bias-fb;o.E=1-bias;}
  else if(e===maxE){o.cls=f===0n?"inf":"nan";o.N=0n;o.X=0;}
  else{o.cls="normal";o.N=(1n<<big(fb))|f;o.X=e-bias-fb;o.E=e-bias;}
  return o;
}
function exactDecimal(N,X){ /* N * 2^X as exact decimal string (no sign) */
  if(N===0n)return "0";
  if(X>=0)return (N<<big(X)).toString();
  var k=-X,v=N*(5n**big(k)),str=v.toString();
  while(str.length<=k)str="0"+str;
  var ip=str.slice(0,str.length-k),fp=str.slice(str.length-k).replace(/0+$/,"");
  return fp?ip+"."+fp:ip;
}
function numFromDecoded(o){if(o.cls==="zero")return o.s?-0:0;if(o.cls==="inf")return o.s?-Infinity:Infinity;if(o.cls==="nan")return NaN;
  var v=Number(o.N)*Math.pow(2,o.X);return o.s?-v:v;}
function toBinStr(v,w){var s=v.toString(2);while(s.length<w)s="0"+s;return s;}
reg("ieee754",function(el,cfg){
  V6.title(el,cfg.title||"IEEE 754 \ube44\ud2b8 \ubd84\ud574");
  var fk=FMT[cfg.format]?cfg.format:"single",fmt=FMT[fk],input=cfg.value===undefined?"-6.25":String(cfg.value),bits=0n,typed=null;
  function setFromText(t){var x;var tt=t.trim().toLowerCase();
    if(tt==="inf"||tt==="+inf"||tt==="infinity")x=Infinity;else if(tt==="-inf"||tt==="-infinity")x=-Infinity;else if(tt==="nan")x=NaN;
    else{if(tt===""||isNaN(Number(tt)))return false;x=Number(tt);}
    typed=x;bits=encodeFloat(x,fmt);return true;}
  setFromText(input);
  var ctl=row(),box=H("div"),info=noteBox(),err=H("span",{style:"color:"+RED+";font-size:12.5px"});
  el.appendChild(ctl);el.appendChild(box);el.appendChild(info);
  function render(){
    var tot=1+fmt.e+fmt.f,o=decodeFloat(bits,fmt);
    /* bit cells */
    box.innerHTML="";
    function group(label,from,len,color){
      var g=H("div",{style:"display:inline-block;vertical-align:top;margin:0 10px 8px 0"});
      g.appendChild(H("div",{text:label,style:"font-size:11px;font-weight:700;letter-spacing:.04em;color:"+color+";margin-bottom:2px"}));
      var wrap=H("div",{style:"display:flex;flex-wrap:wrap;gap:2px;max-width:"+Math.min(len,32)*21+"px"});
      for(var i=0;i<len;i++){(function(pos){var bit=Number((bits>>big(pos))&1n);
        var c=H("button",{type:"button",text:String(bit)});
        c.style.cssText="width:19px;height:26px;padding:0;font-family:Consolas,monospace;font-size:13px;font-weight:700;border:1.4px solid "+color+";border-radius:2px;cursor:pointer;background:"+(bit?color:"#fff")+";color:"+(bit?"#fff":color);
        c.onclick=function(){bits^=(1n<<big(pos));typed=null;input=null;render();};wrap.appendChild(c);})(from-1-i);}
      g.appendChild(wrap);box.appendChild(g);}
    group("\ubd80\ud638 s",tot,1,RED);
    group("\uc9c0\uc218 e ("+fmt.e+"\ube44\ud2b8, \ud3b8\ud5a5 "+fmt.bias+")",fmt.e+fmt.f,fmt.e,INK);
    group("\uac00\uc218 f ("+fmt.f+"\ube44\ud2b8)",fmt.f,fmt.f,"#555");
    /* breakdown */
    var eStr=toBinStr(BigInt(o.e),fmt.e),fStr=toBinStr(o.f,fmt.f),hex="0x"+toBinStr(bits,tot).replace(/(....)/g,"$1").match(/.{1,4}/g).map(function(x){return parseInt(x,2).toString(16);}).join("").toUpperCase();
    var h="<table><tr><th>\ud544\ub4dc</th><th>\ube44\ud2b8</th><th>\ud574\uc11d</th></tr>";
    h+="<tr><td style='white-space:nowrap'>\ubd80\ud638 s</td><td style='font-family:Consolas,monospace'>"+o.s+"</td><td>(\u22121)<sup>"+o.s+"</sup> = "+(o.s?"\u22121":"+1")+"</td></tr>";
    h+="<tr><td style='white-space:nowrap'>\uc9c0\uc218 e</td><td style='font-family:Consolas,monospace'>"+eStr+"</td><td>e = "+o.e+(o.cls==="normal"?", E = e \u2212 "+o.bias+" = <b>"+o.E+"</b>":(o.cls==="subnormal"?" (\ubaa8\ub450 0 \u2192 subnormal), E = 1 \u2212 "+o.bias+" = <b>"+o.E+"</b>":(o.cls==="zero"?" (\ubaa8\ub450 0)":" (\ubaa8\ub450 1)")))+"</td></tr>";
    var sig;if(o.cls==="normal"||o.cls==="subnormal"){sig=exactDecimal(o.N,-fmt.f);}
    var fShow=fStr.replace(/0+$/,"");
    h+="<tr><td style='white-space:nowrap'>\uac00\uc218 f</td><td style='font-family:Consolas,monospace;word-break:break-all'>"+fStr+"</td><td>"+(o.cls==="normal"?"\uc554\ubb35\uc758 1 \uc744 \ubd99\uc5ec \uc720\ud6a8\uc22b\uc790 1."+(fShow||"0")+"<sub>2</sub> = "+sig:(o.cls==="subnormal"?"\uc554\ubb35\uc758 1 \uc5c6\uc774 0."+(fShow||"0")+"<sub>2</sub> = "+sig:(o.cls==="nan"?(o.f!==0n?"f \u2260 0":""):(o.cls==="inf"?"f = 0":"f = 0"))))+"</td></tr></table>";
    var val,exact;
    if(o.cls==="nan"){val="NaN";exact="";}
    else if(o.cls==="inf"){val=(o.s?"\u2212":"+")+"\u221e";exact="";}
    else{exact=exactDecimal(o.N,o.X);val=(o.s?"\u2212":"")+exact;}
    h+="<div style='margin-top:8px'>\ubd84\ub958: <b>"+({normal:"normalized",subnormal:"denormalized (subnormal)",zero:(o.s?"\u22120":"+0"),inf:"\u00b1\u221e",nan:"NaN"}[o.cls])+"</b>";
    if(o.cls==="normal")h+="<br>\uac12 = (\u22121)<sup>"+o.s+"</sup> \u00d7 1.f \u00d7 2<sup>E</sup> = "+(o.s?"\u22121":"1")+" \u00d7 "+sig+" \u00d7 2<sup>"+o.E+"</sup>";
    if(o.cls==="subnormal")h+="<br>\uac12 = (\u22121)<sup>"+o.s+"</sup> \u00d7 0.f \u00d7 2<sup>1\u2212bias</sup> = "+(o.s?"\u22121":"1")+" \u00d7 "+sig+" \u00d7 2<sup>"+o.E+"</sup>";
    var vshow=val.length>70?val.slice(0,70)+"\u2026 ("+val.length+"\uc790\ub9ac)":val;
    h+="<br>\uc800\uc7a5\ub41c \uac12(\uc815\ud655\ud55c \uc2ed\uc9c4\uac12) = <b style='color:"+RED+";word-break:break-all'>"+vshow+"</b>";
    if(o.cls==="normal"||o.cls==="subnormal"){var ulpE=o.X;h+="<br><span style='color:#555'>\uc778\uc811\ud55c \ud45c\ud604\uac12 \uc0ac\uc774 \uac04\uaca9(ulp) = 2<sup>"+ulpE+"</sup> = "+(ulpE>-60?exactDecimal(1n,ulpE):"2^"+ulpE)+"</span>";}
    h+="<br><span style='color:#555'>16\uc9c4\uc218 "+hex+"</span>";
    if(typed!==null&&isFinite(typed)&&o.cls!=="nan"&&o.cls!=="inf"){
      var ex=exactDecimal(o.N,o.X),stored=o.s?-numFromDecoded(o):numFromDecoded(o);
      var same=(numFromDecoded(o)===typed)||(typed===0);
      var mm=/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.exec(String(input).trim());
      if(mm&&typed!==0){var ds=String(input).trim().replace(/^[+-]/,""),ex2=0,eidx=ds.search(/e/i);
        if(eidx>=0){ex2=parseInt(ds.slice(eidx+1),10);ds=ds.slice(0,eidx);}
        var dot=ds.indexOf("."),fl=dot>=0?ds.length-dot-1:0,M=BigInt(ds.replace(".","")||"0"),e10=ex2-fl;
        var lhs=M*(10n**big(Math.max(e10,0)))*(2n**big(Math.max(-o.X,0))),rhs=o.N*(2n**big(Math.max(o.X,0)))*(10n**big(Math.max(-e10,0)));
        same=(lhs===rhs);}
      h+="<br>"+(same?"\uc785\ub825\uac12 "+input+" \uc740(\ub294) \uc774 \ud615\uc2dd\uc5d0\uc11c <b>\uc815\ud655\ud788</b> \ud45c\ud604\ub41c\ub2e4.":"\uc785\ub825\uac12 "+input+" \uc740(\ub294) \uc815\ud655\ud788 \ud45c\ud604\ub418\uc9c0 \uc54a\uc544 <b style='color:"+RED+"'>\uac00\uc7a5 \uac00\uae4c\uc6b4 \ud45c\ud604\uac12\uc73c\ub85c \ubc18\uc62c\ub9bc</b>(round to nearest even)\ub41c\ub2e4.");
    }
    if(o.cls==="inf"&&typed!==null&&isFinite(typed))h+="<br><span style='color:"+RED+"'>\uc785\ub825\uac12\uc774 \uc774 \ud615\uc2dd\uc758 \ucd5c\ub313\uac12\ubcf4\ub2e4 \ucee4\uc11c \u221e \ub85c overflow \ud588\ub2e4.</span>";
    h+="</div>";
    info.innerHTML=h;
    /* controls */
    ctl.innerHTML="";
    ctl.appendChild(H("label",{text:"\ud615\uc2dd "},[sel([["half","half (16)"],["single","single (32)"],["double","double (64)"]],fk,function(k){
      var keep=typed;fk=k;fmt=FMT[k];if(keep!==null){typed=keep;bits=encodeFloat(keep,fmt);input=input||String(keep);}else bits=0n;render();})]));
    var inp=txt(input===null?"":input,130,function(v){input=v;if(setFromText(v)){err.textContent="";renderKeep();}else err.textContent=v.trim()===""?"":"\uc22b\uc790, inf, nan \uc911 \ud558\ub098\ub97c \uc785\ub825";},"-6.25");
    ctl.appendChild(H("label",{text:"10\uc9c4 \uc785\ub825 "},[inp]));ctl.appendChild(err);
    function renderKeep(){var v=inp.value;render();var ni=ctl.querySelector("input[type=text]");ni.value=v;ni.focus();ni.setSelectionRange(v.length,v.length);}
    [["0.1","0.1"],["\u22126.25","-6.25"],["1/3","0.3333333333333333"],["\ucd5c\ub313\uac12","max"],["\u221e","inf"],["NaN","nan"],["\u22120","-0"]].forEach(function(p){
      ctl.appendChild(btn(p[0],function(){var v=p[1];if(v==="max"){var m=Math.pow(2,fmt.bias)*(2-Math.pow(2,-fmt.f));v=String(m);}input=v;setFromText(v);render();}));});
  }
  render();
});

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mountMine);else mountMine();
/* test hooks */
V6.extra={minimize:minimize,parseExpr:parseExpr,truthTable:truthTable,astVars:astVars,astEval:astEval,buildNet:buildNet,netEval:netEval,
  encodeFloat:encodeFloat,decodeFloat:decodeFloat,exactDecimal:exactDecimal,FMT:FMT,termSOP:termSOP,exprFromCover:exprFromCover};
})();
