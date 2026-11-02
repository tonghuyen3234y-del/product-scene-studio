import {createClient} from '@supabase/supabase-js';
export const BUCKET='studio-works';
export function userClient(req){return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{global:{headers:{Authorization:req.headers.authorization},fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(25000)})},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
export function storageError(){const e=new Error('作品存储尚未就绪或保存失败，请确认已执行 Supabase 建表 SQL 后重试。');e.status=503;return e;}
export function validID(id){return typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);}
export async function findWork(client,user,id,complete=true){
 if(!validID(id)){const e=new Error('作品不存在。');e.status=404;throw e;}
 let q=client.from('studio_works').select('*').eq('id',id).eq('user_id',user);
 if(complete)q=q.eq('status','complete');
 const {data,error}=await q.maybeSingle();if(error)throw storageError();
 if(!data){const e=new Error('作品不存在或无权访问。');e.status=404;throw e;}return data;
}
export function imageEndpoint(id,index){return `/api/work-image?id=${encodeURIComponent(id)}&index=${index}`;}
export function publicWork(work){return {id:work.id,ratio:work.ratio,scene:work.scene,count:work.requested_count,createdAt:work.completed_at||work.created_at,original:{download:imageEndpoint(work.id,'original')},images:work.result_paths.map((_,i)=>({download:imageEndpoint(work.id,i)}))};}
export async function readImage(client,user,work,index){
 const path=index==='original'?work.original_path:work.result_paths[Number(index)];
 if(!path||!path.startsWith(`${user}/${work.id}/`)){const e=new Error('图片不存在或无权访问。');e.status=404;throw e;}
 const {data,error}=await client.storage.from(BUCKET).download(path);if(error)throw storageError();return data;
}
