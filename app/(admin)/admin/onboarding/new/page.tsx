import { getSettings } from '@/lib/onboarding/server'
import NewClientForm from '@/components/onboarding/NewClientForm'

export const dynamic = 'force-dynamic'

export default async function NewClientPage() {
  const settings = await getSettings().catch(() => ({ entity_type: '', office_address: '', signer_name: 'Chaun', signer_title: '' }))
  return <NewClientForm initialSettings={settings} />
}
