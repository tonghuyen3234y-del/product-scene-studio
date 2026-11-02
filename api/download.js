import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {isIP,BlockList} from 'node:net';
import {lookup} from 'node:dns/promises';
import {verify,json} from '../lib/dify.js';
import {requireUser} from '../lib/auth.js';
const privateIPs=new BlockList();
for(const [net,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['100.64.0.0',10],['224.0.0.0',4],['240.0.0.0',4]])privateIPs.addSubnet(net,prefix,'ipv4');
for(const [net,prefix] of [['::',128],['::1',128],['fc00::',7],['fe80::',10],['ff00::',8]])privateIPs.addSubnet(net,prefix,'ipv6');
async function publicURL(value){
  const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port)throw new Error('图片地址无效。');
  const host=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=isIP(host)?[{address:host}]:await lookup(host,{all:true});
  if(!addresses.length||addresses.some(({address:a})=>privateIPs.check(a,a.includes(':')?'ipv6':'ipv4')))throw new Error('图片地址不可下载。');
  return url;
}
export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'不支持此请求。'});
  try{
    const account=await requireUser(req);
    const token=new URL(req.url,'http://localhost').searchParams.get('token');const image=verify(token);if(image.kind!=='image')throw new Error('下载链接无效。');
    if(image.user!==account.id){const error=new Error('此图片不属于当前账号。');error.status=403;throw error;}
    let url=await publicURL(image.url),response;
    for(let i=0;i<4;i++){
      response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(45000)});
      if([301,302,303,307,308].includes(response.status)){url=await publicURL(new URL(response.headers.get('location'),url).href);continue;}break;
    }
    if(!response?.ok||!response.headers.get('content-type')?.startsWith('image/'))throw new Error('图片暂时无法下载，请稍后再试。');
    const type=response.headers.get('content-type');const ext=type.includes('png')?'png':type.includes('webp')?'webp':'jpg';
    res.setHeader('Content-Type',type);res.setHeader('Content-Disposition',`attachment; filename="product-scene.${ext}"`);res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
    await pipeline(Readable.fromWeb(response.body),res);
  }catch(error){if(!res.headersSent)json(res,error.status||400,{error:error.message});else res.destroy();}
}
