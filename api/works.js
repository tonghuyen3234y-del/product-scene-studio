import {requireUser} from '../lib/auth.js';
import {json} from '../lib/dify.js';
import {userClient,findWork,publicWork,storageError} from '../lib/works.js';
export default async function handler(req,res){
 if(req.method!=='GET')return json(res,405,{error:'不支持此请求。'});
 try{const user=await requireUser(req),client=userClient(req),url=new URL(req.url,'http://localhost'),id=url.searchParams.get('id');
 if(id)return json(res,200,{work:publicWork(await findWork(client,user.id,id))});
 const page=Math.max(0,Math.min(100000,Number(url.searchParams.get('page'))||0));
 if(!Number.isInteger(page))return json(res,400,{error:'页码无效。'});
 const {data,error}=await client.from('studio_works').select('*').eq('user_id',user.id).eq('status','complete').order('completed_at',{ascending:false}).order('id',{ascending:false}).range(page*20,page*20+20);
 if(error)throw storageError();json(res,200,{works:data.slice(0,20).map(publicWork),hasMore:data.length>20});
 }catch(e){json(res,e.status||500,{error:e.message});}
}
