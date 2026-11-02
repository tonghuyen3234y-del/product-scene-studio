const MAX_BYTES=3_000_000;
export async function compressImage(file){
  let source=file;
  const decode=blob=>new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob);const image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('无法读取图片，请换一张 JPG、PNG、WebP 或 HEIC 照片。'));};image.src=url;});
  let image;
  try{image=await decode(source);}catch(error){
    if(!/hei[cf]/i.test(file.type+' '+file.name))throw error;
    if(!window.heic2any)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/heic2any.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('照片转换组件加载失败，请重试。'));document.head.append(script);});
    try{source=await window.heic2any({blob:file,toType:'image/jpeg',quality:0.9});if(Array.isArray(source))source=source[0];image=await decode(source);}catch{throw new Error('这张 HEIC 照片暂时无法读取，请导出为 JPG 后上传。');}
  }
  const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('浏览器不支持图片处理，请换一个浏览器。');
  let scale=Math.min(1,2560/Math.max(image.naturalWidth,image.naturalHeight));
  for(let round=0;round<8;round++){
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    for(const quality of [0.92,0.82,0.7,0.58]){
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
      if(blob&&blob.size<=MAX_BYTES){canvas.width=canvas.height=0;return blob;}
    }
    scale*=0.75;
  }
  throw new Error('图片压缩失败，请尝试另一张图片。');
}
