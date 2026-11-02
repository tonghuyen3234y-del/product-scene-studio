import {requireUser} from '../lib/auth.js';
import {randomUUID} from 'node:crypto';
import {userClient,BUCKET,storageError} from '../lib/works.js';
import {MAX_IMAGE,base,headers,sign,checkOrigin,readBody,json,upstreamError} from '../lib/dify.js';
export const config={api:{bodyParser:false}};
export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'不支持此请求。'});
  try{
    checkOrigin(req);
    const account=await requireUser(req);
    const bytes=await readBody(req,MAX_IMAGE);
    const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
    if(!jpeg&&!png&&!webp)throw new Error('请选择有效的 JPG、PNG 或 WebP 图片。');
    const type=jpeg?'image/jpeg':png?'image/png':'image/webp';
    const user=account.id;
    const options=new URL(req.url,'http://localhost').searchParams,ratio=options.get('ratio'),scene=options.get('scene'),count=Number(options.get('count'));
    if(!['1:1','3:4','4:3','2:3','3:2','16:9','9:16'].includes(ratio)||!['两种都要','纯商品展示场景','人机交互场景'].includes(scene)||!Number.isInteger(count)||count<1||count>4)throw new Error('生成参数无效。');
    const client=userClient(req),workId=randomUUID(),originalPath=`${user}/${workId}/original.${jpeg?'jpg':png?'png':'webp'}`;
    const {error:rowError}=await client.from('studio_works').insert({id:workId,user_id:user,ratio,scene,requested_count:count,original_path:originalPath});
    if(rowError)throw storageError();
    const {error:uploadError}=await client.storage.from(BUCKET).upload(originalPath,bytes,{contentType:type,upsert:false});
    if(uploadError)throw storageError();
    const form=new FormData();form.append('user',user);form.append('file',new Blob([bytes],{type}),`product.${jpeg?'jpg':png?'png':'webp'}`);
    const response=await fetch(`${base}/files/upload`,{method:'POST',headers:headers(),body:form,signal:AbortSignal.timeout(45000)});
    if(!response.ok)return json(res,502,{error:await upstreamError(response)});
    const file=await response.json();
    if(!file.id)throw new Error('上传未完成，请重试。');
    json(res,200,{token:sign({kind:'upload',user,fileId:file.id,workId})});
  }catch(error){json(res,error.status||400,{error:error.name==='TimeoutError'?'上传超时，请稍后重试。':error.message});}
}
