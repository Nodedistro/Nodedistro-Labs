import 'server-only';
import {HttpError} from '@/lib/db/server';
export async function readLimitedText(body:ReadableStream<Uint8Array>|null,limit:number){if(!body)return '';const reader=body.getReader();let size=0;const chunks:Uint8Array[]=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new HttpError(413,'Payload exceeds the allowed size.');}chunks.push(value);}return new TextDecoder().decode(Buffer.concat(chunks));}finally{reader.releaseLock();}}
