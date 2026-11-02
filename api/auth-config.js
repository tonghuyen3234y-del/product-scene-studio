import {json} from '../lib/dify.js';
export default function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'不支持此请求。'});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_PUBLISHABLE_KEY)return json(res,503,{error:'账号服务尚未配置。'});
  json(res,200,{url:process.env.SUPABASE_URL,publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY});
}
