import { isOfflineWorkspace, type OfflineWorkspace } from "./offlineFieldTypes";

type Cipher = { iv:Uint8Array<ArrayBuffer>; bytes:ArrayBuffer };
type VaultRow = { id:string; salt:Uint8Array<ArrayBuffer>; ownerHash:string; revision:number; savedAt:string; document:Cipher };
export type VaultHandle = { id:string; key:CryptoKey; salt:Uint8Array<ArrayBuffer>; ownerHash:string; revision:number };
export type VaultSummary = Pick<VaultRow,"id"|"savedAt">;
const encoder=new TextEncoder();
let database:Promise<IDBDatabase>|undefined;
function db(){
  if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open("cemetery-field-v1",1);
    request.onupgradeneeded=()=>{
      request.result.createObjectStore("vaults",{keyPath:"id"});
      const files=request.result.createObjectStore("files",{keyPath:"id"});files.createIndex("vaultId","vaultId");
    };
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  }).catch(error=>{database=undefined;throw error;});
  return database;
}
function result<T>(request:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function complete(transaction:IDBTransaction){return new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onabort=()=>reject(transaction.error??new Error("Offline storage was not updated."));transaction.onerror=()=>reject(transaction.error);});}
const bytes=(data:Uint8Array)=>Uint8Array.from(data).buffer;
async function ownerHash(subject:string){const hash=await crypto.subtle.digest("SHA-256",encoder.encode(subject));return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,"0")).join("");}
async function derive(passphrase:string,salt:Uint8Array){
  if(passphrase.length<8)throw new Error("Use an offline passphrase of at least eight characters.");
  const material=await crypto.subtle.importKey("raw",encoder.encode(passphrase),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt:bytes(salt),iterations:210000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function encrypt(key:CryptoKey,data:ArrayBuffer,context:string):Promise<Cipher>{
  const iv=crypto.getRandomValues(new Uint8Array(12));
  return {iv,bytes:await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:encoder.encode(context)},key,data)};
}
async function decrypt(key:CryptoKey,cipher:Cipher,context:string){return crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(cipher.iv),additionalData:encoder.encode(context)},key,cipher.bytes);}

export async function listOfflineVaults():Promise<VaultSummary[]>{
  const connection=await db();const rows=await result<VaultRow[]>(connection.transaction("vaults").objectStore("vaults").getAll());
  return rows.map(({id,savedAt})=>({id,savedAt})).sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
}
export async function createOfflineVault(document:OfflineWorkspace,passphrase:string){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const handle:VaultHandle={id:document.id,salt,key:await derive(passphrase,salt),ownerHash:await ownerHash(document.ownerSubject),revision:0};
  return saveOfflineVault(handle,document);
}
export async function unlockOfflineVault(id:string,passphrase:string):Promise<{handle:VaultHandle;document:OfflineWorkspace}>{
  const connection=await db();const row=await result<VaultRow|undefined>(connection.transaction("vaults").objectStore("vaults").get(id));
  if(!row)throw new Error("This offline workspace is no longer available on this device.");
  try{
    const key=await derive(passphrase,row.salt);
    const document:unknown=JSON.parse(new TextDecoder().decode(await decrypt(key,row.document,`${id}:document`)));
    if(!isOfflineWorkspace(document)||document.id!==id||await ownerHash(document.ownerSubject)!==row.ownerHash)throw new Error("Invalid offline workspace.");
    return {handle:{id,key,salt:row.salt,ownerHash:row.ownerHash,revision:row.revision},document};
  }catch{throw new Error("Unable to unlock this workspace. Check the offline passphrase.");}
}
export async function saveOfflineVault(handle:VaultHandle,document:OfflineWorkspace,photo?:{id:string;file:File}):Promise<VaultHandle>{
  if(!isOfflineWorkspace(document))throw new Error("This workspace is full or needs review before it can be saved.");
  if(document.id!==handle.id||await ownerHash(document.ownerSubject)!==handle.ownerHash)throw new Error("This workspace belongs to another account.");
  const encoded=encoder.encode(JSON.stringify(document));
  if(encoded.byteLength>20*1024*1024)throw new Error("This workspace is full. Synchronize it and prepare another workspace.");
  if(photo&&photo.file.size>25*1024*1024)throw new Error("Choose a photo smaller than 25 MB.");
  const encrypted=await encrypt(handle.key,bytes(encoded),`${handle.id}:document`);
  const file=photo?await encrypt(handle.key,await photo.file.arrayBuffer(),`${handle.id}:photo:${photo.id}`):undefined;
  const connection=await db();const transaction=connection.transaction(["vaults","files"],"readwrite");
  let conflict=false;
  const done=complete(transaction).catch(error=>{if(conflict)throw new Error("This workspace changed in another tab. Keep your edits and unlock the latest workspace before continuing.");throw error;});
  const vaults=transaction.objectStore("vaults");const current=vaults.get(handle.id);
  current.onsuccess=()=>{
    const existing=current.result as VaultRow|undefined;
    if((existing?.revision??0)!==handle.revision){conflict=true;transaction.abort();return;}
    vaults.put({id:handle.id,salt:handle.salt,ownerHash:handle.ownerHash,revision:handle.revision+1,savedAt:document.savedAt,document:encrypted} satisfies VaultRow);
    if(photo&&file)transaction.objectStore("files").put({id:`${handle.id}:${photo.id}`,vaultId:handle.id,...file});
  };
  await done;return {...handle,revision:handle.revision+1};
}
export async function readOfflinePhoto(handle:VaultHandle,id:string,filename:string,contentType:string):Promise<File>{
  const connection=await db();const row=await result<Cipher|undefined>(connection.transaction("files").objectStore("files").get(`${handle.id}:${id}`));
  if(!row)throw new Error("This saved photo is unavailable. Keep the draft and select the original photo again.");
  return new File([await decrypt(handle.key,row,`${handle.id}:photo:${id}`)],filename,{type:contentType});
}
export async function deleteOfflineVault(id:string){
  const connection=await db();const transaction=connection.transaction(["vaults","files"],"readwrite");const done=complete(transaction);
  transaction.objectStore("vaults").delete(id);
  const cursor=transaction.objectStore("files").index("vaultId").openCursor(IDBKeyRange.only(id));
  cursor.onsuccess=()=>{if(cursor.result){cursor.result.delete();cursor.result.continue();}};
  await done;
}
