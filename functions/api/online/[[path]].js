export async function onRequest({request,env}){
 if(!env.ARENA_MULTIPLAYER)return Response.json({error:'联机服务正在更新，请稍后重试'},{status:503,headers:{'Cache-Control':'no-store'}});
 return env.ARENA_MULTIPLAYER.fetch(request);
}
