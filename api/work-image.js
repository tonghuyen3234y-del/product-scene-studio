import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {requireUser} from '../lib/auth.js';
import {json} from '../lib/dify.js';
import {userClient,findWork,readImage} from '../lib/works.js';
export default async function handler(req,res){
 if(req.method!=='GET')return json(res,405,{error:'不支持此请求。'});
 try{const user=await requireUser(req),client=userClient(req),url=new URL(req.url,'http://localhost'),index=url.searchParams.get('index');
 if(index!=='original'&&!/^[0-3]$/.test(index||''))return json(res,400,{error:'图片序号无效。'});
 const work=await findWork(client,user.id,url.searchParams.get('id')),blob=await readImage(client,user.id,work,index);
 res.setHeader('Content-Type',blob.type||'image/jpeg');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const ext=blob.type.includes('png')?'png':blob.type.includes('webp')?'webp':'jpg';res.setHeader('Content-Disposition',`inline; filename="scene-${index}.${ext}"`);
 await pipeline(Readable.fromWeb(blob.stream()),res);
 }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.message});else res.destroy();}
}
