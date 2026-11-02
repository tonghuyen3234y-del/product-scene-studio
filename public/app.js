const $=id=>document.getElementById(id);
const MAX_BYTES=3_000_000;
let selected=null,previewURL=null,selectionVersion=0,busy=false,activeController=null;
window.addEventListener("studio-auth-change",e=>{if(!busy)$("generate").textContent=e.detail?.user?"生成":"登录后生成";if(!e.detail?.user){activeController?.abort();$("gallery").replaceChildren();$("result-count").textContent="";$("download-hint").hidden=true;}});
const showError=message=>{$('error').textContent=message;$('error').hidden=false;};
const sizeText=n=>n<1_000_000?`${Math.round(n/1000)} KB`:`${(n/1_000_000).toFixed(2)} MB`;
async function compressImage(file){
  let source=file;
  const decode=blob=>new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob);const image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('无法读取图片，请换一张 JPG、PNG、WebP 或 HEIC 照片。'));};image.src=url;});
  let image;
  try{image=await decode(source);}catch(error){
    if(!/hei[cf]/i.test(file.type+' '+file.name))throw error;
    if(!window.heic2any)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/heic2any.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('照片转换组件加载失败，请重试。'));document.head.append(script);});
    try{source=await window.heic2any({blob:file,toType:'image/jpeg',quality:0.9});if(Array.isArray(source))source=source[0];image=await decode(source);}catch{throw new Error('这张 HEIC 照片暂时无法读取，请导出为 JPG 后上传。');}
  }
  const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('浏览器不支持图片处理，请换一个浏览器。');
  let scale=Math.min(1,2560/Math.max(image.naturalWidth,image.naturalHeight));
  for(let round=0;round<8;round++){
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    for(const quality of [0.92,0.82,0.7,0.58]){
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
      if(blob&&blob.size<=MAX_BYTES){canvas.width=canvas.height=0;return blob;}
    }
    scale*=0.75;
  }
  throw new Error('图片压缩失败，请尝试另一张图片。');
}
async function choose(file){
  if(busy||!file)return;
  const version=++selectionVersion;selected=null;$('generate').disabled=true;$('error').hidden=true;
  $('file-info').textContent='正在浏览器内处理图片…';
  try{
    if(!file.type.startsWith('image/')&&!/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name))throw new Error('请选择一张商品图片。');
    const blob=await compressImage(file);
    if(version!==selectionVersion)return;
    selected=blob;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(blob);
    $('preview').src=previewURL;$('preview').hidden=false;$('upload-prompt').hidden=true;
    $('file-info').textContent=`${file.name} · ${sizeText(file.size)} → ${sizeText(blob.size)}，已准备好上传`;
    $('generate').disabled=false;
  }catch(error){if(version===selectionVersion){$('file-info').textContent='请选择另一张图片。';showError(error.message);}}
}
$('product-image').addEventListener('change',e=>choose(e.target.files[0]));
const zone=document.querySelector('.upload-area');
zone.addEventListener('dragover',e=>{e.preventDefault();if(!busy)zone.classList.add('dragging');});
zone.addEventListener('dragleave',()=>zone.classList.remove('dragging'));
zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragging');if(!busy){$('product-image').required=false;choose(e.dataTransfer.files[0]);}});
function progress(message){
  $('progress-title').textContent=message;
  const steps=$('steps');if(steps.lastElementChild?.textContent!==message){const li=document.createElement('li');li.textContent=message;steps.append(li);}
}
function renderImages(images,ratio){
  $('gallery').replaceChildren();$('gallery').style.setProperty('--ratio',ratio.replace(':',' / '));
  images.forEach((image,index)=>{
    const card=document.createElement('figure');card.className='image-card';
    const img=document.createElement('img');img.src=image.src;img.alt=`商品场景图 ${index+1}`;
    img.addEventListener('error',()=>{const note=document.createElement('p');note.className='image-error';note.textContent='图片预览暂时无法加载，可以尝试下载。';card.prepend(note);},{once:true});
    const bottom=document.createElement('figcaption');bottom.className='card-bottom';const label=document.createElement('span');label.textContent=`场景 ${String(index+1).padStart(2,'0')}`;
    const button=document.createElement('button');button.type='button';button.className='download';button.textContent='下载图片';
    button.addEventListener('click',async()=>{
      button.disabled=true;button.textContent='下载中…';$('error').hidden=true;
      try{const accessToken=await window.studioAuth.getToken();const r=await fetch(image.download,{headers:{Authorization:`Bearer ${accessToken}`}});if(!r.ok){const data=await r.json();throw new Error(data.error||'下载失败，请稍后重试。');}const blob=await r.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`商品场景图-${index+1}.${blob.type.includes('png')?'png':blob.type.includes('webp')?'webp':'jpg'}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(error){showError(error.message);}finally{button.disabled=false;button.textContent='下载图片';}
    });
    bottom.append(label,button);card.append(img,bottom);$('gallery').append(card);
  });
  $('result-count').textContent=`${images.length} 张`;$('download-hint').hidden=false;
}
$('generate-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!selected||busy)return;
  let accessToken;try{accessToken=await window.studioAuth.getToken();}catch(error){showError(error.message);return;}if(busy)return;
  busy=true;$('controls').disabled=true;$('generate').textContent='生成中…';$('error').hidden=true;$('empty').hidden=true;$('gallery').replaceChildren();$('result-count').textContent='';$('download-hint').hidden=true;
  $('progress').hidden=false;$('progress').classList.remove('finished');$('steps').replaceChildren();progress('正在上传商品图…');
  const started=Date.now();const tick=()=>{$('elapsed').textContent=`${Math.floor((Date.now()-started)/1000)} 秒`;};tick();const timer=setInterval(tick,1000);
  const controller=new AbortController();activeController=controller;const timeout=setTimeout(()=>controller.abort(),295000);let completed=false;
  try{
    const upload=await fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream',Authorization:`Bearer ${accessToken}`},body:selected,signal:controller.signal});
    const data=await upload.json();if(!upload.ok)throw new Error(data.error||'上传失败，请重试。');
    progress('上传完成，正在启动生成…');
    const ratio=$('ratio').value;
    const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accessToken}`},body:JSON.stringify({token:data.token,ratio,scene:$('scene').value,count:Number($('count').value)}),signal:controller.signal});
    if(!response.ok){const data=await response.json();throw new Error(data.error||'生成请求失败。');}
    const reader=response.body.getReader();const decoder=new TextDecoder();let pending='';
    const handle=line=>{
      if(!line.startsWith('data:'))return;const event=JSON.parse(line.slice(5));
      if(event.event==='progress')progress(event.message);
      if(event.event==='error')throw new Error(event.message);
      if(event.event==='complete'){completed=true;renderImages(event.images,ratio);progress(`生成完成，共 ${event.images.length} 张`);if(event.images.length<Number($('count').value))showError(`本次返回 ${event.images.length} 张，少于请求数量，可调整参数后重新生成。`);}
    };
    while(true){const {value,done}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});let i;while((i=pending.indexOf('\n'))!==-1){handle(pending.slice(0,i).trim());pending=pending.slice(i+1);}}
    if(pending.trim())handle(pending.trim());if(!completed)throw new Error('连接中断，尚未收到生成结果，请重试。');
  }catch(error){showError(error.name==='AbortError'?'生成等待超时，请稍后重试。':error.message);$('progress-title').textContent='本次生成未完成';}
  finally{clearInterval(timer);clearTimeout(timeout);controller.abort();$('progress').classList.add('finished');busy=false;$('controls').disabled=false;activeController=null;$('generate').textContent=window.studioAuth?.user?'生成':'登录后生成';$('generate').disabled=!selected;}
});
