import { receiveUpload } from '@/lib/onboarding/service'
import { ok, withClient } from '@/lib/onboarding/http'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Ctx = { params: Promise<{ token: string }> }

/**
 * Receives one piece of an uploaded file as the raw request body.
 * Query: doc, name, upload (client-made id), index (1-based), total, size.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params
  return withClient(token, async (e) => {
    const u = new URL(req.url)
    const q = {
      doc: u.searchParams.get('doc') ?? '',
      name: u.searchParams.get('name') ?? 'file',
      upload: u.searchParams.get('upload') ?? '',
      index: Number(u.searchParams.get('index')),
      total: Number(u.searchParams.get('total')),
      size: Number(u.searchParams.get('size')),
    }
    const body = Buffer.from(await req.arrayBuffer())
    return ok(await receiveUpload(e, q, body))
  })
}
