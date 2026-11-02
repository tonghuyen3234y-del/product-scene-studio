export async function requireUser(req){
  const token=/^Bearer\s+(.+)$/i.exec(req.headers.authorization||'')?.[1];
  if(!token){const error=new Error('请先登录后再生成。');error.status=401;throw error;}
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_PUBLISHABLE_KEY){const error=new Error('账号服务尚未配置。');error.status=503;throw error;}
  let response;
  try{response=await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});}catch{const error=new Error('账号验证服务暂时无法连接，请稍后重试。');error.status=503;throw error;}
  if(!response.ok){const error=new Error(response.status>=500?'账号服务暂时不可用。':'登录已失效，请重新登录。');error.status=response.status>=500?503:401;throw error;}
  const user=await response.json();
  if(!user.id){const error=new Error('登录已失效，请重新登录。');error.status=401;throw error;}
  if(user.is_anonymous||!user.email){const error=new Error('请使用邮箱账号登录后再生成。');error.status=401;throw error;}
  return user;
}
