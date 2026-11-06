const {safeEq,mint,verify,json} = require('./_auth');
exports.handler = async (event) => {
  if(event.httpMethod!=='POST') return json(405,{error:'method'});
  if(!process.env.DASHBOARD_PASSWORD || !process.env.DASHBOARD_AUTH_SECRET) return json(500,{error:'auth not configured'});
  let body={}; try{body=JSON.parse(event.body||'{}');}catch{return json(400,{error:'bad json'});}
  if(body.token) return verify(body.token)?json(200,{ok:true}):json(401,{ok:false});
  if(typeof body.password==='string' && safeEq(body.password,process.env.DASHBOARD_PASSWORD)) return json(200,{token:mint()});
  await new Promise(r=>setTimeout(r,600));
  return json(401,{error:'wrong'});
};
