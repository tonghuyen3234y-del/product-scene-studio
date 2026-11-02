import {base,headers,sign,verify,checkOrigin,readBody,json,upstreamError} from '../lib/dify.js';
import {requireUser} from '../lib/auth.js';
import {userClient,findWork,BUCKET,storageError,publicWork} from '../lib/works.js';
import {remoteImage} from '../lib/remote-image.js';
export const config={api:{bodyParser:false}};
const ratios=['1:1','3:4','4:3','2:3','3:2','16:9','9:16'];
const scenes=['两种都要','纯商品展示场景','人机交互场景'];
const stages={'用户输入':'读取生成参数','看图识商品':'识别商品外观','是不是商品图':'确认商品内容','出设计方案':'设计场景方案','写生图提示词':'准备场景细节','编辑图像':'生成场景图片','条件分支 2':'整理生成结果','出图':'准备图片墙'};
export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'不支持此请求。'});
  let heartbeat;const abort=new AbortController();
  res.on('close',()=>{if(!res.writableEnded)abort.abort();});
  const send=(event,data)=>{if(!res.destroyed)res.write(`data: ${JSON.stringify({event,...data})}\n\n`);};
  try{
    checkOrigin(req);
    const account=await requireUser(req);
    const {token,ratio,scene,count,query,conversationId}=JSON.parse((await readBody(req,16000)).toString());
    if(query!==undefined&&(typeof query!=='string'||query.length>1500))throw new Error('需求最多 1500 字。');
    if(conversationId!==undefined&&!/^[a-f0-9-]{36}$/i.test(conversationId))throw new Error('对话标识无效。');
    if(!ratios.includes(ratio)||!scenes.includes(scene)||!Number.isInteger(count)||count<1||count>4)throw new Error('请检查尺寸、场景和数量（1–4 张）。');
    const upload=verify(token);if(upload.kind!=='upload')throw new Error('请先上传商品图。');
    if(upload.user!==account.id){const error=new Error('这张商品图不属于当前账号，请重新上传。');error.status=403;throw error;}
    const client=userClient(req),work=await findWork(client,account.id,upload.workId,false);
    if(work.ratio!==ratio||work.scene!==scene||work.requested_count!==count)throw new Error('生成参数已改变，请重新上传。');
    const {data:claimed,error:claimError}=await client.from('studio_works').update({status:'generating'}).eq('id',work.id).eq('user_id',account.id).eq('status','pending').select('id');
    if(claimError)throw storageError();if(!claimed?.length)throw new Error('该请求已使用，请重新上传。');
    res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('Cache-Control','no-cache, no-transform');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();
    send('progress',{message:'正在连接生成服务…'});
    heartbeat=setInterval(()=>res.write(': keep-alive\n\n'),10000);
    const timeout=setTimeout(()=>abort.abort(),250000);
    let response;
    try{response=await fetch(`${base}/chat-messages`,{method:'POST',headers:{...headers(),'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({inputs:{product_image:{type:'image',transfer_method:'local_file',upload_file_id:upload.fileId},ratio,scene,count},query:query?.trim()||'请根据上传的商品图和所选参数生成商品场景图。',conversation_id:conversationId||'',response_mode:'streaming',user:upload.user,auto_generate_name:false})});
    if(!response.ok)throw new Error(await upstreamError(response));
    let pending='',answer='',finished=false,failed=false,resultConversationId;const decoder=new TextDecoder();const images=new Map();
    function addImage(value){
      try{const url=new URL(value,base);if(url.protocol!=='https:')return;const key=url.origin+url.pathname; if(!images.has(key))images.set(key,{src:url.href,download:`/api/download?token=${encodeURIComponent(sign({kind:'image',url:url.href,user:account.id}))}`});}catch{}
    }
    function collect(value){
      if(Array.isArray(value)){value.forEach(collect);return;}
      if(value&&typeof value==='object'){if(value.type==='image'&&value.url)addImage(value.url);Object.values(value).forEach(collect);return;}
      if(typeof value!=='string')return;
      for(const match of value.matchAll(/!\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+|\/files\/[^\s)]+)(?:\s+"[^"]*")?\s*\)/g))addImage(match[1]);
      if(/^https:\/\/\S+$/.test(value)&&(/\.(png|jpe?g|webp)(?:\?|$)/i.test(value)||value.includes('/file-preview')||value.includes('/image-preview')))addImage(value);
    }
    function event(e){
      if(e.conversation_id)resultConversationId=e.conversation_id;
      if(e.event==='workflow_started')send('progress',{message:'任务已开始，正在处理商品图…'});
      if(e.event==='node_started')send('progress',{message:`正在${stages[e.data?.title]||'处理生成任务'}…`});
      if(e.event==='message')answer+=e.answer||'';
      if(e.event==='message_replace')answer=e.answer||'';
      if(e.event==='message_file'&&e.type==='image')addImage(e.url);
      if(e.event==='error'){failed=true;throw new Error('生成服务返回错误，请稍后重试或检查 Dify 运行日志。');}
      if(e.event==='workflow_finished'){
        if(e.data?.status!=='succeeded'){failed=true;throw new Error('场景图生成失败，请稍后重试或检查 Dify 运行日志。');}
        finished=true;collect(e.data?.outputs);
      }
    }
    for await(const bytes of response.body){pending+=decoder.decode(bytes,{stream:true});let i;while((i=pending.indexOf('\n'))!==-1){const line=pending.slice(0,i).trim();pending=pending.slice(i+1);if(line.startsWith('data:'))event(JSON.parse(line.slice(5)));}}
    if(pending.trim().startsWith('data:'))event(JSON.parse(pending.trim().slice(5)));
    collect(answer);
    if(failed||!finished)throw new Error('生成连接中断，暂未确认完成，请稍后重试。');
    if(!images.size)throw new Error('生成流程已结束，但没有返回图片，请检查 Dify 输出。');
    const generated=[...images.values()].slice(0,count);
    send('progress',{message:'图片已生成，正在保存到我的作品…'});
    try{
      const resultPaths=await Promise.all(generated.map(async(image,index)=>{
        const asset=await remoteImage(image.src),path=`${account.id}/${work.id}/result-${index}.${asset.ext}`;
        const {error}=await client.storage.from(BUCKET).upload(path,asset.bytes,{contentType:asset.type,upsert:false});if(error)throw storageError();return path;
      }));
      const {data:saved,error}=await client.from('studio_works').update({result_paths:resultPaths,status:'complete',completed_at:new Date().toISOString()}).eq('id',work.id).eq('user_id',account.id).eq('status','generating').select('*').single();
      if(error||!saved)throw storageError();
      send('complete',{images:publicWork(saved).images,workId:work.id,saved:true,conversationId:resultConversationId});
    }catch{
      send('complete',{images:generated,saved:false,saveError:'图片已生成，但保存到我的作品失败。本次图片请先下载，稍后重试。',conversationId:resultConversationId});
    }
    }finally{clearTimeout(timeout);}
  }catch(error){const message=error.name==='AbortError'?'等待超时或连接已中断，请稍后重试。':error.message;if(res.headersSent)send('error',{message});else json(res,error.status||400,{error:message});}
  finally{clearInterval(heartbeat);res.end();}
}
