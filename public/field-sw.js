// Only the explicitly prepared field shell and immutable build assets are cached.
// API responses, authenticated media and third-party requests always use network.
const prefix="cemetery-field-shell-";
const control="cemetery-field-control";
const pointer="/__field_shell_version";
async function currentCache(){
  const response=await(await caches.open(control)).match(pointer);
  return response?response.text():(await caches.keys()).filter(key=>key.startsWith(prefix)).at(-1);
}
async function prepare(){
  const manifestResponse=await fetch("/field-assets.json",{cache:"no-store"});
  if(!manifestResponse.ok||manifestResponse.redirected||!manifestResponse.headers.get("content-type")?.includes("json"))throw new Error("Offline files are unavailable.");
  const manifest=await manifestResponse.json();
  if(!/^[a-f0-9]{16}$/.test(manifest.revision)||!Array.isArray(manifest.files)||manifest.files.length>200)throw new Error("Invalid offline file list.");
  const name=prefix+manifest.revision,cache=await caches.open(name);
  for(const path of ["/field/",...manifest.files]){
    if(path!=="/field/"&&!/^\/assets\/[^/]+\.(js|css|woff2?)$/.test(path))throw new Error("Unsupported offline asset.");
    if(path!=="/field/"&&await cache.match(path))continue;
    const response=await fetch(path,{cache:"no-store"});
    if(!response.ok||response.redirected)throw new Error("Offline download was interrupted.");
    await cache.put(path,response);
  }
  await(await caches.open(control)).put(pointer,new Response(name));
  const versions=(await caches.keys()).filter(key=>key.startsWith(prefix));
  for(const old of versions.slice(0,-2))if(old!==name)await caches.delete(old);
  return manifest.revision;
}
self.addEventListener("install",event=>event.waitUntil(prepare().then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("message",event=>{
  if(event.data?.type!=="prepare-field-shell")return;
  event.waitUntil(prepare().then(revision=>event.ports[0]?.postMessage({ok:true,revision})).catch(()=>event.ports[0]?.postMessage({ok:false})));
});
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET"||url.origin!==self.location.origin)return;
  if(event.request.mode==="navigate"&&["/field","/field/"].includes(url.pathname)){
    event.respondWith(fetch(event.request).catch(async()=>{
      const name=await currentCache();const cached=name&&await(await caches.open(name)).match("/field/");
      return cached||Response.error();
    }));
  }else if(/^\/assets\/[^/]+\.(js|css|woff2?)$/.test(url.pathname)){
    event.respondWith((async()=>{
      for(const name of(await caches.keys()).filter(key=>key.startsWith(prefix)).reverse()){
        const cached=await(await caches.open(name)).match(event.request,{ignoreVary:true});if(cached)return cached;
      }
      return fetch(event.request);
    })());
  }
});
