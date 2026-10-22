/* eece274 v6-extra.js - course widgets for the EECE274 notes site.
   Widgets: kmap, fsm-player, timing-diagram, ff-timing, gate-playground,
            twos-complement, twos-adder, ieee754
   Style: white bg, ink #1a1a1a, red #9e2b25 accent only. Registered via V6.register. */
(function(){
"use strict";
if(!window.V6){console.warn("v6-extra: V6 runtime missing");return;}
var V6=window.V6,INK=V6.INK||"#1a1a1a",RED=V6.RED||"#9e2b25",GRID=V6.GRID||"#e8e6e0",MUTE="#8a8a8a";
var mine={};
function reg(name,fn){var g=function(el,cfg){if(el.__vx)return;el.__vx=1;fn(el,cfg);};mine[name]=g;V6.register(name,g);}
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
reg("kmap", function(el, cfg) {
  V6.title(el, cfg.title || "K-map 최소화");
  var n = Math.min(4, Math.max(2, cfg.vars || 3));
  var names = cfg.names || null;
  var mode = cfg.mode === "pos" ? "pos" : "sop";
  var vals = [];
  function reset(nn) {
    vals = [];
    for (var i = 0; i < (1 << nn); i++) vals.push(0);
  }
  function load(nn, m, d) {
    n = nn;
    reset(n);
    (m || []).forEach(function(i) {
      if (Number.isInteger(i) && i >= 0 && i < vals.length) vals[i] = 1;
    });
    (d || []).forEach(function(i) {
      if (Number.isInteger(i) && i >= 0 && i < vals.length) vals[i] = 2;
    });
  }
  load(n, cfg.minterms, cfg.dontcares);
  var editable = cfg.editable !== false, showIdx = true;
  var showAll = false, shown = null, hi = -1;
  var host = H("div");
  el.appendChild(host);
  var ctl = row(), svgBox = H("div"), info = noteBox();
  host.appendChild(ctl);
  host.appendChild(svgBox);
  host.appendChild(info);
  var CW = 62, CH = 56, GRAY1 = [0, 1], GRAY2 = [0, 1, 3, 2];

  function geom() {
    var rb = n === 4 ? 2 : 1, cb = n - rb;
    return {rb: rb, cb: cb, nr: 1 << rb, nc: 1 << cb,
      rg: rb === 2 ? GRAY2 : GRAY1,
      cg: cb === 2 ? GRAY2 : GRAY1};
  }
  function cellMin(g, r, c) { return (g.rg[r] << g.cb) | g.cg[c]; }
  function arcOf(N, idx) {
    if (idx.length === N) return {s: 0, l: N};
    for (var a = 0; a < idx.length; a++) {
      var s = idx[a], ok = true;
      for (var k = 0; k < idx.length; k++) {
        if (idx.indexOf((s + k) % N) < 0) { ok = false; break; }
      }
      if (ok) return {s: s, l: idx.length};
    }
    return {s: idx[0], l: idx.length};
  }
  function segs(N, a) {
    if (a.s + a.l <= N) return [{s: a.s, l: a.l, o1: false, o2: false}];
    return [
      {s: a.s, l: N-a.s, o1: false, o2: true},
      {s: 0, l: a.s+a.l-N, o1: true, o2: false}
    ];
  }
  function bits(imp, g) {
    var cm = (1 << g.cb) - 1;
    return {rv: imp.v >> g.cb, rm: imp.m >> g.cb,
      cv: imp.v & cm, cm: imp.m & cm};
  }
  function drawLoop(svg, imp, g, x0, y0, inset, color, w, dash) {
    var b = bits(imp, g), ri = [], ci = [];
    for (var r = 0; r < g.nr; r++) {
      if ((g.rg[r] & ~b.rm) === b.rv) ri.push(r);
    }
    for (var c = 0; c < g.nc; c++) {
      if ((g.cg[c] & ~b.cm) === b.cv) ci.push(c);
    }
    if (!ri.length || !ci.length) return;
    var rs = segs(g.nr, arcOf(g.nr, ri));
    var cs = segs(g.nc, arcOf(g.nc, ci));
    rs.forEach(function(R) {
      cs.forEach(function(C) {
        var xa = x0+C.s*CW+inset, xb = x0+(C.s+C.l)*CW-inset;
        var ya = y0+R.s*CH+inset, yb = y0+(R.s+R.l)*CH-inset;
        if (!R.o1 && !R.o2 && !C.o1 && !C.o2) {
          svg.appendChild(S("rect", {
            x: xa, y: ya, width: xb-xa, height: yb-ya, rx: 13,
            fill: "none", stroke: color, "stroke-width": w,
            "stroke-dasharray": dash || ""
          }));
        } else {
          var ext = inset + 2;
          var xl = C.o1 ? xa-ext : xa, xr = C.o2 ? xb+ext : xb;
          var yt = R.o1 ? ya-ext : ya, yb2 = R.o2 ? yb+ext : yb;
          function ln(x1, y1, x2, y2) {
            svg.appendChild(S("line", {
              x1: x1, y1: y1, x2: x2, y2: y2,
              stroke: color, "stroke-width": w, "stroke-linecap": "round",
              "stroke-dasharray": dash || ""
            }));
          }
          if (!R.o1) ln(xl, ya, xr, ya);
          if (!R.o2) ln(xl, yb, xr, yb);
          if (!C.o1) ln(xa, yt, xa, yb2);
          if (!C.o2) ln(xb, yt, xb, yb2);
        }
      });
    });
  }

  function solve() {
    var tgt = mode === "sop" ? 1 : 0, ones = [], dcs = [];
    vals.forEach(function(v, i) {
      if (v === 2) dcs.push(i);
      else if (v === tgt) ones.push(i);
    });
    return minimize(n, ones, dcs);
  }

  // 정확 최소화 탐색의 후보 PI가 18개를 초과해 greedy fallback을 썼는지 판별한다.
  function usedGreedy(res) {
    var ones = res.ones;
    if (!ones.length) return false;
    var ess = {};
    ones.forEach(function(o) {
      var coversO = [];
      res.pis.forEach(function(p, i) {
        if (covers(p, o)) coversO.push(i);
      });
      if (coversO.length === 1) ess[coversO[0]] = true;
    });
    var remaining = ones.filter(function(o) {
      return !Object.keys(ess).some(function(i) {
        return covers(res.pis[+i], o);
      });
    });
    var cand = [];
    res.pis.forEach(function(p, i) {
      if (!ess[i] && remaining.some(function(o) { return covers(p, o); })) {
        cand.push(i);
      }
    });
    return remaining.length > 0 && cand.length > 18;
  }

  var cur = null;
  function paint() {
    var g = cur.g, nm = cur.nm, res = cur.res, order = cur.order;
    var W = 96 + g.nc*CW + 30, Hh = 70 + g.nr*CH + 22;
    var x0 = 96, y0 = 62, svg = svgRoot(W, Hh);
    var rowNames = nm.slice(0, g.rb).join("");
    var colNames = nm.slice(g.rb).join("");
    svg.appendChild(S("line", {
      x1: x0-70, y1: y0-46, x2: x0, y2: y0,
      stroke: INK, "stroke-width": 1.2
    }));
    svg.appendChild(S("text", {
      x: x0-8, y: y0-34, "text-anchor": "end",
      "font-size": 13, "font-weight": 700, fill: INK, text: colNames
    }));
    svg.appendChild(S("text", {
      x: x0-66, y: y0-6, "font-size": 13, "font-weight": 700,
      fill: INK, text: rowNames
    }));
    for (var c = 0; c < g.nc; c++) {
      svg.appendChild(S("text", {
        x: x0+c*CW+CW/2, y: y0-10, "text-anchor": "middle",
        "font-size": 13, fill: INK, text: bin(g.cg[c], g.cb)
      }));
    }
    for (var r = 0; r < g.nr; r++) {
      svg.appendChild(S("text", {
        x: x0-10, y: y0+r*CH+CH/2+5, "text-anchor": "end",
        "font-size": 13, fill: INK, text: bin(g.rg[r], g.rb)
      }));
    }
    for (var r2 = 0; r2 < g.nr; r2++) {
      for (var c2 = 0; c2 < g.nc; c2++) {
        var mt = cellMin(g, r2, c2), v = vals[mt];
        var cell = S("g", {});
        cell.appendChild(S("rect", {
          x: x0+c2*CW, y: y0+r2*CH, width: CW, height: CH,
          fill: "#fff", stroke: INK, "stroke-width": 1.2
        }));
        cell.appendChild(S("text", {
          x: x0+c2*CW+CW/2, y: y0+r2*CH+CH/2+8,
          "text-anchor": "middle", "font-size": 24, "font-weight": 700,
          fill: v === 2 ? RED : (v === (mode === "sop" ? 1 : 0) ? INK : INK),
          text: v === 2 ? "X" : String(v)
        }));
        if (showIdx) cell.appendChild(S("text", {
          x: x0+c2*CW+4, y: y0+r2*CH+12, "font-size": 10,
          fill: INK, text: "m" + mt
        }));
        if (editable) {
          cell.style.cursor = "pointer";
          (function(mt) {
            cell.onclick = function() {
              vals[mt] = (vals[mt]+1)%3;
              shown = null;
              render();
            };
          })(mt);
        }
        svg.appendChild(cell);
      }
    }
    if (showAll) res.pis.forEach(function(p, i) {
      if (order.indexOf(i) < 0) drawLoop(svg, p, g, x0, y0, 6, INK, 1.3, "4 3");
    });
    order.forEach(function(pi, k) {
      if (k >= shown) return;
      var epi = res.epi.indexOf(pi) >= 0;
      drawLoop(svg, res.pis[pi], g, x0, y0, 5+(k%3)*3,
        epi ? RED : INK, (pi === hi || k === shown-1) ? 3 : 2, "");
    });
    if (hi >= 0 && hi < res.pis.length && order.indexOf(hi) < 0) {
      drawLoop(svg, res.pis[hi], g, x0, y0, 8, RED, 2, "5 3");
    }
    svgBox.innerHTML = "";
    svgBox.appendChild(svg);
  }

  function render() {
    var g = geom(), nm = varNames(n, names), res = solve();
    var order = res.cover.slice(), greedy = usedGreedy(res);
    if (shown === null || shown > order.length) shown = order.length;
    cur = {g: g, nm: nm, res: res, order: order};
    paint();
    ctl.innerHTML = "";
    if (cfg.vars_select !== false) {
      ctl.appendChild(H("label", {text: "변수 "}, [sel(
        [[2, "2"], [3, "3"], [4, "4"]], n, function(x) {
          var old = vals.slice();
          n = +x;
          reset(n);
          for (var i = 0; i < Math.min(old.length, vals.length); i++) vals[i] = old[i];
          shown = null;
          render();
        }
      )]));
    }
    var bs = btn("SOP (1 묶기)", function() { mode = "sop"; shown = null; render(); });
    var bp = btn("POS (0 묶기)", function() { mode = "pos"; shown = null; render(); });
    (mode === "sop" ? bs : bp).style.cssText += "background:" + INK + ";color:#fff";
    ctl.appendChild(bs);
    ctl.appendChild(bp);
    ctl.appendChild(btn("초기화", function() { reset(n); shown = null; render(); }));
    var ci = H("input", {type: "checkbox", onchange: function() {
      showIdx = this.checked; render();
    }});
    ci.checked = showIdx;
    ctl.appendChild(H("label", {}, [ci, H("span", {text: " m 번호"})]));
    var cb2 = H("input", {type: "checkbox", onchange: function() {
      showAll = this.checked; render();
    }});
    cb2.checked = showAll;
    ctl.appendChild(H("label", {}, [cb2, H("span", {text: " 모든 PI 보기(점선)"})]));
    if (cfg.presets && cfg.presets.length) {
      var po = [["", "예제 불러오기"]];
      cfg.presets.forEach(function(p, i) { po.push([i, p.label]); });
      ctl.appendChild(sel(po, "", function(x) {
        if (x === "") return;
        var p = cfg.presets[+x];
        load(p.vars || n, p.m, p.d);
        shown = null;
        render();
      }));
    }

    var stepRow = row();
    stepRow.appendChild(btn("← 묶음 하나 빼기", function() {
      if (shown > 0) { shown--; render(); }
    }));
    stepRow.appendChild(btn("묶음 하나 추가 →", function() {
      if (shown < order.length) { shown++; render(); }
    }));
    stepRow.appendChild(btn("전부", function() { shown = order.length; render(); }));
    stepRow.appendChild(H("span", {
      text: "묶음 " + shown + " / " + order.length + " (EPI 먼저, 빨간 실선)"
    }));

    var ones = [], dcs = [], zeros = [];
    vals.forEach(function(v, i) {
      if (v === 1) ones.push(i);
      if (v === 2) dcs.push(i);
      if (v === 0) zeros.push(i);
    });
    var h = "<b>F</b> = Σm(" + (ones.join(",") || "없음") + ")" +
      (dcs.length ? " + d(" + dcs.join(",") + ")" : "") + "<br>";
    var target = mode === "sop" ? ones : zeros, expr;
    if (!target.length) expr = mode === "sop" ? "0" : "1";
    else if (shown < order.length) {
      var part = order.slice(0, shown);
      expr = part.length ? exprFromCover(res, n, nm, mode === "pos", part) : "";
      expr = expr ? (mode === "sop" ? expr + " + …" : expr + " …") : "…";
    } else expr = exprFromCover(res, n, nm, mode === "pos");
    var heading = greedy
      ? "간단화 결과(최소 보장 안 됨)"
      : (mode === "sop" ? "최소 SOP" : "최소 POS");
    h += "<b>" + heading + "</b>: F = <span style='color:" + RED +
      ";font-weight:700;font-size:15px'>" + expr + "</span>";
    if (!greedy && res.ones.length && res.alt > 1) {
      h += "<br><span style='color:" + INK + "'>최소해 " + res.alt +
        "개가 있음 (같은 항 수·리터럴 수).</span>";
    }
    h += "<br><span style='color:" + INK + "'>" +
      (mode === "sop"
        ? "1과 X를 묶어 곱항을 만든다."
        : "0과 X를 묶어 F′의 곱항을 구한 뒤 De Morgan으로 POS를 만든다.") +
      " X는 묶음에 도움이 될 때만 쓴다.</span>";

    if (res.pis.length) {
      h += "<table style='margin-top:8px'><tr><th>PI</th><th>항</th><th>덮는 minterm</th><th>역할</th></tr>";
      res.pis.forEach(function(p, i) {
        var cv = res.ones.filter(function(o) { return covers(p, o); });
        var ei = res.epi.indexOf(i), role;
        if (ei >= 0) {
          var only = res.ones.filter(function(o) {
            var c = 0;
            res.pis.forEach(function(q) { if (covers(q, o)) c++; });
            return covers(p, o) && c === 1;
          });
          role = "<b style='color:" + RED + "'>EPI</b> (" + only.join(",") + " 전용)";
        } else role = order.indexOf(i) >= 0 ? "선택된 PI" : "선택 안 됨";
        var term = mode === "sop" ? termSOP(p, n, nm) : termPOS(p, n, nm);
        h += "<tr data-pi='" + i + "'><td>" + (i+1) + "</td><td>" +
          term + "</td><td>" + cv.join(", ") + "</td><td>" + role + "</td></tr>";
      });
      h += "</table>";
    }
    info.innerHTML = "";
    info.appendChild(stepRow);
    var d = H("div", {html: h});
    info.appendChild(d);
    d.querySelectorAll("tr[data-pi]").forEach(function(tr) {
      var i = +tr.getAttribute("data-pi");
      tr.onmouseenter = function() { hi = i; paint(); };
      tr.onmouseleave = function() { hi = -1; paint(); };
    });
    if (cfg.note) info.appendChild(H("div", {
      html: cfg.note, style: "margin-top:6px;color:" + INK
    }));
  }
  render();
});

/* ================= FSM player ================= */
/* cfg: {title,type:"moore"|"mealy",w,h,init:"S0",
   states:[{id,x,y,out?}], edges:[{from,to,in:"0,1"|"*",out?,loop:"up|down|left|right",bend:number}],
   input:"1011011", note} */
reg("fsm-player", function(el, cfg) {
  V6.title(el, cfg.title || "FSM 상태 전이 재생");
  cfg = cfg || {};
  var states = Array.isArray(cfg.states) ? cfg.states : [];
  var W = cfg.w || 720, Hh = cfg.h || 300, R = 26;
  var moore = cfg.type !== "mealy", st = {};
  states.forEach(function(s) { st[s.id] = s; });
  var init = cfg.init || (states[0] && states[0].id);
  var svgBox = H("div"), ctl = row(), info = noteBox();
  var inRow = row();
  el.appendChild(svgBox);
  el.appendChild(inRow);
  el.appendChild(ctl);
  el.appendChild(info);

  if (!states.length || !st[init]) {
    info.textContent = "FSM 설정 오류: 초기 상태가 상태 목록에 없습니다. init과 states의 ID를 확인하세요.";
    return;
  }
  if (!Array.isArray(cfg.edges)) {
    info.textContent = "FSM 설정 오류: edges 전이 목록이 필요합니다.";
    return;
  }
  var edges = cfg.edges.map(function(e) {
    return {
      from: e.from, to: e.to,
      ins: String(e.in).split(",").map(function(x) { return x.trim(); }),
      inLabel: String(e.in), out: e.out,
      loop: e.loop || "up", bend: e.bend
    };
  });
  for (var ei = 0; ei < edges.length; ei++) {
    if (!st[edges[ei].from] || !st[edges[ei].to]) {
      info.textContent = "FSM 설정 오류: 정의되지 않은 상태를 참조하는 전이가 있습니다.";
      return;
    }
  }

  function find(state, sym) {
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (e.from !== state) continue;
      if (e.ins.indexOf(sym) >= 0 || e.ins.indexOf("*") >= 0) return i;
    }
    return -1;
  }

  var input = cfg.input || "", trace = [], pos = 0, timer = null;
  var inBox = txt(input, 170, function(v) {
    stop();
    input = v.replace(/[^01A-Za-z]/g, "");
    inBox.value = input;
    pos = 0;
    simulate();
    draw();
  }, "입력 열");
  inRow.appendChild(H("label", {text: "입력 열 "}, [inBox]));
  inRow.appendChild(H("span", {
    text: moore
      ? "Moore: 출력은 상태에 부착됨"
      : "Mealy: 출력은 전이에 부착됨",
    style: "color:" + INK
  }));

  function simulate() {
    trace = [{
      state: init, edge: -1, sym: "",
      out: moore ? st[init].out : undefined
    }];
    for (var i = 0; i < input.length; i++) {
      var cur = trace[trace.length-1].state;
      var sym = input.charAt(i), ei = find(cur, sym);
      if (ei < 0) {
        trace.push({state: cur, edge: -1, sym: sym, out: "", halt: true});
        break;
      }
      var e = edges[ei], ns = e.to;
      trace.push({
        state: ns, edge: ei, sym: sym,
        out: moore ? st[ns].out : e.out
      });
    }
    if (pos > trace.length-1) pos = trace.length-1;
  }

  function geom(e) {
    var a = st[e.from], b = st[e.to];
    if (e.from === e.to) {
      var dir = {up: [0,-1], down: [0,1], left: [-1,0], right: [1,0]}[e.loop] || [0,-1];
      var nx = -dir[1], ny = dir[0];
      var cx = a.x + dir[0]*R, cy = a.y + dir[1]*R;
      var p1 = {x: cx+nx*14, y: cy+ny*14};
      var p2 = {x: cx-nx*14, y: cy-ny*14};
      var c1 = {x: cx+dir[0]*34+nx*26, y: cy+dir[1]*34+ny*26};
      var c2 = {x: cx+dir[0]*34-nx*26, y: cy+dir[1]*34-ny*26};
      return {
        d: "M"+p1.x+" "+p1.y+" C"+c1.x+" "+c1.y+" "+c2.x+" "+c2.y+" "+p2.x+" "+p2.y,
        lx: cx+dir[0]*40, ly: cy+dir[1]*40+(dir[1]?0:4),
        anchor: dir[0]<0 ? "end" : dir[0]>0 ? "start" : "middle",
        end: p2, from: c2
      };
    }
    var dx = b.x-a.x, dy = b.y-a.y, len = Math.sqrt(dx*dx+dy*dy) || 1;
    var ux = dx/len, uy = dy/len;
    var rev = edges.some(function(o) { return o.from===e.to && o.to===e.from; });
    var bend = e.bend !== undefined ? e.bend : (rev ? 30 : 0);
    var mx = (a.x+b.x)/2-uy*bend, my = (a.y+b.y)/2+ux*bend;
    var q = {x: mx, y: my};
    function trim(p, from) {
      var vx = q.x-p.x, vy = q.y-p.y, l = Math.sqrt(vx*vx+vy*vy) || 1;
      if (bend === 0) { vx = (from ? 1 : -1)*dx; vy = (from ? 1 : -1)*dy; l = len; }
      return {x: p.x+vx/l*R, y: p.y+vy/l*R};
    }
    var p1 = trim(a, true), p2 = trim(b, false);
    var cxp = bend===0 ? q.x : 2*q.x-(p1.x+p2.x)/2;
    var cyp = bend===0 ? q.y : 2*q.y-(p1.y+p2.y)/2;
    var lx = (p1.x+2*cxp+p2.x)/4, ly = (p1.y+2*cyp+p2.y)/4;
    var ox = bend===0 ? uy*12 :
      (mx-(a.x+b.x)/2)/Math.max(1,Math.abs(bend))*12;
    var oy = bend===0 ? -ux*12 :
      (my-(a.y+b.y)/2)/Math.max(1,Math.abs(bend))*12;
    if (bend===0 && oy>0) { ox=-ox; oy=-oy; }
    return {
      d: "M"+p1.x+" "+p1.y+" Q"+cxp+" "+cyp+" "+p2.x+" "+p2.y,
      lx: lx+ox, ly: ly+oy+4, anchor: "middle",
      end: p2, from: {x: cxp, y: cyp}
    };
  }

  function draw() {
    var cur = trace[pos], svg = svgRoot(W, Hh);
    var defs = S("defs");
    [["a", INK], ["r", RED]].forEach(function(m) {
      defs.appendChild(S("marker", {
        id: "fsm-arr-" + m[0] + uid, viewBox: "0 0 10 10",
        refX: 9, refY: 5, markerWidth: 7, markerHeight: 7,
        orient: "auto-start-reverse"
      }, [S("path", {d: "M0 0 L10 5 L0 10 z", fill: m[1]})]));
    });
    svg.appendChild(defs);
    edges.forEach(function(e, i) {
      var g = geom(e), on = i === cur.edge;
      svg.appendChild(S("path", {
        d: g.d, fill: "none", stroke: on ? RED : INK,
        "stroke-width": on ? 3 : 1.4,
        "marker-end": "url(#fsm-arr-" + (on ? "r" : "a") + uid + ")"
      }));
      var label = moore ? e.inLabel : e.inLabel + "/" + (e.out === undefined ? "" : e.out);
      svg.appendChild(S("text", {
        x: g.lx, y: g.ly, "text-anchor": g.anchor,
        "font-size": 13, "font-weight": on ? 700 : 400,
        fill: on ? RED : INK, text: label
      }));
    });
    var initState = st[init];
    svg.appendChild(S("line", {
      x1: initState.x-R-34, y1: initState.y,
      x2: initState.x-R-2, y2: initState.y,
      stroke: INK, "stroke-width": 1.4,
      "marker-end": "url(#fsm-arr-a" + uid + ")"
    }));
    states.forEach(function(s) {
      var now = s.id === cur.state;
      svg.appendChild(S("circle", {
        cx: s.x, cy: s.y, r: R,
        fill: "#fff", stroke: now ? RED : INK,
        "stroke-width": now ? 3 : 1.5
      }));
      if (s.final) svg.appendChild(S("circle", {
        cx: s.x, cy: s.y, r: R-4, fill: "none",
        stroke: INK, "stroke-width": 1.2
      }));
      var t = moore && s.out !== undefined ? s.id + "/" + s.out : s.id;
      svg.appendChild(S("text", {
        x: s.x, y: s.y+5, "text-anchor": "middle",
        "font-size": 13, "font-weight": 700,
        fill: now ? RED : INK, text: t
      }));
    });
    svgBox.innerHTML = "";
    svgBox.appendChild(svg);

    ctl.innerHTML = "";
    function go(p) { pos = Math.max(0, Math.min(trace.length-1, p)); stop(); draw(); }
    ctl.appendChild(btn("처음", function() { go(0); }));
    ctl.appendChild(btn("이전", function() { go(pos-1); }));
    ctl.appendChild(btn("다음", function() { go(pos+1); }));
    ctl.appendChild(btn(timer ? "멈춤" : "자동 재생", function() {
      if (timer) { stop(); draw(); return; }
      if (pos >= trace.length-1) pos = 0;
      timer = setInterval(function() {
        if (pos < trace.length-1) { pos++; draw(); }
        else { stop(); draw(); }
      }, cfg.speed || 900);
      draw();
    }));
    ctl.appendChild(H("span", {text: "t = " + pos + " / " + (trace.length-1)}));

    var h = "<table><tr><th>t</th><th>입력</th><th>현재 상태</th><th>다음 상태</th><th>출력</th></tr>";
    for (var i = 1; i < trace.length; i++) {
      var tr = trace[i], prev = trace[i-1], sty = i<=pos ? "" : "color:" + INK;
      h += tr.halt
        ? "<tr><td>"+(i-1)+"</td><td>"+tr.sym+"</td><td>"+prev.state+
          "</td><td colspan='2'>전이 없음 → 정지</td></tr>"
        : "<tr><td>"+(i-1)+"</td><td>"+tr.sym+"</td><td>"+prev.state+
          "</td><td>"+tr.state+"</td><td>"+(tr.out===undefined?"":tr.out)+"</td></tr>";
    }
    h += "</table>";
    var outs = "";
    for (var k = moore ? 0 : 1; k <= pos; k++) {
      if (trace[k].out !== undefined && !trace[k].halt) outs += trace[k].out;
    }
    h += "<div style='margin-top:6px'>출력열: <b style='color:" + RED +
      "'>" + (outs || "—") + "</b></div>";
    if (cfg.note) h += "<div style='margin-top:4px;color:" + INK + "'>" + cfg.note + "</div>";
    info.innerHTML = h;
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  var uid = Math.floor(Math.random() * 1e6);
  simulate();
  draw();
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
reg("timing-diagram", function(el, cfg) {
  V6.title(el, cfg.title || "타이밍 다이어그램 (게이트 지연)");
  var names = cfg.circuits || Object.keys(TD_PRESETS);
  var key = cfg.circuit && TD_PRESETS[cfg.circuit]
    ? cfg.circuit : (cfg.netlist ? "custom" : names[0]);
  var circ, inputs, delays, inertial = cfg.inertial === true;
  var DT = 0.25;

  function load(k) {
    var p = k === "custom"
      ? {label: cfg.title || "custom", T: cfg.T || 24,
         gates: cfg.netlist, inputs: cfg.inputs, out: cfg.out, note: cfg.note}
      : TD_PRESETS[k];
    if (!p || !Array.isArray(p.gates) || !p.inputs ||
        !p.out || !p.inputs[p.out] && !p.gates.some(function(g) {
          return g.out === p.out;
        })) {
      throw new Error("회로 설정 또는 출력 신호가 올바르지 않습니다.");
    }
    var known = {};
    Object.keys(p.inputs).forEach(function(n) { known[n] = true; });
    p.gates.forEach(function(g) {
      if (!GATE_FN[g.op] || !Array.isArray(g.in) ||
          g.in.some(function(n) { return !known[n]; })) {
        throw new Error("게이트 입력이 정의되지 않았거나 위상 순서가 올바르지 않습니다.");
      }
      known[g.out] = true;
    });
    // 프리셋과 사용자 netlist 모두 게이트는 위상 정렬 순서로 제공해야 한다.
    circ = p;
    DT = p.dt || 0.25;
    inputs = {};
    Object.keys(p.inputs).forEach(function(n) {
      inputs[n] = {init: p.inputs[n].init, edges: p.inputs[n].edges.slice()};
    });
    delays = p.gates.map(function(g) { return g.d; });
    key = k;
  }

  try { load(key); }
  catch (e) {
    el.appendChild(H("div", {
      text: e.message,
      style: "color:" + RED + ";font-size:13px"
    }));
    return;
  }

  var host = H("div");
  el.appendChild(host);
  var ctl = row(), box = H("div"), dly = row(), info = noteBox();
  host.appendChild(ctl);
  host.appendChild(box);
  host.appendChild(dly);
  host.appendChild(info);

  function inWave(inp, N) {
    var a = [], v = inp.init, e = inp.edges.slice().sort(function(x, y) {
      return x - y;
    }), j = 0;
    for (var k = 0; k <= N; k++) {
      var t = k * DT;
      while (j < e.length && e[j] <= t + 1e-9) {
        v ^= 1;
        j++;
      }
      a.push(v);
    }
    return a;
  }

  function runSim(zero) {
    var N = Math.round(circ.T / DT), w = {};
    Object.keys(inputs).forEach(function(n) {
      w[n] = inWave(inputs[n], N);
    });

    circ.gates.forEach(function(g, gi) {
      var raw = [], ins = g.in.map(function(n) { return w[n]; });
      for (var k = 0; k <= N; k++) {
        raw.push(GATE_FN[g.op](ins.map(function(a) { return a[k]; })));
      }

      var dk = zero ? 0 : Math.max(0, Math.round(delays[gi] / DT));
      var out = raw.slice();

      if (dk > 0 && inertial) {
        // Discrete inertial model: a changed level is accepted only if it
        // persists for at least the gate delay. Short interior pulses vanish.
        out = new Array(N + 1).fill(raw[0]);
        var start = 0, runs = [];
        for (var r = 1; r <= N + 1; r++) {
          if (r === N + 1 || raw[r] !== raw[start]) {
            runs.push({s: start, e: r - 1, v: raw[start]});
            start = r;
          }
        }
        var level = raw[0];
        for (var ri = 1; ri < runs.length; ri++) {
          var run = runs[ri];
          var len = run.e - run.s + 1;
          if (len >= dk) {
            var changeAt = Math.min(N + 1, run.s + dk);
            for (var q = changeAt; q <= N; q++) out[q] = run.v;
            level = run.v;
          }
        }
        // Fill samples before accepted transitions with the previous level.
        level = raw[0];
        var accepted = [];
        for (var ar = 1; ar < runs.length; ar++) {
          var rr = runs[ar];
          if (rr.e - rr.s + 1 >= dk) {
            accepted.push({t: rr.s + dk, v: rr.v});
          }
        }
        for (var oi = 0; oi <= N; oi++) {
          while (accepted.length && accepted[0].t <= oi) {
            level = accepted.shift().v;
          }
          out[oi] = level;
        }
      } else if (dk > 0) {
        // Transport delay: every input-derived transition is delayed.
        for (var j = 0; j <= N; j++) {
          out[j] = raw[Math.max(0, j - dk)];
        }
      }
      w[g.out] = out;
    });
    return w;
  }

  function trans(a) {
    var t = [];
    for (var k = 1; k < a.length; k++) {
      if (a[k] !== a[k - 1]) t.push(k * DT);
    }
    return t;
  }

  function shortGlitches(actual, ideal, maxD) {
    var found = [], N = actual.length - 1, start = 0;
    for (var k = 1; k <= N + 1; k++) {
      if (k === N + 1 || actual[k] !== actual[start]) {
        var end = k - 1, width = (end - start + 1) * DT;
        // A pulse must be an interior run bracketed by the same level.
        if (start > 0 && end < N &&
            actual[start - 1] === actual[end + 1] &&
            actual[start] !== actual[start - 1] &&
            width < maxD) {
          var matchesIdeal = true;
          for (var q = start; q <= end; q++) {
            if (ideal[q] !== actual[start - 1]) {
              matchesIdeal = false;
              break;
            }
          }
          if (matchesIdeal) found.push({s: start, e: end, width: width});
        }
        start = k;
      }
    }
    return found;
  }

  function draw() {
    var w = runSim(false), wi = runSim(true), N = Math.round(circ.T / DT);
    var sigs = Object.keys(inputs).concat(circ.gates.map(function(g) {
      return g.out;
    }));
    var outName = circ.out, RH = 36, L = 70, Wd = 720, R = 14, top = 26;
    var sx = (Wd - L - R) / circ.T;
    var Hh = top + (sigs.length + 1) * RH + 18;
    var svg = svgRoot(Wd, Hh);
    var gridStep = circ.grid || (circ.T > 30 ? 5 : 2);
    var gateByOut = {};
    circ.gates.forEach(function(g, i) {
      gateByOut[g.out] = {gate: g, delay: delays[i]};
    });
    
    var pathMemo = {};
    function pathDelay(signal, visiting) {
      if (pathMemo[signal] !== undefined) return pathMemo[signal];
    
      var node = gateByOut[signal];
      if (!node) return 0;
    
      // 순환 netlist는 이 모델에서 지원하지 않는다.
      if (visiting[signal]) {
        throw new Error("순환 netlist는 지원하지 않습니다.");
      }
    
      var nextVisiting = Object.assign({}, visiting);
      nextVisiting[signal] = true;
    
      var upstream = 0;
      node.gate.in.forEach(function(src) {
        upstream = Math.max(upstream, pathDelay(src, nextVisiting));
      });
    
      pathMemo[signal] = upstream + node.delay;
      return pathMemo[signal];
    }
    
    var maxD = pathDelay(circ.out, {});
    var glitches = shortGlitches(w[outName], wi[outName], maxD);
    var glitchAt = {};
    glitches.forEach(function(g) {
      for (var k = g.s; k <= g.e; k++) glitchAt[k] = true;
    });

    for (var t = 0; t <= circ.T + 1e-9; t += gridStep) {
      svg.appendChild(S("line", {
        x1: L + t * sx, y1: top - 6, x2: L + t * sx, y2: Hh - 14,
        stroke: GRID, "stroke-width": 1
      }));
      svg.appendChild(S("text", {
        x: L + t * sx, y: top - 10, "text-anchor": "middle",
        "font-size": 10, fill: MUTE, text: String(t)
      }));
    }
    svg.appendChild(S("text", {
      x: Wd - R, y: Hh - 3, "text-anchor": "end",
      "font-size": 10, fill: MUTE, text: "t (ns)"
    }));

    function wave(a, y0, color, wd, dash) {
      var hi = y0 + 6, lo = y0 + RH - 14, p = "", prev = null;
      for (var k = 0; k <= N; k++) {
        var y = a[k] ? hi : lo, x = L + k * DT * sx;
        if (prev === null) p += "M" + x + " " + y;
        else if (y !== prev) p += " L" + x + " " + prev + " L" + x + " " + y;
        prev = y;
      }
      p += " L" + (L + N * DT * sx) + " " + prev;
      svg.appendChild(S("path", {
        d: p, fill: "none", stroke: color, "stroke-width": wd,
        "stroke-dasharray": dash || "", "stroke-linejoin": "round"
      }));
    }

    sigs.forEach(function(n, i) {
      var y0 = top + i * RH, isIn = !!inputs[n], isOut = n === outName;
      svg.appendChild(S("text", {
        x: L - 8, y: y0 + RH / 2 + 1, "text-anchor": "end",
        "font-size": 13, "font-weight": isOut ? 700 : 400,
        fill: isOut ? RED : INK, text: n
      }));

      if (isOut) {
        glitches.forEach(function(g) {
          svg.appendChild(S("rect", {
            x: L + g.s * DT * sx, y: y0,
            width: Math.max(1, g.width * sx), height: RH - 6,
            fill: RED, opacity: 0.18
          }));
        });
      }
      wave(w[n], y0, isOut ? RED : INK, isOut ? 2.4 : 1.6);

      if (isIn) {
        var hit = S("rect", {
          x: L, y: y0, width: circ.T * sx, height: RH - 4,
          fill: "#fff", "fill-opacity": 0, style: "cursor:crosshair"
        });
        hit.onclick = function(ev) {
          var rect = svg.getBoundingClientRect(), scale = Wd / rect.width;
          var t = ((ev.clientX - rect.left) * scale - L) / sx;
          var sn = circ.snap || 0.5;
          t = Math.round(t / sn) * sn;
          if (t <= 0 || t >= circ.T) return;
          var ed = inputs[n].edges, idx = ed.indexOf(t);
          if (idx >= 0) ed.splice(idx, 1);
          else ed.push(t);
          draw();
        };
        svg.appendChild(hit);
      }
    });

    var yi = top + sigs.length * RH;
    svg.appendChild(S("text", {
      x: L - 8, y: yi + RH / 2 + 1, "text-anchor": "end",
      "font-size": 11, fill: MUTE, text: outName + " (ideal)"
    }));
    wave(wi[outName], yi, MUTE, 1.4, "5 4");
    box.innerHTML = "";
    box.appendChild(svg);

    dly.innerHTML = "";
    circ.gates.forEach(function(g, gi) {
      var lab = H("label", {text: g.out + " (" + g.op.toUpperCase() + ") "});
      var r = H("input", {
        type: "range", min: 0, max: circ.dmax || 4,
        step: circ.dstep || 0.25, value: delays[gi]
      });
      var v = H("span", {
        "class": "v6-val", text: delays[gi].toFixed(circ.dmax ? 1 : 2) + " ns"
      });
      r.oninput = function() {
        delays[gi] = parseFloat(r.value);
        draw();
      };
      lab.appendChild(r);
      lab.appendChild(v);
      dly.appendChild(lab);
    });

    var h = glitches.length
      ? "<b style='color:" + RED + "'>짧은 글리치 검출</b>: 출력에 이상적 출력과 다른 내부 펄스 " +
        glitches.length + "개가 있으며, 각 펄스 폭은 최대 경로 지연 " +
        maxD.toFixed(2) + " ns보다 짧습니다.<br>"
      : "출력에서 최대 경로 지연보다 짧고 이상적 출력과 다른 내부 펄스가 검출되지 않았습니다.<br>";
    h += "<span style='color:" + MUTE + "'>입력 파형을 클릭하면 해당 시각(" +
      (circ.snap || 0.5) + " ns 단위)에 에지가 추가/제거됩니다. 점선은 지연 0의 이상적 출력입니다. " +
      (inertial
        ? "관성 지연 모델은 지연보다 짧게 지속되는 입력 유도 펄스를 제거합니다."
        : "전달 지연 모델은 각 전이를 설정된 지연만큼 이동시킵니다.") +
      " 시간 격자(DT)를 쓰는 이산 시뮬레이션이라 지연이 DT의 정수배가 아니면 가까운 격자로 반올림됩니다.</span>";
    if (circ.note) h += "<br><span style='color:" + MUTE + "'>" + circ.note + "</span>";
    info.innerHTML = h;

    ctl.innerHTML = "";
    if (!cfg.netlist || cfg.circuits) {
      var opts = names.filter(function(k) { return !!TD_PRESETS[k]; })
        .map(function(k) { return [k, TD_PRESETS[k].label]; });
      if (cfg.netlist) opts.push(["custom", cfg.title || "custom"]);
      if (opts.length > 1) ctl.appendChild(sel(opts, key, function(k) {
        try { load(k); draw(); }
        catch (e) { info.textContent = e.message; }
      }));
    }
    var cb = H("input", {
      type: "checkbox",
      onchange: function() { inertial = this.checked; draw(); }
    });
    cb.checked = inertial;
    ctl.appendChild(H("label", {}, [
      cb, H("span", {text: " inertial delay (펄스 폭 < 게이트 지연이면 제거)"})
    ]));
    ctl.appendChild(btn("초기화", function() {
      try { load(key); draw(); }
      catch (e) { info.textContent = e.message; }
    }));
  }
  draw();
});

/* ================= ff-timing: setup / hold / skew ================= */
/* cfg: {title, params:{Tcq,CLmax,CLmin,Tsu,Th,Tperiod,Tskew}} (ns) */
reg("ff-timing", function(el, cfg) {
  V6.title(el, cfg.title || "Setup / Hold / Clock skew");
  var P = Object.assign({
    Tcq: 2, CLmax: 5, CLmin: 1, Tsu: 1, Th: 1, Tperiod: 8, Tskew: 0
  }, cfg.params || {});
  var spec = {
    Tcq: [0.5, 4, 0.25, "T_cq"],
    CLmax: [0, 10, 0.25, "CL max"],
    CLmin: [0, 6, 0.25, "CL min"],
    Tsu: [0, 3, 0.25, "T_su"],
    Th: [0, 3, 0.25, "T_h"],
    Tperiod: [3, 16, 0.25, "T_period"],
    Tskew: [-3, 3, 0.25, "T_skew"]
  };
  var box = H("div"), ctl = row(), info = noteBox();
  el.appendChild(box);
  el.appendChild(ctl);
  el.appendChild(info);
  var uid = Math.floor(Math.random() * 1e6);

  function draw() {
    P.CLmin = Math.min(P.CLmin, P.CLmax);
    var Tpmax = P.Tcq + P.CLmax;
    var Tpmin = P.Tcq + P.CLmin;
    var Pd = P.Tperiod, sk = P.Tskew;
    var setupSlack = Pd - P.Tsu + sk - Tpmax;
    var holdSlack = Tpmin - sk - P.Th;
    var tmin = Math.min(-2.5, sk - P.Th - 1);
    var tmax = Math.max(Pd + Math.max(0, sk) + 3.5, Tpmax + 3);
    var Wd = 720, L = 84, Rr = 14;
    var sx = (Wd - L - Rr) / (tmax - tmin);
    var X = function(t) { return L + (t - tmin) * sx; };
    var RH = 52, top = 30, Hh = top + 3 * RH + 36;
    var svg = svgRoot(Wd, Hh);
    var defs = S("defs", {}, [
      S("pattern", {
        id: "ffh" + uid, width: 6, height: 6,
        patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)"
      }, [S("line", {
        x1: 0, y1: 0, x2: 0, y2: 6,
        stroke: INK, "stroke-width": 1
      })])
    ]);
    svg.appendChild(defs);

    for (var t = Math.ceil(tmin); t <= tmax; t++) {
      svg.appendChild(S("line", {
        x1: X(t), y1: top-4, x2: X(t), y2: Hh-24,
        stroke: GRID, "stroke-width": 1
      }));
      if (t % 2 === 0) svg.appendChild(S("text", {
        x: X(t), y: top-9, "text-anchor": "middle",
        "font-size": 10, fill: INK, text: String(t)
      }));
    }
    svg.appendChild(S("text", {
      x: Wd-Rr, y: Hh-6, "text-anchor": "end",
      "font-size": 10, fill: INK, text: "t (ns)"
    }));

    function lab(y, txt) {
      svg.appendChild(S("text", {
        x: L-8, y: y+RH/2, "text-anchor": "end",
        "font-size": 12, "font-weight": 700, fill: INK, text: txt
      }));
    }
    function clock(y0, off, lbl) {
      var hi = y0+8, lo = y0+RH-14, half = Pd/2, d = "";
      var first = Math.floor((tmin-off)/Pd)-1;
      var pts = [];
      for (var k = first; k * Pd + off < tmax + Pd; k++) {
        var rise = off + k*Pd;
        pts.push([rise, 1], [rise+half, 0]);
      }
      var lastY = lo;
      d = "M" + X(tmin) + " " + lo;
      pts.forEach(function(pt) {
        if (pt[0] < tmin) { lastY = pt[1] ? hi : lo; return; }
        if (pt[0] > tmax) return;
        var x = X(pt[0]), y = pt[1] ? hi : lo;
        d += " L" + x + " " + lastY + " L" + x + " " + y;
        lastY = y;
      });
      d += " L" + X(tmax) + " " + lastY;
      svg.appendChild(S("path", {
        d: d, fill: "none", stroke: INK, "stroke-width": 1.8,
        "clip-path": "url(#ffc" + uid + ")"
      }));
      lab(y0, lbl);
    }
    svg.appendChild(S("defs", {}, [
      S("clipPath", {id: "ffc" + uid}, [
        S("rect", {x: L, y: 0, width: Wd-L-Rr, height: Hh})
      ])
    ]));
    clock(top, 0, "CLK A");
    clock(top+RH, sk, "CLK B");

    function vline(t, y1, y2, color, dash) {
      svg.appendChild(S("line", {
        x1: X(t), y1: y1, x2: X(t), y2: y2,
        stroke: color, "stroke-width": 1.3, "stroke-dasharray": dash || ""
      }));
    }
    // Setup/hold windows remain entirely in the CLK B row.
    function box2(t1, t2, y, label) {
      var xa = Math.max(L, Math.min(X(t1), X(t2)));
      var xb = Math.min(Wd-Rr, Math.max(X(t1), X(t2)));
      if (xb <= xa) return;
      svg.appendChild(S("rect", {
        x: xa, y: y+3, width: Math.max(1, xb-xa), height: RH-8,
        fill: "#fff", "fill-opacity": 0, stroke: RED,
        "stroke-width": 1.4, "stroke-dasharray": "4 3"
      }));
      svg.appendChild(S("text", {
        x: (xa+xb)/2, y: y+RH-2, "text-anchor": "middle",
        "font-size": 10, fill: RED, text: label
      }));
    }
    var yD = top+2*RH, yB = top+RH;
    box2(Pd+sk-P.Tsu, Pd+sk, yB, "T_su");
    box2(sk, sk+P.Th, yB, "T_h");

    var hi = yD+8, lo = yD+RH-14;
    var xa = X(Tpmin), xb = X(Tpmax);
    svg.appendChild(S("line", {
      x1: X(tmin), y1: hi, x2: xa, y2: hi,
      stroke: INK, "stroke-width": 1.8
    }));
    if (xb > xa) {
      svg.appendChild(S("rect", {
        x: xa, y: hi, width: xb-xa, height: lo-hi,
        fill: "url(#ffh" + uid + ")", stroke: "none", opacity: 0.45
      }));
      svg.appendChild(S("path", {
        d: "M"+xa+" "+hi+" L"+xb+" "+lo+" M"+xa+" "+lo+" L"+xb+" "+hi,
        fill: "none", stroke: INK, "stroke-width": 1.2
      }));
    }
    svg.appendChild(S("line", {
      x1: X(Tpmax), y1: hi, x2: X(Tpmax), y2: lo,
      stroke: INK, "stroke-width": 1.2
    }));
    svg.appendChild(S("line", {
      x1: X(Tpmax), y1: lo, x2: X(tmax), y2: lo,
      stroke: INK, "stroke-width": 1.8
    }));
    lab(yD, "D1");
    svg.appendChild(S("text", {
      x: L+4, y: yD+RH-2, "font-size": 10, fill: INK,
      text: "D1 변화 구간: T_p,min ~ T_p,max"
    }));
    vline(0, top-4, yD+RH, INK, "2 3");
    vline(Pd+sk, top-4, yD+RH, INK, "2 3");
    svg.appendChild(S("text", {
      x: X(0)+3, y: Hh-6, "font-size": 10, fill: INK, text: "launch"
    }));
    svg.appendChild(S("text", {
      x: X(Pd+sk)+3, y: Hh-6, "font-size": 10, fill: INK, text: "capture"
    }));
    box.innerHTML = "";
    box.appendChild(svg);

    ctl.innerHTML = "";
    Object.keys(spec).forEach(function(k) {
      var sp = spec[k], lb = H("label", {text: sp[3] + " "});
      var r = H("input", {
        type: "range", min: sp[0], max: sp[1], step: sp[2], value: P[k]
      });
      var v = H("span", {"class": "v6-val", text: P[k] + " ns"});
      r.oninput = function() { P[k] = parseFloat(r.value); draw(); };
      lb.appendChild(r);
      lb.appendChild(v);
      ctl.appendChild(lb);
    });

    var tminPeriod = Tpmax + P.Tsu - sk;
    function ok(x) {
      return x >= 0
        ? "<b>OK</b>"
        : "<b style='color:" + RED + "'>위반</b>";
    }
    info.innerHTML =
      "T<sub>p,max</sub> = T<sub>cq</sub> + CL<sub>max</sub> = " +
      Tpmax.toFixed(2) + " ns, T<sub>p,min</sub> = T<sub>cq</sub> + " +
      "CL<sub>min</sub> = " + Tpmin.toFixed(2) + " ns<br>" +
      "Setup: T<sub>p,max</sub> ≤ T<sub>period</sub> − T<sub>su</sub> + " +
      "T<sub>skew</sub> → 여유 " + setupSlack.toFixed(2) + " ns " +
      ok(setupSlack) + " (최소 주기 " + tminPeriod.toFixed(2) +
      " ns, f<sub>max</sub> ≈ " +
      (tminPeriod > 0 ? (1000/tminPeriod).toFixed(0) : "정의되지 않음") +
      " MHz)<br>" +
      "Hold: T<sub>p,min</sub> ≥ T<sub>skew</sub> + T<sub>h</sub> → 여유 " +
      holdSlack.toFixed(2) + " ns " + ok(holdSlack) +
      (holdSlack < 0
        ? " <span style='color:" + INK + "'>(주기를 늘려도 hold 위반은 해결되지 않음)</span>"
        : "") +
      "<br><span style='color:" + INK + "'>T<sub>skew</sub> = t(clock B) − " +
      "t(clock A). 양수이면 setup에 유리하고 hold에 불리하다. 여유가 0이면 " +
      "해당 제약은 등호로 만족한다.</span>";
  }
  draw();
});

/* ================= gate-playground ================= */
/* cfg: {title, expr:"A'B + AC", presets:["A B + A' C", ...], compare:"", note} */
function buildNet(ast, nand) {
  var nodes = [];

  function mk(op, ins, extra) {
    var n = {id: nodes.length, op: op, ins: ins};
    if (extra) Object.keys(extra).forEach(function(k) { n[k] = extra[k]; });
    nodes.push(n);
    return n.id;
  }

  function inv(id) {
    return nand ? mk("nand", [id, id]) : mk("not", [id]);
  }

  function leaf(a, invert) {
    var id = a.t === "const"
      ? mk("const", [], {v: a.v})
      : mk("leaf", [], {v: a.n});
    return invert ? inv(id) : id;
  }

  function build(a, invert) {
    if (a.t === "var" || a.t === "const") return leaf(a, invert);
    if (a.t === "not") return build(a.k[0], !invert);

    if (a.t === "and") {
      var ai = a.k.map(function(c) { return build(c, false); });
      if (!nand) {
        var ag = mk("and", ai);
        return invert ? mk("not", [ag]) : ag;
      }
      var an = mk("nand", ai);
      return invert ? an : inv(an);
    }

    if (a.t === "or") {
      if (!nand) {
        var oi = a.k.map(function(c) { return build(c, false); });
        var og = mk("or", oi);
        return invert ? mk("not", [og]) : og;
      }
      // OR = NAND(NOT(A), NOT(B), ...)
      // NOT(OR) = NAND(NAND(NOT(A), NOT(B), ...), itself)
      var ni = a.k.map(function(c) { return build(c, true); });
      var ng = mk("nand", ni);
      return invert ? inv(ng) : ng;
    }

    if (a.t === "xor") {
      var cur = build(a.k[0], false);
      for (var i = 1; i < a.k.length; i++) {
        var next = build(a.k[i], false);
        if (nand) {
          var t = mk("nand", [cur, next]);
          var l = mk("nand", [cur, t]);
          var r = mk("nand", [next, t]);
          cur = mk("nand", [l, r]);
        } else {
          cur = mk("xor", [cur, next]);
        }
      }
      return invert ? inv(cur) : cur;
    }
    throw new Error("지원하지 않는 연산: " + a.t);
  }

  return {nodes: nodes, root: build(ast, false)};
}

function netEval(net, env) {
  var val = [];
  net.nodes.forEach(function(n, i) {
    var v;
    if (n.op === "leaf") v = env[n.v] ? 1 : 0;
    else if (n.op === "const") v = n.v;
    else if (n.op === "not") v = val[n.ins[0]] ? 0 : 1;
    else v = GATE_FN[n.op](n.ins.map(function(j) { return val[j]; }));
    val[i] = v;
  });
  return val;
}

reg("gate-playground", function(el, cfg) {
  cfg = cfg || {};
  V6.title(el, cfg.title || "논리 게이트 플레이그라운드");

  var expr = cfg.expr || "AB + A'C", cmp = cfg.compare || "";
  var nandMode = cfg.nand === true, env = {};
  var ctl = row(), inRow = row();
  var err = H("div", {
    style: "color:" + RED + ";font-size:12.5px;min-height:1em"
  });
  var box = H("div"), info = noteBox();

  el.appendChild(inRow);
  el.appendChild(ctl);
  el.appendChild(err);
  el.appendChild(box);
  el.appendChild(info);

  var exprIn = txt(expr, 260, function(v) {
    expr = v;
    render();
  }, "예: AB + A'C");

  inRow.appendChild(H("label", {text: "F = "}, [exprIn]));
  inRow.appendChild(H("span", {
    text: "연산자: ' 또는 ! (NOT), * 또는 인접 (AND), ^ (XOR), + (OR)",
    style: "color:" + INK
  }));

  function render() {
    err.textContent = "";
    var ast, vars;

    try {
      ast = parseExpr(expr);
      vars = astVars(ast);
      if (vars.length > 5) throw new Error("변수는 최대 5개까지");
    } catch (e) {
      err.textContent = "식 오류: " + e.message;
      return;
    }

    // 현재 식에 없는 변수의 상태를 제거한다.
    Object.keys(env).forEach(function(v) {
      if (vars.indexOf(v) < 0) delete env[v];
    });

    vars.forEach(function(v) {
      if (env[v] === undefined) env[v] = 0;
    });

    var net = buildNet(ast, nandMode);
    var val = netEval(net, env);
    var n = vars.length, ROWH = 46, leaves = 0, lvl = [], yy = [];

    (function lay(id) {
      var nd = net.nodes[id];

      if (!nd.ins.length) {
        yy[id] = leaves * ROWH + 46;
        leaves++;
        lvl[id] = 0;
        return;
      }

      var ys = 0, ml = 0;
      nd.ins.forEach(function(c) {
        lay(c);
        ys += yy[c];
        ml = Math.max(ml, lvl[c]);
      });

      yy[id] = nd.op === "not" ? yy[nd.ins[0]] : ys / nd.ins.length;
      lvl[id] = ml + 1;
    })(net.root);

    var maxLvl = Math.max(1, lvl[net.root]);
    var RW = Math.max(n, 1) * 22 + 16;
    var GX = function(l) {
      return RW + 30 + (Math.max(1, l) - 1) * 108;
    };
    var Wd = Math.max(560, GX(maxLvl) + 48 + 90);
    var Hh = Math.max(1, leaves) * ROWH + 66;
    var svg = svgRoot(Wd, Hh), railX = {};

    vars.forEach(function(v, i) {
      railX[v] = 14 + i * 22;
    });

    vars.forEach(function(v) {
      var x = railX[v], on = env[v];
      svg.appendChild(S("line", {
        x1: x, y1: 30, x2: x, y2: Hh - 12,
        stroke: on ? RED : INK,
        "stroke-width": on ? 2.6 : 1.2
      }));

      var g = S("g", {style: "cursor:pointer"});
      g.appendChild(S("rect", {
        x: x - 10, y: 4, width: 20, height: 22, rx: 3,
        fill: on ? RED : "#fff",
        stroke: on ? RED : INK,
        "stroke-width": 1.3
      }));
      g.appendChild(S("text", {
        x: x, y: 19, "text-anchor": "middle", "font-size": 12,
        "font-weight": 700, fill: on ? "#fff" : INK, text: v
      }));
      g.onclick = function() {
        env[v] = env[v] ? 0 : 1;
        render();
      };
      svg.appendChild(g);
    });

    function wireColor(v) {
      return v ? RED : INK;
    }

    function gh(id) {
      return Math.max(38, net.nodes[id].ins.length * 16);
    }

    function pinY(id, k) {
      var nd = net.nodes[id], m = nd.ins.length;
      if (nd.op === "not") return yy[id];
      var h = gh(id);
      return yy[id] - h / 2 + h * (k + 0.5) / m;
    }

    function poly(pts, v) {
      svg.appendChild(S("polyline", {
        points: pts.map(function(p) {
          return p[0] + "," + p[1];
        }).join(" "),
        fill: "none",
        stroke: wireColor(v),
        "stroke-width": v ? 2.6 : 1.3,
        "stroke-linejoin": "round"
      }));
    }

    net.nodes.forEach(function(nd, id) {
      nd.ins.forEach(function(c, k) {
        var cn = net.nodes[c];
        var xin = GX(lvl[id]), py = pinY(id, k);
        var vv = val[c];

        if (!cn.ins.length) {
          var x0 = cn.op === "leaf" ? railX[cn.v] : RW + 2;
          var y0 = yy[c];

          if (cn.op === "const") {
            svg.appendChild(S("text", {
              x: RW - 2, y: y0 + 4, "text-anchor": "end",
              "font-size": 12, "font-weight": 700,
              fill: INK, text: String(cn.v)
            }));
          } else {
            svg.appendChild(S("circle", {
              cx: x0, cy: y0, r: 3.2, fill: wireColor(vv)
            }));
          }

          var xm = xin - 14 - 6 * (k % 3);
          poly([[x0, y0], [xm, y0], [xm, py], [xin, py]], vv);
        } else {
          var xo = GX(lvl[c]) + 52;
          var yo = yy[c];
          var xm2 = xin - 14 - 6 * (k % 3);
          poly([[xo, yo], [xm2, yo], [xm2, py], [xin, py]], vv);
        }
      });
    });

    net.nodes.forEach(function(nd, id) {
      if (!nd.ins.length) return;

      var x = GX(lvl[id]), y = yy[id], h = gh(id), w = 52;
      var out = val[id], op = nd.op;
      var bw = (op === "nand" || op === "nor" || op === "not")
        ? w - 8 : w;
      var common = {fill: "#fff", stroke: INK, "stroke-width": 1.6};
      var shape;

      if (op === "and" || op === "nand") {
        shape = S("path", Object.assign({
          d: "M" + x + " " + (y-h/2) +
             " L" + (x+bw*.5) + " " + (y-h/2) +
             " A" + (bw*.5) + " " + (h/2) + " 0 0 1 " +
             (x+bw*.5) + " " + (y+h/2) +
             " L" + x + " " + (y+h/2) + " Z"
        }, common));
      } else if (op === "or" || op === "nor" || op === "xor") {
        shape = S("path", Object.assign({
          d: "M" + x + " " + (y-h/2) +
             " Q" + (x+bw*.65) + " " + (y-h/2) +
             " " + (x+bw) + " " + y +
             " Q" + (x+bw*.65) + " " + (y+h/2) +
             " " + x + " " + (y+h/2) +
             " Q" + (x+bw*.3) + " " + y +
             " " + x + " " + (y-h/2) + " Z"
        }, common));
      } else {
        shape = S("path", Object.assign({
          d: "M" + x + " " + (y-13) +
             " L" + (x+bw) + " " + y +
             " L" + x + " " + (y+13) + " Z"
        }, common));
      }

      svg.appendChild(shape);

      if (op === "nand" || op === "nor" || op === "not") {
        svg.appendChild(S("circle", {
          cx: x + w - 4, cy: y, r: 4,
          fill: "#fff", stroke: INK, "stroke-width": 1.6
        }));
      }

      if (op === "xor") {
        svg.appendChild(S("path", {
          d: "M" + (x-7) + " " + (y-h/2) +
             " Q" + (x-7+bw*.3) + " " + y +
             " " + (x-7) + " " + (y+h/2),
          fill: "none", stroke: INK, "stroke-width": 1.6
        }));
      }

      var lbl = {
        and: "AND", or: "OR", nand: "NAND", nor: "NOR",
        xor: "XOR", not: ""
      }[op];

      if (lbl) {
        svg.appendChild(S("text", {
          x: x + bw*.46, y: y + 3.5,
          "text-anchor": "middle", "font-size": 9.5,
          fill: INK, text: lbl
        }));
      }

      svg.appendChild(S("text", {
        x: x + w + 4, y: y - 6,
        "font-size": 10, "font-weight": 700,
        fill: out ? RED : INK, text: String(out)
      }));
    });

    // 루트가 게이트가 아닌 리프(상수 또는 변수)인 경우도
    // 음수 X 좌표를 사용하지 않고 해당 리프에서 출력선을 시작한다.
    var ro = net.root, rootNode = net.nodes[ro];
    var yr = yy[ro], ov = val[ro], xr;

    if (!rootNode.ins.length) {
      var rootX = rootNode.op === "leaf"
        ? railX[rootNode.v]
        : RW + 2;

      if (rootNode.op === "const") {
        svg.appendChild(S("text", {
          x: RW - 2, y: yr + 4, "text-anchor": "end",
          "font-size": 12, "font-weight": 700,
          fill: INK, text: String(rootNode.v)
        }));
      } else {
        svg.appendChild(S("circle", {
          cx: rootX, cy: yr, r: 3.2, fill: wireColor(ov)
        }));
      }

      xr = rootX;
    } else {
      xr = GX(lvl[ro]) + 52;
    }

    poly([[xr, yr], [xr + 36, yr]], ov);
    svg.appendChild(S("circle", {
      cx: xr + 46, cy: yr, r: 10,
      fill: ov ? RED : "#fff",
      stroke: ov ? RED : INK, "stroke-width": 1.5
    }));
    svg.appendChild(S("text", {
      x: xr + 46, y: yr + 4, "text-anchor": "middle",
      "font-size": 12, "font-weight": 700,
      fill: ov ? "#fff" : INK, text: String(ov)
    }));
    svg.appendChild(S("text", {
      x: xr + 62, y: yr + 4, "font-size": 13,
      "font-weight": 700, fill: INK, text: "F"
    }));

    box.innerHTML = "";
    box.appendChild(svg);

    var gc = {};
    net.nodes.forEach(function(nd) {
      if (nd.ins.length) gc[nd.op] = (gc[nd.op] || 0) + 1;
    });

    var gcs = Object.keys(gc).map(function(k) {
      return k.toUpperCase() + " " + gc[k];
    }).join(", ") || "게이트 없음";

    var tt = truthTable(ast, vars), cur = 0;
    vars.forEach(function(v, j) {
      cur |= (env[v] ? 1 : 0) << (n - 1 - j);
    });

    var ones = [];
    tt.forEach(function(x, i) {
      if (x) ones.push(i);
    });

    var res = minimize(n, ones, []);
    var greedy = false;

    if (ones.length) {
      var ess = {};
      ones.forEach(function(o) {
        var c = res.pis.map(function(p, i) {
          return covers(p, o) ? i : -1;
        }).filter(function(i) {
          return i >= 0;
        });
        if (c.length === 1) ess[c[0]] = true;
      });

      var remaining = ones.filter(function(o) {
        return !Object.keys(ess).some(function(i) {
          return covers(res.pis[+i], o);
        });
      });

      var cand = res.pis.map(function(p, i) {
        return !ess[i] &&
          remaining.some(function(o) { return covers(p, o); })
          ? i : -1;
      }).filter(function(i) {
        return i >= 0;
      });

      greedy = remaining.length > 0 && cand.length > 18;
    }

    var min = ones.length === 0 ? "0" :
      (ones.length === tt.length ? "1" :
        exprFromCover(res, n, vars, false));

    var minLabel = greedy
      ? "간단화(최소 보장 안 됨)"
      : "진리표 기준 최소 SOP";

    var h = "<div style='display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start'>";
    h += "<table><tr>" +
      vars.map(function(v) { return "<th>" + v + "</th>"; }).join("") +
      "<th>F</th></tr>";

    tt.forEach(function(x, i) {
      h += "<tr data-r='" + i + "' style='cursor:pointer" +
        (i === cur
          ? ";outline:2px solid " + RED + ";outline-offset:-2px"
          : "") + "'>" +
        vars.map(function(v, j) {
          return "<td>" + ((i >> (n-1-j)) & 1) + "</td>";
        }).join("") +
        "<td style='font-weight:700;" +
        (x ? "color:" + RED : "") + "'>" + x + "</td></tr>";
    });

    h += "</table><div style='flex:1;min-width:240px'>";
    h += "게이트: " + gcs + (nandMode ? " (NAND만 사용)" : "") + "<br>";
    h += "입력 " + vars.map(function(v) {
      return v + "=" + env[v];
    }).join(", ") + " → F = <b style='color:" + RED + "'>" +
      ov + "</b><br>";
    h += minLabel + ": <b style='color:" + RED + "'>" + min + "</b>";
    h += "<br><span style='color:" + INK + "'>F = Σm(" +
      (ones.join(",") || "없음") + ")</span>";
    h += "<div id='cmpbox' style='margin-top:10px'></div></div></div>";

    info.innerHTML = h;

    info.querySelectorAll("tr[data-r]").forEach(function(tr) {
      tr.onclick = function() {
        var i = +tr.getAttribute("data-r");
        vars.forEach(function(v, j) {
          env[v] = (i >> (n-1-j)) & 1;
        });
        render();
      };
    });

    var cb = info.querySelector("#cmpbox");
    cb.removeAttribute("id");
    var cin = txt(cmp, 200, function(v) {
      cmp = v;
      updateCmp();
    }, "비교할 식");
    var cres = H("div", {style: "margin-top:4px"});

    cb.appendChild(H("label", {text: "비교 식 G = "}, [cin]));
    cb.appendChild(cres);

    function updateCmp() {
      if (!cmp.trim()) {
        cres.textContent = "";
        return;
      }

      try {
        var a2 = parseExpr(cmp), v2 = astVars(a2);
        if (v2.length > 5) {
          throw new Error("비교식 변수는 최대 5개까지");
        }

        var all = vars.concat(v2.filter(function(x) {
          return vars.indexOf(x) < 0;
        })).sort();

        if (all.length > 5) {
          throw new Error("두 식을 합쳐 최대 5개 변수까지 비교할 수 있습니다.");
        }

        var bad = null;
        for (var i = 0; i < (1 << all.length) && bad === null; i++) {
          var e2 = {};
          all.forEach(function(v, j) {
            e2[v] = (i >> (all.length-1-j)) & 1;
          });
          if (astEval(ast, e2) !== astEval(a2, e2)) bad = e2;
        }

        if (bad === null) {
          cres.innerHTML = "<b>동치</b>: 모든 입력에서 F = G.";
        } else {
          cres.innerHTML = "<b style='color:" + RED + "'>다름</b>: " +
            all.map(function(v) { return v + "=" + bad[v]; }).join(", ") +
            " 에서 F=" + astEval(ast, bad) +
            ", G=" + astEval(a2, bad);
        }
      } catch (e) {
        cres.textContent = "식 오류: " + e.message;
      }
    }

    updateCmp();

    ctl.innerHTML = "";
    var b1 = btn("AND / OR / NOT", function() {
      nandMode = false;
      render();
    });
    var b2 = btn("NAND만 사용", function() {
      nandMode = true;
      render();
    });

    (nandMode ? b2 : b1).style.cssText +=
      "background:" + INK + ";color:#fff";
    ctl.appendChild(b1);
    ctl.appendChild(b2);

    ctl.appendChild(btn("입력 모두 0", function() {
      vars.forEach(function(v) { env[v] = 0; });
      render();
    }));

    ctl.appendChild(btn("다음 진리표 행", function() {
      var i = (cur + 1) % (1 << n);
      vars.forEach(function(v, j) {
        env[v] = (i >> (n-1-j)) & 1;
      });
      render();
    }));

    if (cfg.presets && cfg.presets.length) {
      var po = [["", "예제 식"]];
      cfg.presets.forEach(function(p, i) {
        po.push([i, p]);
      });

      ctl.appendChild(sel(po, "", function(x) {
        if (x === "") return;
        expr = cfg.presets[+x];
        exprIn.value = expr;
        env = {};
        render();
      }));
    }

    if (cfg.note) {
      info.appendChild(H("div", {
        html: cfg.note,
        style: "margin-top:8px;color:" + INK
      }));
    }
  }

  render();
});

/* ================= two's complement ================= */
function sgn(u,n){return u>=Math.pow(2,n-1)?u-Math.pow(2,n):u;}
function fromSigned(v,n){return v<0?v+Math.pow(2,n):v;}
function rangeStr(n){return (-Math.pow(2,n-1))+" ~ "+(Math.pow(2,n-1)-1);}
function minus(x){return x<0?"\u2212"+(-x):String(x);}
reg("twos-complement", function(el, cfg) {
  V6.title(el, cfg.title || "2의 보수 변환기");
  cfg = cfg || {};

  var allowed = [3, 4, 5, 6, 8, 12, 16];
  var n = Number(cfg.bits || 4);
  if (allowed.indexOf(n) < 0) n = 4;

  var requested = Number(cfg.value === undefined ? -3 : cfg.value);
  if (!Number.isFinite(requested)) requested = -3;
  requested = Math.trunc(requested);

  var lim = Math.pow(2, n-1);
  var u = fromSigned(Math.max(-lim, Math.min(lim-1, requested)), n);
  var warning = requested < -lim || requested >= lim
    ? "초기값이 " + n + "비트 범위를 벗어나 " +
      rangeStr(n) + "로 조정됨."
    : "";

  var ctl = row(), box = H("div"), info = noteBox();
  el.appendChild(ctl);
  el.appendChild(box);
  el.appendChild(info);

  var decStr = null;

  function render() {
    var mod = Math.pow(2, n), mask = mod-1, half = mod/2;
    u &= mask;

    var s2 = sgn(u, n);
    var sign = u >= half ? 1 : 0;
    var mag = u % half;
    var sm = sign ? -mag : mag;
    var o1 = sign ? -((~u)&mask) : u;

    var smStr = sign && mag === 0 ? "−0" : minus(sm);
    var o1Str = sign && ((~u)&mask) === 0 ? "−0" : minus(o1);

    var svg = svgRoot(Math.max(420, n*52+40), 150);
    var cw = Math.min(52, Math.floor(660/n)), x0 = 20;

    for (var i = 0; i < n; i++) {
      var bit = (u >>> (n-1-i)) & 1;
      var x = x0+i*cw;
      var weight = i === 0 ? -Math.pow(2, n-1) :
        Math.pow(2, n-1-i);

      var g = S("g", {style: "cursor:pointer"});
      g.appendChild(S("rect", {
        x: x, y: 34, width: cw-4, height: 44,
        fill: bit ? INK : "#fff",
        stroke: i === 0 ? RED : INK,
        "stroke-width": i === 0 ? 2.4 : 1.4
      }));

      g.appendChild(S("text", {
        x: x+(cw-4)/2, y: 64, "text-anchor": "middle",
        "font-size": 24, "font-weight": 700,
        fill: bit ? "#fff" : INK, text: String(bit)
      }));

      (function(i) {
        g.onclick = function() {
          u = (u ^ (1 << (n-1-i))) & mask;
          decStr = null;

          // 직접 편집한 비트 패턴에는 과거 범위 경고를 적용하지 않는다.
          warning = "";

          render();
        };
      })(i);

      svg.appendChild(g);

      svg.appendChild(S("text", {
        x: x+(cw-4)/2, y: 26, "text-anchor": "middle",
        "font-size": 11, fill: i === 0 ? RED : INK,
        "font-weight": i === 0 ? 700 : 400,
        text: i === 0 ? "−" + Math.pow(2,n-1) :
          String(Math.pow(2,n-1-i))
      }));

      svg.appendChild(S("text", {
        x: x+(cw-4)/2, y: 98, "text-anchor": "middle",
        "font-size": 12, fill: bit ? (i === 0 ? RED : INK) : INK,
        text: bit ? (i === 0 ? "−" + Math.pow(2,n-1) : "+"+weight) : "0"
      }));
    }

    svg.appendChild(S("text", {
      x: x0, y: 9, "font-size": 11, fill: INK,
      text: "부호 비트는 가중치 −" + Math.pow(2,n-1) +
        ". 비트를 클릭해 변경."
    }));

    var terms = [];
    for (var j = 0; j < n; j++) {
      var b = (u >>> (n-1-j)) & 1;
      if (b) {
        terms.push(j === 0 ? "(−"+Math.pow(2,n-1)+")" :
          String(Math.pow(2,n-1-j)));
      }
    }

    svg.appendChild(S("text", {
      x: x0, y: 128, "font-size": 13, fill: INK,
      text: "합 = " + (terms.length ? terms.join(" + ") : "0") +
        " = " + minus(s2)
    }));

    box.innerHTML = "";
    box.appendChild(svg);

    var h = "<table><tr><th>해석</th><th>값</th><th>표현 범위 ("+
      n+"비트)</th></tr>" +
      "<tr><td>unsigned</td><td>"+u+"</td><td>0 ~ "+(mod-1)+"</td></tr>" +
      "<tr><td>sign-magnitude</td><td>"+smStr+"</td><td>"+
      (-(half-1))+" ~ "+(half-1)+" (0이 두 개)</td></tr>" +
      "<tr><td>1의 보수</td><td>"+o1Str+"</td><td>"+
      (-(half-1))+" ~ "+(half-1)+" (0이 두 개)</td></tr>" +
      "<tr><td><b>2의 보수</b></td><td><b style='color:"+RED+"'>"+
      minus(s2)+"</b></td><td>"+rangeStr(n)+" (0이 하나)</td></tr></table>";

    var inv = (~u)&mask, neg = (inv+1)&mask;
    h += "<div style='margin-top:8px'><b>부호 바꾸기</b> (−x = x̄ + 1): " +
      bin(u,n) + " → 비트 반전 " + bin(inv,n) + " → +1 → <b style='color:" +
      RED + "'>" + bin(neg,n) + "</b> = " + minus(sgn(neg,n));

    if (u === half) {
      h += "<br><span style='color:"+RED+"'>−"+half+
        "는 최솟값이다. 부정해도 같은 비트 패턴이며 +"+half+
        "는 이 비트 수로 표현할 수 없다.</span>";
    } else if (u === 0) {
      h += "<br>0의 부정은 0이다. carry-out은 버린다.";
    }

    h += "</div><div style='margin-top:4px'><b>부호 확장</b> ("+
      n+"→"+(n+4)+"비트): 부호 비트 "+sign+
      "을 앞에 4개 복제 → "+String(sign).repeat(4)+bin(u,n)+
      " (값 "+minus(s2)+" 유지)</div>";

    if (warning) {
      h += "<div style='margin-top:6px;color:"+RED+"'>"+
        warning+"</div>";
    }
    info.innerHTML = h;

    ctl.innerHTML = "";
    ctl.appendChild(H("label", {text: "비트 수 "}, [sel(
      allowed.map(function(x) { return [x, String(x)]; }), n,
      function(x) {
        var oldValue = sgn(u, n);
        n = +x;

        var lim2 = Math.pow(2, n-1);
        var adjusted = Math.max(-lim2, Math.min(lim2-1, oldValue));

        if (adjusted !== oldValue) {
          warning = "값이 " + n + "비트 범위로 조정됨: " +
            minus(oldValue) + " → " + minus(adjusted) + ".";
        } else {
          warning = "";
        }

        u = fromSigned(adjusted, n);
        decStr = null;
        render();
      }
    )]));

    var inp = txt(decStr !== null ? decStr : String(s2), 70, function(v) {
      decStr = v;
      var x = Number(v);

      if (v.trim() === "" ||
          !/^[+-]?\d+$/.test(v.trim()) ||
          !Number.isSafeInteger(x)) {
        msg.textContent = "유효한 정수를 입력하세요.";
        return;
      }

      if (x < -half || x >= half) {
        msg.textContent = x + "은(는) " + n +
          "비트 범위 (" + rangeStr(n) + ") 밖입니다.";
        return;
      }

      u = fromSigned(x, n);
      warning = "";
      msg.textContent = "";
      render();
    }, "-3");

    var msg = H("span", {
      style: "color:"+RED+";font-size:12.5px"
    });

    ctl.appendChild(H("label", {text: "10진 입력 "}, [inp]));
    ctl.appendChild(msg);

    ctl.appendChild(btn("부호 바꾸기 (−x)", function() {
      u = (~u + 1) & mask;
      decStr = null;
      warning = "";
      render();
    }));

    ctl.appendChild(btn("+1", function() {
      u = (u+1)&mask;
      decStr = null;
      warning = "";
      render();
    }));
  }

  render();
});

/* ================= two's complement adder ================= */
reg("twos-adder", function(el, cfg) {
  V6.title(el, cfg.title || "2의 보수 덧셈·뺄셈과 overflow");
  cfg = cfg || {};

  var allowed = [3, 4, 5, 6, 8];
  var n = Number(cfg.bits || 4);
  if (allowed.indexOf(n) < 0) n = 4;

  function validInt(x) {
    return Number.isFinite(x) && Number.isInteger(x);
  }

  var a0 = cfg.a === undefined ? 5 : Number(cfg.a);
  var b0 = cfg.b === undefined ? 3 : Number(cfg.b);
  if (!validInt(a0)) a0 = 5;
  if (!validInt(b0)) b0 = 3;

  function clamp(v) {
    var lim = Math.pow(2, n-1);
    return Math.max(-lim, Math.min(lim-1, v));
  }

  var a = clamp(a0), b = clamp(b0);
  var warning = (a !== a0 || b !== b0)
    ? "초기값이 " + n + "비트 범위로 조정됨: A=" + minus(a0) +
      " → " + minus(a) + ", B=" + minus(b0) + " → " + minus(b) + "."
    : "";

  var op = cfg.op === "sub" ? "sub" : "add";
  var ctl = row(), box = H("div"), info = noteBox();
  var inputError = "";

  el.appendChild(ctl);
  el.appendChild(box);
  el.appendChild(info);

  function render() {
    var mod = Math.pow(2,n), mask = mod-1;
    var A = fromSigned(a,n), B0 = fromSigned(b,n);
    var B = op === "sub" ? ((~B0)&mask) : B0;
    var cin = op === "sub" ? 1 : 0;
    var c = [cin], sum = [];

    for (var i = 0; i < n; i++) {
      var ai = (A >>> i)&1;
      var bi = (B >>> i)&1;
      var ci = c[i];
      sum[i] = ai ^ bi ^ ci;
      c[i+1] = (ai&bi) | (ai&ci) | (bi&ci);
    }

    var S2 = 0;
    for (var k = 0; k < n; k++) S2 |= sum[k] << k;

    var res = sgn(S2,n), truth = op === "add" ? a+b : a-b;
    var lim = Math.pow(2,n-1);
    var ovf = (c[n] ^ c[n-1]) === 1;
    var cw = Math.min(54, Math.floor(560/(n+2)));
    var x0 = 110, Wd = x0+(n+1)*cw+130, Hh = 196;
    var svg = svgRoot(Math.max(Wd,460),Hh);

    function colX(i) {
      return x0+(n-i)*cw+cw/2;
    }

    function cell(i,y,t,color,bold) {
      svg.appendChild(S("text", {
        x: colX(i), y: y, "text-anchor": "middle",
        "font-size": 19, "font-weight": bold ? 700 : 400,
        fill: color || INK, text: String(t)
      }));
    }

    function lab(y,t,color) {
      svg.appendChild(S("text", {
        x: x0-8, y: y, "text-anchor": "end",
        "font-size": 12, fill: color || INK,
        "font-weight": 700, text: t
      }));
    }

    for (var q = 0; q < n; q++) {
      svg.appendChild(S("text", {
        x: colX(q), y: 14, "text-anchor": "middle",
        "font-size": 10, fill: INK, text: "bit " + q
      }));
    }

    lab(44,"carry C");
    for (var i3 = 0; i3 <= n; i3++) {
      var hot = ovf && (i3 === n || i3 === n-1);
      cell(i3,44,c[i3],hot ? RED : INK,hot);

      if (hot) {
        svg.appendChild(S("text", {
          x: colX(i3), y: 58, "text-anchor": "middle",
          "font-size": 9, fill: RED,
          text: i3 === n ? "C_n" : "C_(n−1)"
        }));
      }
    }

    lab(86,"A");
    for (var i4 = 0; i4 < n; i4++) {
      cell(i4,86,(A >>> i4)&1);
    }

    lab(116,op === "sub" ? "B̄" : "B");
    for (var i5 = 0; i5 < n; i5++) {
      cell(i5,116,(B >>> i5)&1);
    }

    svg.appendChild(S("line", {
      x1: x0, y1: 126, x2: x0+n*cw+cw, y2: 126,
      stroke: INK, "stroke-width": 1.6
    }));

    lab(154,"Sum");
    for (var i6 = 0; i6 < n; i6++) {
      cell(i6,154,sum[i6],INK,true);
    }
    cell(n,154,c[n],INK,false);

    svg.appendChild(S("text", {
      x: x0+(n+1)*cw+10, y: 154, "font-size": 13,
      "font-weight": 700, fill: INK, text: "= " + minus(res)
    }));

    svg.appendChild(S("text", {
      x: x0, y: 184, "font-size": 11, fill: INK,
      text: (op === "sub" ? "C_0 = 1. " : "C_0 = 0. ") +
        "각 carry는 다음 상위 비트로 전달되며, C_n은 carry-out."
    }));

    box.innerHTML = "";
    box.appendChild(svg);

    var h = "<div>" +
      (op === "sub" ? "A − B = A + B̄ + 1" : "A + B") +
      " → 실제 값 " + minus(truth) + ", 비트 결과 <b>" +
      bin(S2,n) + "</b> = " + minus(res) + "</div>";

    h += "<div style='margin-top:4px'>C<sub>n−1</sub> = " +
      c[n-1] + ", C<sub>n</sub> = " + c[n] +
      " → overflow = C<sub>n−1</sub> XOR C<sub>n</sub> = " +
      "<b style='color:" + (ovf ? RED : INK) + "'>" +
      (ovf ? 1 : 0) + "</b></div>";

    h += "<div style='margin-top:4px'>" +
      (ovf
        ? "<b style='color:"+RED+"'>signed overflow</b>: 실제 값 " +
          minus(truth) + "이 " + n + "비트 범위 (" +
          rangeStr(n) + ") 밖이므로 비트 결과 " +
          minus(res) + "가 실제 값과 다르다."
        : "signed overflow 없음: 결과가 표현 범위 안이다.") +
      "</div>";

    var un = op === "add" ? A+B0 : A-B0;

    h += "<div style='margin-top:4px;color:"+INK+"'>unsigned로 보면 " +
      A + (op === "add" ? " + " : " − ") + B0 + " = " + un +
      " (" + (op === "add"
        ? (c[n] ? "CO=1 → unsigned overflow" :
          "CO=0 → unsigned 범위 안")
        : (c[n] ? "CO=1 → borrow 없음" :
          "CO=0 → unsigned borrow 발생")) +
      "). signed overflow와 unsigned overflow는 별도로 판정한다.</div>";

    if (warning) {
      h += "<div style='margin-top:6px;color:"+RED+"'>"+
        warning+"</div>";
    }

    if (inputError) {
      h += "<div style='margin-top:6px;color:"+RED+";font-size:12.5px' role='status'>"+
        inputError+"</div>";
    }

    info.innerHTML = h;

    ctl.innerHTML = "";

    ctl.appendChild(H("label", {text: "비트 수 "}, [sel(
      allowed.map(function(x) { return [x,String(x)]; }), n,
      function(x) {
        var oldA = a, oldB = b;
        n = +x;

        var na = clamp(oldA), nb = clamp(oldB);
        warning = (na !== oldA || nb !== oldB)
          ? "값이 " + n + "비트 범위로 조정됨: A " +
            minus(oldA) + " → " + minus(na) + ", B " +
            minus(oldB) + " → " + minus(nb) + "."
          : "";

        a = na;
        b = nb;
        inputError = "";
        render();
      }
    )]));

    function numIn(label,get,set,key) {
      var i = txt(String(get()),56,function(v) {
        // txt 헬퍼의 콜백이 input 이벤트여도 입력 중에는
        // 판정하지 않는다. change 이벤트에서 확정한다.
      });

      i.setAttribute("data-k",key);
      i.setAttribute("inputmode","numeric");
      i.setAttribute("aria-label",label);

      function commit() {
        var v = i.value.trim();
        var x = Number(v);

        if (v === "" || !/^[+-]?\d+$/.test(v) ||
            !Number.isSafeInteger(x)) {
          inputError = label + ": 유효한 정수를 입력하세요. 이전 값으로 복구했습니다.";
          i.value = String(get());
          render();
          return;
        }

        var lim = Math.pow(2,n-1);
        if (x < -lim || x >= lim) {
          inputError = label + ": " + x + "은(는) " +
            n + "비트 범위 (" + rangeStr(n) +
            ") 밖입니다. 이전 값으로 복구했습니다.";
          i.value = String(get());
          render();
          return;
        }

        set(x);
        warning = "";
        inputError = "";
        render();
      }

      i.addEventListener("change",commit);
      i.addEventListener("keydown",function(ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          commit();
        }
      });

      return H("label",{text:label+" "},[i]);
    }

    ctl.appendChild(numIn("A",function(){return a;},function(v){a=v;},"a"));
    ctl.appendChild(numIn("B",function(){return b;},function(v){b=v;},"b"));

    var bAdd = btn("A + B",function() {
      op = "add";
      render();
    });
    var bSub = btn("A − B",function() {
      op = "sub";
      render();
    });

    (op === "add" ? bAdd : bSub).style.cssText +=
      "background:"+INK+";color:#fff";

    ctl.appendChild(bAdd);
    ctl.appendChild(bSub);
    ctl.appendChild(H("span", {
      text: "입력 범위: " + rangeStr(n),
      style: "color:"+INK
    }));
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
reg("ieee754", function(el, cfg) {
  V6.title(el, cfg.title || "IEEE 754 비트 분해");
  cfg = cfg || {};

  var fk = FMT[cfg.format] ? cfg.format : "single";
  var fmt = FMT[fk];
  var input = cfg.value === undefined ? "-6.25" : String(cfg.value);
  var bits = 0n, typed = null, formatNotice = "";

  function setFromText(t) {
    var x, tt = t.trim().toLowerCase();

    if (tt === "inf" || tt === "+inf" || tt === "infinity") {
      x = Infinity;
    } else if (tt === "-inf" || tt === "-infinity") {
      x = -Infinity;
    } else if (tt === "nan") {
      x = NaN;
    } else {
      if (tt === "" || isNaN(Number(tt))) return false;
      x = Number(tt);
    }

    typed = x;
    bits = encodeFloat(x, fmt);
    return true;
  }

  setFromText(input);

  var ctl = row(), box = H("div"), info = noteBox();
  var err = H("span", {
    style: "color:"+RED+";font-size:12.5px"
  });

  el.appendChild(ctl);
  el.appendChild(box);
  el.appendChild(info);

  function sameValue(a,b) {
    return Object.is
      ? Object.is(a,b)
      : (a === b || (a !== a && b !== b));
  }

  function render() {
    var tot = 1+fmt.e+fmt.f, o = decodeFloat(bits,fmt);
    box.innerHTML = "";

    function group(label,from,len,color) {
      var g = H("div", {
        style: "display:inline-block;vertical-align:top;margin:0 10px 8px 0"
      });

      g.appendChild(H("div", {
        text: label,
        style: "font-size:11px;font-weight:700;letter-spacing:.04em;color:"+
          color+";margin-bottom:2px"
      }));

      var wrap = H("div", {
        style: "display:flex;flex-wrap:wrap;gap:2px;max-width:"+
          Math.min(len,32)*21+"px"
      });

      for (var i=0;i<len;i++) {
        (function(pos) {
          var bit = Number((bits >> big(pos)) & 1n);
          var c = H("button", {
            type:"button",
            text:String(bit)
          });

          c.style.cssText =
            "width:19px;height:26px;padding:0;font-family:Consolas,monospace;" +
            "font-size:13px;font-weight:700;border:1.4px solid "+color+
            ";border-radius:2px;cursor:pointer;background:"+
            (bit?color:"#fff")+";color:"+(bit?"#fff":color);

          c.onclick = function() {
            bits ^= (1n << big(pos));
            typed = null;
            input = null;
            formatNotice = "";
            render();
          };

          wrap.appendChild(c);
        })(from-1-i);
      }

      g.appendChild(wrap);
      box.appendChild(g);
    }

    group("부호 s",tot,1,RED);
    group("지수 e ("+fmt.e+"비트, 편향 "+fmt.bias+")",
      fmt.e+fmt.f,fmt.e,INK);
    group("가수 f ("+fmt.f+"비트)",fmt.f,fmt.f,INK);

    var eStr = toBinStr(BigInt(o.e),fmt.e);
    var fStr = toBinStr(o.f,fmt.f);
    var bitString = toBinStr(bits,tot);
    var hex = "0x";

    for (var hi=0;hi<bitString.length;hi+=4) {
      hex += parseInt(bitString.slice(hi,hi+4),2).toString(16);
    }
    hex = hex.toUpperCase();

    var h = "<table><tr><th>필드</th><th>비트</th><th>해석</th></tr>";
    h += "<tr><td>부호 s</td><td>"+o.s+"</td><td>(−1)<sup>"+
      o.s+"</sup> = "+(o.s?"−1":"+1")+"</td></tr>";

    h += "<tr><td>지수 e</td><td>"+eStr+"</td><td>e = "+o.e;

    if (o.cls === "normal") {
      h += ", E = e − "+o.bias+" = <b>"+o.E+"</b>";
    } else if (o.cls === "subnormal") {
      h += " (0), E = 1 − "+o.bias+" = <b>"+o.E+"</b>";
    } else if (o.cls === "zero") {
      h += " (0, zero)";
    } else {
      h += " (all ones)";
    }

    h += "</td></tr>";

    var sig = "";
    if (o.cls === "normal" || o.cls === "subnormal") {
      sig = exactDecimal(o.N,o.X);
    }

    var fShow = fStr.replace(/0+$/,"");
    h += "<tr><td>가수 f</td><td style='word-break:break-all'>"+
      fStr+"</td><td>";

    if (o.cls === "normal") {
      h += "암묵적 1을 붙여 1."+fShow+"<sub>2</sub> = "+sig;
    } else if (o.cls === "subnormal") {
      h += "암묵적 1 없이 0."+fShow+"<sub>2</sub> = "+sig;
    } else if (o.cls === "nan") {
      h += "f ≠ 0: NaN payload";
    } else {
      h += "f = 0";
    }

    h += "</td></tr></table>";

    var val, exact;

    if (o.cls === "nan") {
      val = "NaN";
      exact = "";
    } else if (o.cls === "inf") {
      val = (o.s?"−":"+")+"∞";
      exact = "";
    } else {
      exact = exactDecimal(o.N,o.X);
      val = (o.s?"−":"")+exact;
    }

    h += "<div style='margin-top:8px'>분류: <b>" +
      ({
        normal:"normalized",
        subnormal:"denormalized (subnormal)",
        zero:o.s?"−0":"+0",
        inf:"±∞",
        nan:"NaN"
      }[o.cls]) + "</b>";

    if (o.cls === "normal") {
      h += "<br>값 = (−1)<sup>"+o.s+"</sup> × 1.f × 2<sup>"+
        o.E+"</sup> = "+(o.s?"−1":"1")+" × "+sig+
        " × 2<sup>"+o.E+"</sup>";
    }

    if (o.cls === "subnormal") {
      h += "<br>값 = (−1)<sup>"+o.s+
        "</sup> × 0.f × 2<sup>1−bias</sup> = "+
        (o.s?"−1":"1")+" × "+sig+" × 2<sup>"+o.E+"</sup>";
    }

    var vshow = val.length>70
      ? val.slice(0,70)+"… ("+val.length+"자리)"
      : val;

    h += "<br>저장된 값(정확한 십진값) = <b style='color:"+RED+
      ";word-break:break-all'>"+vshow+"</b>";

    if (o.cls === "normal" || o.cls === "subnormal") {
      h += "<br><span style='color:"+INK+"'>인접 표현 간격(ulp) = 2<sup>"+
        o.X+"</sup> = "+
        (o.X>-60 ? exactDecimal(1n,o.X) : "2^"+o.X)+"</span>";
    }

    h += "<br><span style='color:"+INK+"'>16진수 "+hex+"</span>";

    if (typed !== null && isFinite(typed) &&
        o.cls !== "nan" && o.cls !== "inf") {
      var same = sameValue(numFromDecoded(o),typed);
      var mm = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.exec(
        String(input).trim()
      );

      if (mm) {
        var ds = String(input).trim().replace(/^[+-]/,"");
        var ex2 = 0;
        var eidx = ds.search(/e/i);

        if (eidx >= 0) {
          ex2 = parseInt(ds.slice(eidx+1),10);
          ds = ds.slice(0,eidx);
        }

        var dot = ds.indexOf(".");
        var fl = dot >= 0 ? ds.length-dot-1 : 0;
        var digits = ds.replace(".","");

        if (/^\d+$/.test(digits)) {
          var M = BigInt(digits || "0");
          var e10 = ex2-fl;

          if (e10 >= 0) {
            var lhs = M * (10n**big(e10));
            var rhs = o.N * (2n**big(Math.max(o.X,0))) *
              (10n**big(Math.max(-e10,0)));
            if (o.X < 0) lhs *= 2n**big(-o.X);
            same = lhs === rhs;
          } else {
            var lhs2 = M * (2n**big(Math.max(-o.X,0)));
            var rhs2 = o.N * (2n**big(Math.max(o.X,0))) *
              (10n**big(-e10));
            same = lhs2 === rhs2;
          }
        }
      }

      h += "<br>"+(same
        ? "입력값 "+input+"은(는) 이 형식에서 정확히 표현된다."
        : "입력값 "+input+"은(는) 정확히 표현되지 않아 가장 가까운 값으로 반올림된다.");
    }

    if (o.cls === "inf" && typed !== null && isFinite(typed)) {
      h += "<br><span style='color:"+RED+
        "'>입력값이 이 형식의 범위를 넘어 ∞로 overflow했다.</span>";
    }

    if (formatNotice) {
      h += "<div style='margin-top:6px;color:"+RED+"'>"+
        formatNotice+"</div>";
    }

    h += "</div>";
    info.innerHTML = h;

    // 입력 해석 방식과 NaN payload 보존의 한계를 명시한다.
    info.appendChild(H("div", {
      text: "십진 입력은 먼저 JavaScript Number(double)로 해석되며, half/single은 그 값에서 다시 반올림된다.",
      style: "margin-top:8px;color:"+INK+";font-size:12.5px"
    }));

    ctl.innerHTML = "";

    ctl.appendChild(H("label",{text:"형식 "},[sel(
      [["half","half (16)"],["single","single (32)"],["double","double (64)"]],
      fk,function(k) {
        var old = decodeFloat(bits,fmt);
        var oldValue = numFromDecoded(old);
        var oldWasNaN = old.cls === "nan";

        fk = k;
        fmt = FMT[k];
        bits = encodeFloat(oldValue,fmt);
        typed = oldValue;
        input = String(oldValue);

        formatNotice = "형식 변경은 값 보존(반올림될 수 있음).";

        if (oldWasNaN) {
          formatNotice +=
            " NaN은 유지되지만, 형식 변경時 payload는 보존되지 않는다.";
        } else {
          var newValue = numFromDecoded(decodeFloat(bits,fmt));

          if (!sameValue(oldValue,newValue)) {
            formatNotice += " 이전 값 " + String(oldValue) +
              "이 새 형식에서 " + String(newValue) +
              "로 반올림되었습니다.";
          } else {
            formatNotice += " 이 경우 값이 그대로 보존되었습니다.";
          }
        }

        render();
      }
    )]));

    ctl.appendChild(H("span", {
      text:"형식 변경은 값 보존(반올림될 수 있음).",
      style:"font-size:12px;color:"+INK
    }));

    var inp = txt(input===null?"":input,130,function(v) {
      input = v;

      if (setFromText(v)) {
        err.textContent = "";
        formatNotice = "";
        renderKeep();
      } else {
        err.textContent = v.trim()===""
          ? ""
          : "숫자, inf, nan 중 하나를 입력";
      }
    },"-6.25");

    ctl.appendChild(H("label",{text:"10진 입력 "},[inp]));
    ctl.appendChild(err);

    function renderKeep() {
      var v = inp.value;
      render();

      var ni = ctl.querySelector("input[type=text]");
      if (ni) {
        ni.value = v;
        ni.focus();
        ni.setSelectionRange(v.length,v.length);
      }
    }

    [
      ["0.1","0.1"],
      ["−6.25","-6.25"],
      ["1/3","0.3333333333333333"],
      ["최댓값","max"],
      ["∞","inf"],
      ["NaN","nan"],
      ["−0","-0"]
    ].forEach(function(p) {
      ctl.appendChild(btn(p[0],function() {
        var v = p[1];

        if (v === "max") {
          v = String(Math.pow(2,fmt.bias) *
            (2-Math.pow(2,-fmt.f)));
        }

        input = v;
        setFromText(v);
        formatNotice = "";
        render();
      }));
    });
  }

  render();
});

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mountMine);else mountMine();
/* test hooks */
V6.extra={minimize:minimize,parseExpr:parseExpr,truthTable:truthTable,astVars:astVars,astEval:astEval,buildNet:buildNet,netEval:netEval,
  encodeFloat:encodeFloat,decodeFloat:decodeFloat,exactDecimal:exactDecimal,FMT:FMT,termSOP:termSOP,exprFromCover:exprFromCover};
})();
