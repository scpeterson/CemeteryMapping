export async function prepareOfflineShell(){
  if(!("serviceWorker" in navigator))throw new Error("This browser cannot prepare offline page loading. Device drafts can still be saved.");
  const response=await fetch("/field-assets.json",{cache:"no-store"});
  if(!response.ok||!response.headers.get("content-type")?.includes("json"))throw new Error("This deployment cannot prepare offline page loading. Keep this page open while disconnected.");
  const registration=await navigator.serviceWorker.register("/field-sw.js",{scope:"/field"});
  const worker=registration.installing??registration.waiting??registration.active;
  if(!worker)throw new Error("Offline preparation could not start.");
  if(worker.state!=="activated")await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("Offline files are still loading. Try again while connected.")),60000);
    const check=()=>{if(worker.state==="activated"){clearTimeout(timer);resolve();}else if(worker.state==="redundant"){clearTimeout(timer);reject(new Error("Offline preparation failed. Reconnect and try again."));}};
    worker.addEventListener("statechange",check);check();
  });
  await new Promise<void>((resolve,reject)=>{
    const channel=new MessageChannel();
    const timer=setTimeout(()=>{channel.port1.close();reject(new Error("Offline files are still loading. Try again while connected."));},60000);
    channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();if(event.data?.ok)resolve();else reject(new Error("Offline download was interrupted. Reconnect and try again."));};
    worker.postMessage({type:"prepare-field-shell"},[channel.port2]);
  });
  if(navigator.storage?.persist)await navigator.storage.persist().catch(()=>false);
}
