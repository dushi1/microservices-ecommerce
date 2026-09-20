-- Dummy catalog. Fixed UUIDs so inventory_db stock rows reference them.
INSERT INTO products (product_id, name, description, price_cents, currency, category, image_url) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Mechanical Keyboard K1', 'Hot-swappable 75% mechanical keyboard with RGB backlight and Gateron Red switches.', 12999, 'USD', 'electronics', 'https://picsum.photos/seed/kbd1/600'),
  ('22222222-2222-4222-8222-222222222222', 'Wireless Mouse M2', 'Ergonomic 2.4GHz wireless mouse with 8000 DPI sensor and silent clicks.', 4999, 'USD', 'electronics', 'https://picsum.photos/seed/mouse2/600'),
  ('33333333-3333-4333-8333-333333333333', '4K Monitor 27"', '27-inch 4K IPS monitor, 99% sRGB, USB-C with 65W power delivery.', 39999, 'USD', 'electronics', 'https://picsum.photos/seed/mon3/600'),
  ('44444444-4444-4444-8444-444444444444', 'USB-C Hub 8-in-1', '8-in-1 USB-C hub: HDMI 4K@60, 2x USB 3.0, SD/microSD, gigabit ethernet, 100W passthrough.', 5999, 'USD', 'electronics', 'https://picsum.photos/seed/hub4/600'),
  ('55555555-5555-4555-8555-555555555555', 'Standing Desk Converter', 'Height-adjustable desk riser for dual monitors, holds up to 15 kg.', 18999, 'USD', 'furniture', 'https://picsum.photos/seed/desk5/600'),
  ('66666666-6666-4666-8666-666666666666', 'Ergonomic Office Chair', 'Mesh-back task chair with adjustable lumbar support and 4D armrests.', 27999, 'USD', 'furniture', 'https://picsum.photos/seed/chair6/600'),
  ('77777777-7777-4777-8777-777777777777', 'Noise-Cancelling Headphones', 'Over-ear ANC headphones, 40h battery, multipoint Bluetooth 5.3.', 19999, 'USD', 'electronics', 'https://picsum.photos/seed/hp7/600'),
  ('88888888-8888-4888-8888-888888888888', 'Mechanical Numpad', 'Programmable 21-key mechanical numpad with rotary encoder.', 5999, 'USD', 'electronics', 'https://picsum.photos/seed/num8/600'),
  ('99999999-9999-4999-8999-999999999999', 'Desk Mat XXL', '900x400mm stitched-edge desk mat, water-repellent fabric surface.', 2999, 'USD', 'furniture', 'https://picsum.photos/seed/mat9/600'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Monitor Arm Dual', 'Gas-spring dual monitor arm, fits 17-32 inch screens, VESA 75/100.', 8999, 'USD', 'furniture', 'https://picsum.photos/seed/arm10/600'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Webcam 1080p', 'Full-HD webcam with auto-focus, dual noise-cancelling mics, privacy shutter.', 6999, 'USD', 'electronics', 'https://picsum.photos/seed/cam11/600'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Cable Management Kit', '60-piece cable organizer kit: sleeves, clips, ties and raceways.', 1999, 'USD', 'accessories', 'https://picsum.photos/seed/cbl12/600')
ON CONFLICT (product_id) DO NOTHING;
