import {compressImage} from './image-compression.js';
import {exampleNames,exampleImages,sampleImage} from './studio-data.js';
const $=id=>document.getElementById(id);
let reference=null,turns=[],busy=false,uploading=false,version=0,controller=null,conversationId='',owner=null,toastTimer,previewImages=[],previewIndex=0,previewTrigger;
const urls=new Set();const privateURLs=new Set();let worksEpoch=0,worksPage=0,worksLoading=false,lastAuthUser=null;
function notify(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
function go(page){$('home-nav').classList.toggle('side-active',page==='home');$('chat-nav').classList.toggle('side-active',page==='chat');$('works-nav').classList.toggle('side-active',page==='works');$('home').hidden=page!=='home';$('chat').hidden=page!=='chat';$('works').hidden=page!=='works';$('chat-nav').hidden=!turns.length;$('return-note').hidden=page!=='home'||!turns.length;window.scrollTo(0,0);}
function referenceView(){ $('attachment').hidden=!reference;if(reference){$('reference-preview').src=reference.src;$('reference-name').textContent=reference.name;$('attachment').title=reference.name;} }
function buttonState(){const text=busy?'生成中…':window.studioAuth?.user?'生成 ↗':'登录后生成 ↗';$('start').textContent=text;$('start').disabled=busy||uploading;$('send').disabled=busy;$('followup').disabled=busy;$('file').disabled=busy;$('remove-image').disabled=busy;['ratio','scene','count'].forEach(id=>$(id).disabled=busy);}
async function upload(file){if(!file||busy)return;const ticket=++version;uploading=true;buttonState();$('upload-error').hidden=true;
 try{const blob=await compressImage(file);if(ticket!==version)return;const src=URL.createObjectURL(blob);urls.add(src);reference={blob,src,name:file.name};referenceView();$('home-error').hidden=true;}
 catch(e){if(ticket===version){$('upload-error').textContent=e.message;$('upload-error').hidden=false;}}
 finally{if(ticket===version){uploading=false;buttonState();$('file').value='';}}
}
$('file').onchange=e=>upload(e.target.files[0]);
$('remove-image').onclick=()=>{if(busy)return;version++;reference=null;referenceView();};
$('use-example').onclick=async()=>{if(busy)return;const r=await fetch(sampleImage);await upload(new File([await r.blob()],'示例商品.jpg',{type:'image/jpeg'}));$('brief').value='为这款商品生成自然窗光下的场景，背景简洁，保留商品细节。';};
$('pet').onclick=()=>{$('pet').classList.add('nod');setTimeout(()=>$('pet').classList.remove('nod'),250);};
function configuration(){return{ratio:$('ratio').value,scene:$('scene').value,count:Number($('count').value),reference};}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
async function download(image){
 try{const headers=image.download?.startsWith('/api/')?{Authorization:`Bearer ${await window.studioAuth.getToken()}`}:{},response=await fetch(image.download||image.src,{headers});
 if(!response.ok){let message='图片下载失败，请稍后重试。';try{message=(await response.json()).error||message;}catch{}throw new Error(message);}
 const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`场景图片.${blob.type.includes('png')?'png':blob.type.includes('webp')?'webp':'jpg'}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(e){notify(e.message);}
}
function render(){const root=$('messages');root.replaceChildren();
 turns.forEach((turn,index)=>{
  const article=el('article','turn');article.id=`turn-${index}`;
  const user=el('div','user');user.append(el('p','',turn.prompt));
  if(index===0){const img=el('img');img.src=turn.config.reference.src;img.alt='商品参考图';user.append(img);}
  user.append(el('div','chips',`${turn.config.ratio} · ${turn.config.scene} · ${turn.config.count} 张`));
  const agent=el('div','agent'),name=el('div','agent-name');name.append(el('span','dot','✳'),document.createTextNode('场景创作助手'));agent.append(name);
  if(turn.status==='loading'){
   const status=el('div','status');status.append(el('span','spinner'),el('span','',turn.stage),el('span','progress-time',`已等待 ${Math.floor((Date.now()-turn.started)/1000)} 秒`));agent.append(status);
   const wall=el('div','wall');wall.style.setProperty('--ratio',turn.config.ratio.replace(':','/'));for(let i=0;i<turn.config.count;i++)wall.append(el('div','skeleton',''));agent.append(wall);
  }else if(turn.status==='failed'){
   const box=el('div','failed');box.append(el('strong','','本轮生成未完成'),el('p','run-error',turn.error));const retry=el('button','','重试本轮');retry.disabled=busy;retry.onclick=()=>run(turn.prompt,turn.config,index);box.append(retry);agent.append(box);
  }else{
   agent.append(el('p','phase-done',`第 ${index+1} 轮 · ${turn.images.length} 张结果${turn.saved?' · 已保存到我的作品':''}`));if(turn.saveError)agent.append(el('p','save-warning',turn.saveError));const wall=el('div','wall');wall.style.setProperty('--ratio',turn.config.ratio.replace(':','/'));
   turn.images.forEach((image,i)=>{const card=el('div','card'),open=el('button','open');open.setAttribute('aria-label',`放大第 ${index+1} 轮第 ${i+1} 张图片`);const img=el('img');img.src=image.src;img.alt=`商品场景图 ${i+1}`;open.append(img);open.onclick=()=>preview(turn.images,i);const foot=el('div','card-footer'),button=el('button','download','下载');button.onclick=async()=>{button.disabled=true;await download(image);button.disabled=false;};foot.append(el('span','',`场景 ${i+1}`),button);card.append(open,foot);wall.append(card);});agent.append(wall);
  }
  article.append(user,agent);root.append(article);
 });
 const last=turns.at(-1);$('context').textContent=busy?'当前任务生成中':last?`沿用参考图 · ${last.config.ratio} · ${last.config.count} 张`:'';buttonState();
}
async function apiError(response){try{return (await response.json()).error||'请求未成功，请稍后重试。';}catch{return '请求未成功，请稍后重试。';}}
async function run(prompt,config,retryIndex=null){
 if(busy||uploading)return;let accessToken;
 try{accessToken=await window.studioAuth.getToken();}catch(e){notify(e.message);return;}
 if(busy)return;
 if(owner&&owner!==window.studioAuth.user?.id){turns=[];conversationId='';}
 owner=window.studioAuth.user?.id;busy=true;controller=new AbortController();const active=controller;
 const turn={prompt,config,status:'loading',stage:'正在上传商品图…',images:[],started:Date.now()};const index=retryIndex===null?turns.length:retryIndex;if(retryIndex===null)turns.push(turn);else turns[index]=turn;
 render();go('chat');$('turn-'+index).scrollIntoView({block:'start',behavior:'smooth'});
 const timer=setInterval(()=>{const time=$('turn-'+index)?.querySelector('.progress-time');if(time)time.textContent=`已等待 ${Math.floor((Date.now()-turn.started)/1000)} 秒`;},1000),timeout=setTimeout(()=>active.abort(),295000);
 try{
  const response=await fetch('/api/upload?'+new URLSearchParams({ratio:config.ratio,scene:config.scene,count:config.count}),{method:'POST',headers:{'Content-Type':'application/octet-stream',Authorization:`Bearer ${accessToken}`},body:config.reference.blob,signal:active.signal});if(!response.ok)throw new Error(await apiError(response));const uploaded=await response.json();
  const request={token:uploaded.token,ratio:config.ratio,scene:config.scene,count:config.count,query:prompt};if(conversationId)request.conversationId=conversationId;
  const generated=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accessToken}`},body:JSON.stringify(request),signal:active.signal});if(!generated.ok)throw new Error(await apiError(generated));
  const reader=generated.body.getReader(),decoder=new TextDecoder();let pending='',done=false;
  function event(line){if(!line.startsWith('data:'))return;const e=JSON.parse(line.slice(5));if(e.event==='error')throw new Error(e.message);if(e.event==='progress'){turn.stage=e.message;const node=$('turn-'+index)?.querySelector('.status span:nth-child(2)');if(node)node.textContent=e.message;}if(e.event==='complete'){turn.images=e.images;conversationId=e.conversationId||conversationId;turn.saved=e.saved;turn.saveError=e.saveError;done=true;}}
  while(true){const chunk=await reader.read();if(chunk.done)break;pending+=decoder.decode(chunk.value,{stream:true});let position;while((position=pending.indexOf('\n'))!==-1){event(pending.slice(0,position).trim());pending=pending.slice(position+1);}}
  if(pending.trim())event(pending.trim());if(!done||!turn.images.length)throw new Error('连接中断，暂未收到生成图片，请重试。');if(turn.saved)turn.images=await Promise.all(turn.images.map(image=>hydrate(image,accessToken)));turn.status='success';notify(turn.saveError||'生成完成，已保存到我的作品');
 }catch(e){turn.status='failed';turn.error=e.name==='AbortError'?'生成等待超时或登录已退出，请重试。':e.message;}
 finally{clearInterval(timer);clearTimeout(timeout);active.abort();controller=null;busy=false;if(owner===window.studioAuth.user?.id&&turns.includes(turn)){render();$('turn-'+index)?.scrollIntoView({block:'start',behavior:'smooth'});}else buttonState();}
}
$('home-form').onsubmit=async e=>{e.preventDefault();if(busy){go('chat');return;}try{await window.studioAuth.getToken();}catch(e){notify(e.message);return;}if(!reference){$('home-error').textContent='请先上传一张商品图。';$('home-error').hidden=false;return;}$('home-error').hidden=true;turns=[];conversationId='';run($('brief').value.trim()||'请根据参考图和所选参数生成商品场景图。',configuration());};
$('followup-form').onsubmit=e=>{e.preventDefault();if(busy)return;const prompt=$('followup').value.trim();if(!prompt){$('followup-error').textContent='请输入想调整的内容。';$('followup-error').hidden=false;return;}$('followup-error').hidden=true;$('followup').value='';run(prompt,turns.at(-1).config);};
$('home-nav').onclick=$('back').onclick=()=>go('home');$('chat-nav').onclick=$('resume').onclick=()=>go('chat');$('new').onclick=()=>{if(busy)return;turns=[];conversationId='';$('messages').replaceChildren();go('home');};
function preview(images,index){previewImages=images;previewIndex=index;previewTrigger=document.activeElement;updatePreview();$('preview').showModal();$('close-preview').focus();}
function updatePreview(){$('preview-image').src=previewImages[previewIndex].src;$('preview-index').textContent=`${previewIndex+1} / ${previewImages.length}`;$('prev').disabled=$('next').disabled=previewImages.length<2;}
$('preview-download').removeAttribute('href');$('preview-download').removeAttribute('download');$('preview-download').setAttribute('role','button');$('preview-download').tabIndex=0;$('preview-download').onclick=()=>download(previewImages[previewIndex]);$('preview-download').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();download(previewImages[previewIndex]);}};
function switchPreview(delta){previewIndex=(previewIndex+delta+previewImages.length)%previewImages.length;updatePreview();}
$('prev').onclick=()=>switchPreview(-1);$('next').onclick=()=>switchPreview(1);$('close-preview').onclick=()=>$('preview').close();$('preview').onclose=()=>previewTrigger?.focus();document.addEventListener('keydown',e=>{if($('preview').open&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();switchPreview(e.key==='ArrowLeft'?-1:1);}});
exampleNames.forEach((name,i)=>{const button=el('button','example-card'),visual=el('span','visual'),img=el('img');img.src=exampleImages[i];img.alt=name;visual.append(img);button.append(visual,el('span','example-name',name));button.onclick=()=>preview(exampleImages.map(src=>({src})),i);$('example-grid').append(button);});
window.addEventListener('studio-auth-change',e=>{const user=e.detail?.user;if(owner&&owner!==user?.id){controller?.abort();turns=[];conversationId='';owner=null;$('messages').replaceChildren();$('preview').close();go('home');}buttonState();});
window.addEventListener('beforeunload',()=>{controller?.abort();urls.forEach(url=>URL.revokeObjectURL(url));});
go('home');buttonState();

