import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => new Response('ok', { headers: { 'cache-control': 'no-store' } });
