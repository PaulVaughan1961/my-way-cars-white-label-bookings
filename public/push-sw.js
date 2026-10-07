self.addEventListener("push",event=>{
  let p={};try{p=event.data?event.data.json():{};}catch{p={title:"New booking request",body:event.data?event.data.text():"A new booking request needs your attention."};}
  event.waitUntil(self.registration.showNotification(p.title||"New booking request",{body:p.body||"A new booking request needs your attention.",icon:"/icons/icon-192.png",badge:"/icons/icon-192.png",tag:p.tag||"new-booking-request",renotify:true,data:{url:p.url||"/dashboard"}}));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();const u=new URL(event.notification?.data?.url||"/dashboard",self.location.origin).href;
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{for(const c of cs){if(c.url.startsWith(self.location.origin)&&"focus" in c){return "navigate" in c?c.navigate(u).then(()=>c.focus()):c.focus();}}return clients.openWindow?clients.openWindow(u):undefined;}));
});