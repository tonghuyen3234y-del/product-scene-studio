import { createHmac, timingSafeEqual } from 'node:crypto';
export const MAX_IMAGE = 3_000_000;
export const base = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
export function headers(){
  if(!process.env.DIFY_API_KEY)throw new Error('服务尚未配置，请联系管理员。');
  return {Authorization:`Bearer ${process.env.DIFY_API_KEY}`};
}
export function sign(data){
  const payload=Buffer.from(JSON.stringify({...data,expires:Date.now()+24*60*60*1000})).toString('base64url');
  return `${payload}.${createHmac('sha256',process.env.DIFY_API_KEY).update(payload).digest('base64url')}`;
}
export function verify(token){
  const [payload,mac]=String(token||'').split('.');
  if(!payload||!mac)throw new Error('请求已失效，请重新生成。');
  const expected=createHmac('sha256',process.env.DIFY_API_KEY).update(payload).digest();
  const actual=Buffer.from(mac,'base64url');
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error('请求无效。');
  const data=JSON.parse(Buffer.from(payload,'base64url').toString());
  if(data.expires<Date.now())throw new Error('图片链接已过期，请重新生成。');
  return data;
}
export function checkOrigin(req){
  const origin=req.headers.origin;
  if(origin&&new URL(origin).host!==req.headers.host)throw new Error('请从本站发起请求。');
}
export async function readBody(req,limit=MAX_IMAGE){
  if(Number(req.headers['content-length'])>limit)throw new Error('图片过大，请选择压缩后的图片。');
  if(req.body!==undefined){
    const body=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body));
    if(body.length>limit)throw new Error('请求过大。');
    return body;
  }
  let size=0;const parts=[];
  for await(const part of req){size+=part.length;if(size>limit)throw new Error('请求过大。');parts.push(part);}
  return Buffer.concat(parts);
}
export function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));}
export async function upstreamError(response){
  let code='';try{code=(await response.json()).code||'';}catch{}
  if(response.status===401||response.status===403)return 'Dify 服务认证失败，请联系管理员检查 API 配置。';
  if(response.status===429)return '生成服务繁忙或额度不足，请稍后再试。';
  if(code==='provider_not_initialize'||code==='provider_quota_exceeded')return 'Dify 模型未配置或额度不足，请联系管理员。';
  return `生成服务请求失败（${response.status}），请稍后再试。`;
}
