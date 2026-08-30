-- Seed: starter investor resource library
-- 4 files are pre-built and served from /resources/* (published=true)
-- 6 require manual file upload via /admin/resources (published=false)

INSERT INTO public.resources (title, description, type, file_url, published, order_index) VALUES

-- Templates (2 need upload, 1 pre-built)
('BRRRR Deal Analyzer Spreadsheet',
 'Full underwriting model for BRRRR deals — purchase, rehab, refinance, and cash flow projections all in one sheet.',
 'template', NULL, false, 1),

('Rental Property Cash Flow Calculator',
 'Input rent, expenses, financing, and vacancy to project monthly/annual cash flow and cash-on-cash return.',
 'template', NULL, false, 2),

('Rental Property Due Diligence Checklist',
 'Step-by-step checklist for evaluating a property before making an offer — covers inspection, title, zoning, rental history, and financials.',
 'template', '/resources/due-diligence-checklist.html', true, 3),

('Lease Agreement Template (Missouri)',
 'Missouri-compliant residential lease template with standard clauses for maintenance, late fees, and termination.',
 'template', NULL, false, 4),

-- Guides (2 pre-built, 1 needs upload)
('First-Time Investor Onboarding Guide',
 'Everything you need to know before your first St. Louis investment property — markets, financing, management, and what to expect.',
 'guide', '/resources/first-time-investor-guide.html', true, 5),

('St. Louis Neighborhood Investment Guide 2026',
 'A submarket-by-submarket breakdown of St. Louis neighborhoods — cap rates, average rents, appreciation trends, and risk profiles.',
 'guide', NULL, false, 6),

('DSCR Loan Guide for Real Estate Investors',
 'How DSCR financing works, what lenders look for, how to qualify, and how to use it to scale your portfolio.',
 'guide', '/resources/dscr-loan-guide.html', true, 7),

-- Reports (need upload)
('St. Louis Market Report Q2 2026',
 'Quarterly data on median prices, days on market, rent trends, vacancy rates, and investor activity across St. Louis metro.',
 'report', NULL, false, 8),

('Section 8 / HCV Payment Standards — St. Louis County 2026',
 'Current Housing Choice Voucher payment standards by bedroom size and zip code for St. Louis County.',
 'report', NULL, false, 9),

-- Reference (pre-built)
('Investor FAQ: Working With Midwest Investor Services',
 'Answers to the most common questions from investors — fees, process, markets, timelines, and what we handle vs. what you decide.',
 'reference', '/resources/investor-faq.html', true, 10);
