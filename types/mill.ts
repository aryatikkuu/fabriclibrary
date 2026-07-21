export interface Mill {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  country: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
