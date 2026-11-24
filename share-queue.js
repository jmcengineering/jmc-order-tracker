// JMC Order Tracker — shared-file queue (IndexedDB).
// Loaded by BOTH the service worker (importScripts) and the page (<script>),
// so the code that writes a shared file and the code that reads it are the same.
// Records:
//   PDF:        {id, kind:'pdf', name, type, size, blob, receivedAt, status, error}
//   Image set:  {id, kind:'images', name:'<first image>.pdf' (name of the PDF built from them),
//                images:[names], blobs:[{name,type,blob}], size, receivedAt, status, error}
//   status: 'pending' | 'rejected' | 'failed' | 'cancelled' | 'duplicate'
(function(root){
  const DB_NAME='jmc-share', STORE='queue', DB_VER=1;
  const MAX_BYTES=25*1024*1024; // 25 MB per file — larger files are refused with a clear message
  const IMAGE_TYPES=['image/jpeg','image/png','image/webp'];

  function open(){
    return new Promise((res,rej)=>{
      const r=indexedDB.open(DB_NAME,DB_VER);
      r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};
      r.onsuccess=()=>res(r.result);
      r.onerror=()=>rej(r.error);
    });
  }
  async function tx(mode,fn){
    const db=await open();
    return new Promise((res,rej)=>{
      const t=db.transaction(STORE,mode);const st=t.objectStore(STORE);
      let out;Promise.resolve(fn(st)).then(v=>{out=v;});
      t.oncomplete=()=>{db.close();res(out);};
      t.onerror=()=>{db.close();rej(t.error);};
      t.onabort=()=>{db.close();rej(t.error);};
    });
  }
  function reqP(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
  const newId=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  const lname=f=>String(f&&f.name||'').toLowerCase();
  const mb=b=>(b/1048576).toFixed(1)+' MB';

  function isPdf(file){return (file&&file.type==='application/pdf')||lname(file).endsWith('.pdf');}
  // Anything that claims to be an image (so HEIC/GIF etc. get a precise "can't read" message)
  function looksLikeImage(file){return /^image\//.test(file&&file.type||'')||/\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff?)$/.test(lname(file));}
  function isReadableImage(file){return IMAGE_TYPES.includes(file&&file.type)||/\.(jpe?g|png|webp)$/.test(lname(file));}

  // Validation happens once, at the moment of sharing, so the page can say exactly why a file was refused.
  function classify(file){
    if(isPdf(file)){
      if(file.size>MAX_BYTES)return{status:'rejected',error:'File too large ('+mb(file.size)+'). Limit is '+(MAX_BYTES/1048576)+' MB.'};
      if(file.size===0)return{status:'rejected',error:'File is empty.'};
      return{status:'pending',error:'',kind:'pdf'};
    }
    if(looksLikeImage(file)){
      if(!isReadableImage(file))return{status:'rejected',error:'This image type ('+(file.type||'unknown')+') cannot be read. Share drawings as JPG, PNG or PDF.'};
      if(file.size>MAX_BYTES)return{status:'rejected',error:'Image too large ('+mb(file.size)+'). Limit is '+(MAX_BYTES/1048576)+' MB.'};
      if(file.size===0)return{status:'rejected',error:'Image is empty.'};
      return{status:'pending',error:'',kind:'image'};
    }
    return{status:'rejected',error:'Not a PDF or image ('+(file.type||'unknown type')+'). Only drawings (PDF, JPG, PNG) can be imported.'};
  }
  async function put(rec){await tx('readwrite',st=>st.put(rec));return rec;}

  // One shared PDF (or a refused file of any kind)
  async function add(file){
    const c=classify(file);
    return put({
      id:newId(),kind:'pdf',name:file.name||'shared.pdf',type:file.type||'',size:file.size||0,
      blob:c.status==='pending'?new Blob([await file.arrayBuffer()],{type:'application/pdf'}):null,
      receivedAt:new Date().toISOString(),status:c.status,error:c.error
    });
  }
  // All readable images from ONE share become ONE set → one multi-page import (1 parent + 1 part per image).
  async function addImageSet(files){
    const blobs=[];let size=0;
    for(const f of files){blobs.push({name:f.name||'image.jpg',type:f.type||'image/jpeg',blob:new Blob([await f.arrayBuffer()],{type:f.type||'image/jpeg'})});size+=f.size||0;}
    const base=blobs[0].name.replace(/\.[^.]+$/,'');
    return put({
      id:newId(),kind:'images',
      // Name of the PDF built from the images: it is uploaded to "drawings" and used for the duplicate check.
      name:blobs.length===1?base+'.pdf':base+' +'+(blobs.length-1)+' images.pdf',
      images:blobs.map(b=>b.name),blobs,type:'application/pdf',size,
      receivedAt:new Date().toISOString(),status:'pending',error:''
    });
  }
  async function list(){
    const all=await tx('readonly',st=>reqP(st.getAll()));
    return (all||[]).sort((a,b)=>a.receivedAt<b.receivedAt?-1:a.receivedAt>b.receivedAt?1:0);
  }
  async function update(id,patch){
    return tx('readwrite',async st=>{
      const cur=await reqP(st.get(id));if(!cur)return null;
      const next=Object.assign({},cur,patch);st.put(next);return next;
    });
  }
  async function remove(id){return tx('readwrite',st=>st.delete(id));}
  async function count(){return tx('readonly',st=>reqP(st.count()));}

  root.JMCShareQueue={add,addImageSet,list,update,remove,count,classify,MAX_BYTES};
})(typeof self!=='undefined'?self:window);
