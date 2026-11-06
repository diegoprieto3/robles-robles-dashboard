const {withAuth,json}=require('./_auth');
exports.handler=withAuth(async(event)=>{
 if(event.httpMethod!=='GET')return json(405,{error:'method'});
 const id=process.env.VAPI_ASSISTANT_ID,key=process.env.VAPI_API_KEY;
 if(!id||!key)return json(500,{error:'calls not configured'});
 const callId=(event.queryStringParameters||{}).callId;
 if(callId&&!/^[0-9a-f-]{36}$/i.test(callId))return json(400,{error:'invalid call id'});
 const url=callId?`https://api.vapi.ai/call/${encodeURIComponent(callId)}`:`https://api.vapi.ai/call?limit=1000&assistantId=${encodeURIComponent(id)}`;
 const res=await fetch(url,{headers:{Authorization:'Bearer '+key}});
 let text=await res.text();
 if(callId&&res.ok){const data=JSON.parse(text);if(data.assistantId!==id)return json(403,{error:'forbidden'});}
 return {statusCode:res.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:text};
});
