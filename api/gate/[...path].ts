import type { VercelRequest, VercelResponse } from '@vercel/node'
import { proxyTo } from '../_proxy'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return proxyTo('https://api.gateio.ws', req, res)
}