async function hydrate(image,accessToken){
 if(image.src)return image;
 const r=await fetch(image.download,{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'});if(!r.ok)throw new Error(await apiError(r));
 const src=URL.createObjectURL(await r.blob());privateURLs.add(src);return {...image,src};
}
function dateLabel(value){return new Date(value).toLocaleString('zh-CN',{hour12:false});}
function detailURL(id){const url=new URL(location.href);if(id)url.searchParams.set('work',id);else url.searchParams.delete('work');history.replaceState(null,'',url);}
async function listWorks(append=false){
 let token;try{token=await window.studioAuth.getToken();}catch(e){notify(e.message);return;}
 const epoch=++worksEpoch,userId=window.studioAuth.user?.id;worksLoading=true;if(!append)worksPage=0;
 go('works');detailURL(null);$('work-detail').hidden=true;$('works-grid').hidden=false;$('works-title').textContent='我的作品';$('works-back').hidden=true;$('works-more').hidden=true;if(!append)$('works-grid').replaceChildren();$('works-state').textContent='正在加载…';
 try{
  const r=await fetch('/api/works?page='+worksPage,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(!r.ok)throw new Error(await apiError(r));const data=await r.json();if(epoch!==worksEpoch||userId!==window.studioAuth.user?.id)return;
  $('works-state').textContent=data.works.length||append?'':'还没有作品，生成完成后会自动保存在这里。';$('works-more').hidden=!data.hasMore;
  data.works.forEach(work=>{
   const button=el('button','work-tile');const thumb=el('span','work-thumb','正在加载图片…');button.append(thumb,el('strong','',`${work.ratio} · ${work.scene} · ${work.images.length} 张`),el('time','',dateLabel(work.createdAt)));button.onclick=()=>openWork(work.id);$('works-grid').append(button);
   hydrate(work.images[0],token).then(image=>{if(epoch!==worksEpoch||userId!==window.studioAuth.user?.id)return;const img=el('img');img.src=image.src;img.alt='作品预览';thumb.replaceChildren(img);}).catch(()=>{if(epoch===worksEpoch)thumb.textContent='点击查看作品';});
  });
 }catch(e){if(epoch===worksEpoch)$('works-state').textContent=e.message;}
 finally{if(epoch===worksEpoch)worksLoading=false;}
}
async function openWork(id){
 let token;try{token=await window.studioAuth.getToken();}catch(e){notify(e.message);return;}
 const epoch=++worksEpoch,userId=window.studioAuth.user?.id;go('works');detailURL(id);$('works-grid').hidden=true;$('work-detail').hidden=false;$('work-detail').replaceChildren();$('works-more').hidden=true;$('works-back').hidden=false;$('works-title').textContent='作品详情';$('works-state').textContent='正在加载…';
 try{
  const r=await fetch('/api/works?id='+encodeURIComponent(id),{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(!r.ok)throw new Error(await apiError(r));const {work}=await r.json();
  const [original,images]=await Promise.all([hydrate(work.original,token),Promise.all(work.images.map(image=>hydrate(image,token)))]);if(epoch!==worksEpoch||userId!==window.studioAuth.user?.id)return;
  const ref=el('div','work-reference'),open=el('button'),img=el('img');img.src=original.src;img.alt='本次商品参考图';open.setAttribute('aria-label','放大本次商品原图');open.append(img);open.onclick=()=>preview([original],0);
  const description=el('div');description.append(el('span','',`${work.ratio} · ${work.scene} · 选择 ${work.count} 张 · 实际 ${images.length} 张`),el('time','',dateLabel(work.createdAt)));ref.append(open,description);
  const wall=el('div','wall');wall.style.setProperty('--ratio',work.ratio.replace(':','/'));
  images.forEach((image,i)=>{const card=el('div','card'),button=el('button','open'),photo=el('img');photo.src=image.src;photo.alt=`作品图片 ${i+1}`;button.setAttribute('aria-label',`放大作品第 ${i+1} 张图片`);button.append(photo);button.onclick=()=>preview(images,i);const foot=el('div','card-footer'),save=el('button','download','下载');save.onclick=()=>download(image);foot.append(el('span','',`场景 ${i+1}`),save);card.append(button,foot);wall.append(card);});
  $('work-detail').append(ref,wall);$('works-state').textContent='';
 }catch(e){if(epoch===worksEpoch)$('works-state').textContent=e.message;}
}
$('works-nav').onclick=()=>listWorks();$('works-back').onclick=()=>listWorks();$('works-more').onclick=()=>{if(!worksLoading){worksPage++;listWorks(true);}};
window.addEventListener('studio-auth-change',e=>{
 const id=e.detail?.user?.id||null;if(lastAuthUser!==id){worksEpoch++;worksLoading=false;$('works-grid').replaceChildren();$('work-detail').replaceChildren();$('preview').close();privateURLs.forEach(url=>URL.revokeObjectURL(url));privateURLs.clear();if(lastAuthUser){reference=null;referenceView();version++;}lastAuthUser=id;}
 const deepLink=new URL(location.href).searchParams.get('work');if(id&&deepLink)openWork(deepLink);if(!id&&!$('works').hidden){$('works-state').textContent='请登录后查看自己的作品。';$('works-more').hidden=true;}
});
