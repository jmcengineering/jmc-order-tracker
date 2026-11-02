// JMC Order Tracker — shared-PDF queue (IndexedDB).
// Loaded by BOTH the service worker (importScripts) and the page (<script>),
// so the code that writes a shared file and the code that reads it are the same.
// Each record: {id, name, type, size, blob, receivedAt, status, error}
//   status: 'pending' | 'rejected' | 'failed' | 'cancelled' | 'duplicate'
(function(root){
  const DB_NAME='jmc-share', STORE='queue', DB_VER=1;
  const MAX_BYTES=25*1024*1024; // 25 MB — larger drawings are rejected with a clear message

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

  function isPdf(file){
    const n=String(file&&file.name||'').toLowerCase();
    return (file&&file.type==='application/pdf')||n.endsWith('.pdf');
  }
  // Validation happens once, at the moment of sharing, so the page can tell the
  // user exactly why a file was refused.
  function classify(file){
    if(!isPdf(file))return{status:'rejected',error:'Not a PDF ('+(file.type||'unknown type')+'). Only PDF drawings can be imported.'};
    if(file.size>MAX_BYTES)return{status:'rejected',error:'File too large ('+(file.size/1048576).toFixed(1)+' MB). Limit is '+(MAX_BYTES/1048576)+' MB.'};
    if(file.size===0)return{status:'rejected',error:'File is empty.'};
    return{status:'pending',error:''};
  }
  async function add(file){
    const c=classify(file);
    const rec={
      id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),
      name:file.name||'shared.pdf',type:file.type||'application/pdf',size:file.size||0,
      // Store a plain Blob; File objects from FormData are fine too but Blob is the safest across browsers.
      blob:c.status==='rejected'?null:new Blob([await file.arrayBuffer()],{type:'application/pdf'}),
      receivedAt:new Date().toISOString(),status:c.status,error:c.error
    };
    await tx('readwrite',st=>st.put(rec));
    return rec;
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

  root.JMCShareQueue={add,list,update,remove,count,classify,MAX_BYTES};
})(typeof self!=='undefined'?self:window);
