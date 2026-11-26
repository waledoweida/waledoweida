(function(){
"use strict";
var $=function(i){return document.getElementById(i)};
var f=$("dlForm"),inp=$("dlUrl"),go=$("dlGo"),msg=$("dlMsg"),res=$("dlResult"),site=$("dlSite"),grid=$("dlGrid"),file=$("dlFile");
if(!f)return;
var SITES=[[/(^|\.)(youtube\.com|youtu\.be)$/,"YouTube"],[/(^|\.)tiktok\.com$/,"TikTok"],[/(^|\.)instagram\.com$/,"Instagram"],[/(^|\.)(facebook\.com|fb\.watch)$/,"Facebook"],[/(^|\.)(x\.com|twitter\.com)$/,"X"],[/(^|\.)snapchat\.com$/,"Snapchat"],[/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/,"Pinterest"],[/(^|\.)(reddit\.com|redd\.it)$/,"Reddit"],[/(^|\.)soundcloud\.com$/,"SoundCloud"],[/(^|\.)vimeo\.com$/,"Vimeo"],[/(^|\.)twitch\.tv$/,"Twitch"],[/(^|\.)(dailymotion\.com|dai\.ly)$/,"Dailymotion"],[/(^|\.)bilibili\.com$/,"Bilibili"],[/(^|\.)tumblr\.com$/,"Tumblr"]];
var ERR={
"error.api.link.invalid":"اللينك ده مش صحيح. انسخه تاني من زرار «مشاركة» في التطبيق والصقه هنا.",
"error.api.link.unsupported":"الموقع ده مش مدعوم لسه.",
"error.api.service.unsupported":"الموقع ده مش مدعوم لسه.",
"error.api.content.video.unavailable":"الفيديو ده مش متاح: ممكن يكون اتمسح أو خاص أو محظور في البلد.",
"error.api.content.video.private":"الفيديو ده خاص ومينفعش يتحمّل.",
"error.api.content.video.age":"الفيديو ده محدد بسن ومحتاج تسجيل دخول، فمينفعش يتحمّل.",
"error.api.content.video.live":"مينفعش تحمّل بث مباشر وهو شغال. استنى لما البث يخلص.",
"error.api.content.too_long":"الفيديو أطول من الحد المسموح للتحميل.",
"error.api.content.post.private":"المنشور ده خاص ومينفعش يتحمّل.",
"error.api.content.post.unavailable":"المنشور ده مش متاح أو اتمسح.",
"error.api.youtube.login":"يوتيوب طالب تسجيل دخول للفيديو ده دلوقتي. جرّب كمان شوية.",
"error.api.youtube.decipher":"يوتيوب غيّر حاجة عندهم. جرّب كمان شوية.",
"error.api.fetch.fail":"معرفناش نجيب الفيديو. اتأكد من اللينك وجرّب تاني.",
"error.api.fetch.critical":"حصلت مشكلة وإحنا بنجيب الفيديو. جرّب تاني.",
"error.api.fetch.empty":"الموقع مرجّعش أي ملف. جرّب جودة تانية.",
"error.api.fetch.rate":"الموقع ده ضاغط علينا دلوقتي. جرّب بعد دقيقة.",
"rate_limited":"حمّلت كتير في وقت قصير. استنى كام دقيقة وجرّب تاني.",
"not_configured":"خدمة التحميل بتتجهّز دلوقتي. ارجع جرّب كمان شوية.",
"upstream":"سيرفر التحميل مش بيرد دلوقتي. جرّب كمان شوية.",
"network":"اتأكد إنك متصل بالإنترنت وجرّب تاني."
};
function host(v){try{return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v)?v:"https://"+v).hostname.toLowerCase()}catch(e){return""}}
function detect(){var h=host(inp.value.trim()),n="";for(var i=0;i<SITES.length;i++)if(SITES[i][0].test(h)){n=SITES[i][1];break}site.textContent=n;site.hidden=!n;inp.parentNode.classList.remove("bad")}
function val(n){var e=f.querySelector('input[name="'+n+'"]:checked');return e?e.value:""}
function mode(){var a=val("mode")==="audio";$("dlVideoOpts").hidden=a;$("dlAudioOpts").hidden=!a}
function say(t){msg.textContent=t;msg.hidden=!t}
function busy(b){go.disabled=b;go.classList.toggle("busy",b);go.querySelector(".dl-go-t").textContent=b?"بنجهّز الملف…":"تحميل"}
function icon(t){var p=t==="photo"?'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>':'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>';return'<svg class="i" aria-hidden="true">'+p+"</svg>"}
function show(d){grid.innerHTML="";file.removeAttribute("download");if(d.kind==="picker"){var items=d.items||[];$("dlName").textContent="لقينا "+items.length+" ملف. اختار اللي عايزه.";items.forEach(function(it,i){var a=document.createElement("a");a.className="dl-item";a.href=it.url;a.target="_blank";a.rel="noopener noreferrer";a.innerHTML=icon(it.type);var s=document.createElement("span");s.textContent=(it.type==="photo"?"صورة ":"فيديو ")+(i+1);a.appendChild(s);grid.appendChild(a)});grid.hidden=!items.length;if(d.audio){file.href=d.audio;file.hidden=false;file.lastChild.textContent="احفظ الصوت"}else file.hidden=true}else{$("dlName").textContent=d.filename||"";grid.hidden=true;file.hidden=false;file.href=d.url;file.lastChild.textContent="احفظ الملف";if(d.filename)file.setAttribute("download",d.filename)}res.hidden=false;res.scrollIntoView({behavior:"smooth",block:"nearest"})}
inp.addEventListener("input",detect);
f.addEventListener("change",function(e){if(e.target.name==="mode")mode()});
$("dlPaste").addEventListener("click",function(){if(navigator.clipboard&&navigator.clipboard.readText){navigator.clipboard.readText().then(function(t){inp.value=t.trim();detect();inp.focus()},function(){inp.focus()})}else inp.focus()});
$("dlAgain").addEventListener("click",function(){res.hidden=true;inp.value="";detect();say("");inp.focus()});
f.addEventListener("submit",function(e){e.preventDefault();var u=inp.value.trim();say("");res.hidden=true;if(!u||host(u).indexOf(".")<0){inp.parentNode.classList.add("bad");say("الصق لينك الفيديو الأول.");inp.focus();return}busy(true);fetch("/api/download",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:u,mode:val("mode"),quality:val("quality"),audioFormat:val("audioFormat"),audioBitrate:val("audioBitrate")})}).then(function(r){return r.json().catch(function(){return{error:"upstream"}})}).then(function(d){busy(false);if(d&&d.kind)show(d);else{var c=d&&d.error||"";say(ERR[c]||(c.indexOf("youtube")>-1?ERR["error.api.youtube.login"]:"حصلت مشكلة. اتأكد من اللينك وجرّب تاني."))}},function(){busy(false);say(ERR.network)})});
var q=new URLSearchParams(location.search).get("url");if(q){inp.value=q;detect()}
mode();
})();
