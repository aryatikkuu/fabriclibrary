/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage public URLs. Replace with your own project ref.
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/**' },
    ],
  },
};

export default nextConfig;
