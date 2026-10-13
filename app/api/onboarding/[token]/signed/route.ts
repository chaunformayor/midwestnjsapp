import { getFile } from '@/lib/nextcloud'
import { PATHS } from '@/lib/onboarding/server'
import { fail, withClient } from '@/lib/onboarding/http'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

/** Lets the client download their signed Engagement Agreement and NDA. */
export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params
  return withClient(token, async (e) => {
    if ((e.status !== 'signed' && e.status !== 'submitted') || !e.nextcloud_folder) return fail('The signed agreements are not ready yet.', 404)
    const pdf = await getFile(PATHS.signed(e.nextcloud_folder))
    if (!pdf) return fail('The signed agreements are not ready yet. Try again in a minute.', 404)
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="MIS Engagement Agreement and NDA - signed.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  })
}
