import PortalSidebar from '@/components/portal/Sidebar'

export const dynamic = 'force-dynamic'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-off-white">
      <PortalSidebar />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
