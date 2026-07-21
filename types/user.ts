export type UserRole = 'admin' | 'editor' | 'viewer';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  created_at: string;
}
