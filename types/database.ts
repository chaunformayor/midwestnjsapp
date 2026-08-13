export type Role = 'admin' | 'investor' | 'pending'
export type DealStatus = 'submitted' | 'reviewing' | 'presented' | 'under_contract' | 'closed' | 'passed'
export type ContactStatus = 'new' | 'read' | 'replied' | 'archived'
export type PostCategory = 'market-report' | 'deal-breakdown' | 'strategy' | 'education'
export type ResourceType = 'template' | 'guide' | 'report' | 'reference' | 'video'
export type SubscriberStatus = 'active' | 'unsubscribed'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  state: string | null
  role: Role
  approved_at: string | null
  approved_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  title: string
  slug: string
  content: string | null
  excerpt: string | null
  category: PostCategory
  read_time: string | null
  published: boolean
  published_at: string | null
  author_id: string | null
  created_at: string
  updated_at: string
}

export interface DealSubmission {
  id: string
  submitter_id: string | null
  submitter_email: string
  submitter_name: string | null
  submitter_phone: string | null
  submitter_role: string | null
  address: string
  price: string | null
  property_type: string | null
  beds: number | null
  baths: number | null
  sqft: string | null
  year_built: string | null
  arv: string | null
  rehab_estimate: string | null
  rent_estimate: string | null
  condition: string | null
  occupied: string | null
  deadline: string | null
  notes: string | null
  status: DealStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export interface ContactSubmission {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  inquiry_type: string | null
  state: string | null
  message: string
  referral_source: string | null
  status: ContactStatus
  created_at: string
}

export interface Subscriber {
  id: string
  email: string
  name: string | null
  status: SubscriberStatus
  source: string | null
  created_at: string
}

export interface Resource {
  id: string
  title: string
  description: string | null
  type: ResourceType | null
  file_url: string | null
  file_name: string | null
  file_size: string | null
  published: boolean
  order_index: number
  created_at: string
  updated_at: string
}
