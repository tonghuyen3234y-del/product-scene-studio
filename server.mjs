import http from 'node:http';
import {readFile} from 'node:fs/promises';
import upload from './api/upload.js';
import authConfig from './api/auth-config.js';
import generate from './api/generate.js';
import download from './api/download.js';
import works from './api/works.js';
import workImage from './api/work-image.js';
const routes={'/api/works':works,'/api/work-image':workImage,'/api/auth-config':authConfig,'/api/upload':upload,'/api/generate':generate,'/api/download':download};
const files={'/':'index.html','/controls.js':'controls.js','/ui.css':'ui.css','/studio.js':'studio.js','/studio-data.js':'studio-data.js','/image-compression.js':'image-compression.js','/app.js':'app.js','/auth.js':'auth.js','/vendor/supabase.js':'vendor/supabase.js','/app.css':'app.css','/heic2any.min.js':'heic2any.min.js'};
http.createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    if(routes[path])return await routes[path](req,res);
    if(!files[path]){res.writeHead(404);return res.end('Not found');}
    const content=await readFile(new URL(`./public/${files[path]}`,import.meta.url));
    res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');res.end(content);
  }catch{res.writeHead(500);res.end('Server error');}
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
