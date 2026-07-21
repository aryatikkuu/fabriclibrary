-- ===========================================================================
-- Seed data: initial mills. Fabrics are imported from hanger photos.
-- ===========================================================================

insert into public.mills (name, slug, description, country) values
  ('Masood Textile Mills', 'masood-textile-mills',
   'Vertically integrated knitwear specialist. Single jerseys, interlocks, pique, fleece and performance knits.',
   'Pakistan'),
  ('Banswara Syntex', 'banswara-syntex',
   'Spinning-to-fabric house known for yarn-dyed suiting, viscose blends and technical wovens.',
   'India'),
  ('Orbit Exports', 'orbit-exports',
   'Specialist in novelty wovens — jacquards, satins, lurex and occasionwear qualities.',
   'India')
on conflict (slug) do nothing;
