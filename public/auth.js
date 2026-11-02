import {createClient} from './vendor/supabase.js';
const el=id=>document.getElementById(id);
let client,mode='login',submitting=false;
let resolveReady;
const ready=new Promise(resolve=>{resolveReady=resolve;});
function message(text){el('auth-message').textContent=text;}
function render(user){
  window.studioAuth.user=user||null;
  el('account-email').textContent=user?.email||'';
  el('account-email').hidden=!user;
  el('account-login').hidden=!!user;
  el('account-logout').hidden=!user;
  window.dispatchEvent(new CustomEvent('studio-auth-change',{detail:{user:user||null}}));
}
function open(){if(!el('auth-dialog').open)el('auth-dialog').showModal();el('auth-email').focus();}
window.studioAuth={user:null,ready,open,async getToken(){
  await ready;
  if(!client){open();throw new Error('账号服务未能加载，请刷新页面重试。');}
  const {data,error}=await client.auth.getSession();
  if(error||!data.session){render(null);open();throw new Error('请先登录后再生成。');}
  return data.session.access_token;
}};
function authError(error){
  const map={invalid_credentials:'邮箱或密码不正确。',email_not_confirmed:'请先打开邮箱中的确认邮件，再登录。',user_already_exists:'该邮箱已注册，请切换到登录。',signup_disabled:'当前未开放注册，请联系管理员。',over_email_send_rate_limit:'确认邮件发送过于频繁，请稍后重试。',over_request_rate_limit:'请求过于频繁，请稍后重试。',weak_password:'密码太弱，请使用更长的密码。',email_address_not_authorized:'当前邮件服务尚未开放，请联系管理员配置 SMTP。',email_address_invalid:'请填写有效邮箱。'};
  return map[error?.code]||(error?.message?.includes('fetch')?'无法连接账号服务，请稍后重试。':'操作未成功，请稍后重试。');
}
el('account-login').onclick=open;
el('auth-close').onclick=()=>el('auth-dialog').close();
el('auth-switch').onclick=()=>{
  mode=mode==='login'?'signup':'login';message('');el('auth-title').textContent=mode==='login'?'登录':'注册';el('auth-submit').textContent=mode==='login'?'登录':'注册';el('auth-switch').textContent=mode==='login'?'还没有账号？注册':'已有账号？登录';el('auth-password').autocomplete=mode==='login'?'current-password':'new-password';
};
el('auth-form').onsubmit=async e=>{
  e.preventDefault();if(submitting)return;submitting=true;el('auth-submit').disabled=true;el('auth-switch').disabled=true;message('正在处理…');
  try{
    await ready;if(!client)throw new Error('fetch failed');
    const email=el('auth-email').value.trim(),password=el('auth-password').value;
    const result=mode==='login'?await client.auth.signInWithPassword({email,password}):await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/'}});
    if(result.error){message(authError(result.error));return;}
    el('auth-password').value='';
    if(result.data.session){render(result.data.user);el('auth-dialog').close();message('');}
    else message('请查收邮箱中的确认邮件；如果账号已存在，请直接登录。');
  }catch(error){message(authError(error));}
  finally{submitting=false;el('auth-submit').disabled=false;el('auth-switch').disabled=false;}
};
el('account-logout').onclick=async()=>{
  el('account-logout').disabled=true;
  try{const {error}=await client.auth.signOut({scope:'local'});if(error){open();message(authError(error));return;}render(null);}catch{open();message('退出失败，请重试。');}finally{el('account-logout').disabled=false;}
};
try{
  const response=await fetch('/api/auth-config',{cache:'no-store'});if(!response.ok)throw new Error('配置不可用');const config=await response.json();
  client=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.onAuthStateChange((_event,session)=>render(session?.user));
  const {data}=await client.auth.getSession();render(data.session?.user);
}catch{render(null);message('账号服务未能加载，请刷新页面重试。');}
finally{resolveReady();}
