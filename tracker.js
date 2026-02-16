(function(){
    if(document.visibilityState==='prerender')return;
    var h=location.hostname;
    if(h==='localhost'||h==='127.0.0.1')return;
    var d=JSON.stringify({d:h,p:location.pathname,r:document.referrer});
    var e='https://analytics.yuanchu.ai/api/collect';
    if(navigator.sendBeacon){navigator.sendBeacon(e,d)}
    else{fetch(e,{method:'POST',body:d,keepalive:true}).catch(function(){})}
})();
