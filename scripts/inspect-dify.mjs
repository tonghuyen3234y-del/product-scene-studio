import {readFile,writeFile} from 'node:fs/promises';
const base=process.env.DIFY_API_URL;
const headers={Authorization:`Bearer ${process.env.DIFY_API_KEY}`};
const user=`local-${crypto.randomUUID()}`;
const form=new FormData();
form.append('user',user);
form.append('file',new Blob([await readFile('c7050c3710ac3b55d814ffa0ad82107e.jpg')],{type:'image/jpeg'}),'product.jpg');
const upload=await fetch(`${base}/files/upload`,{method:'POST',headers,body:form});
const file=await upload.json();
if(!upload.ok)throw new Error(`Upload failed: ${upload.status}`);
console.log('商品照上传成功');
const response=await fetch(`${base}/chat-messages`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({inputs:{product_image:{type:'image',transfer_method:'local_file',upload_file_id:file.id},ratio:'1:1',scene:'两种都要',count:2},query:'请根据上传的商品图和所选参数生成商品场景图。',user,response_mode:'streaming',auto_generate_name:false}),signal:AbortSignal.timeout(280000)});
console.log('Chatflow HTTP',response.status);
let raw='',pending='';
for await(const chunk of response.body){const text=new TextDecoder().decode(chunk);raw+=text;pending+=text;let i;while((i=pending.indexOf('\n'))>=0){const line=pending.slice(0,i);pending=pending.slice(i+1);if(line.startsWith('data: ')){const e=JSON.parse(line.slice(6));console.log(e.event,e.data?.title||'',e.data?.status||'',e.event==='error'?e.message:'');}}}
await writeFile('/tmp/product-scene-dify-events.txt',raw);
console.log('真实调用结束，事件已保存在本机临时文件');
