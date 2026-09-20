-- Stock for the seeded catalog (fixed UUIDs match product-seed.sql).
INSERT INTO stock (product_id, available, reserved) VALUES
  ('11111111-1111-4111-8111-111111111111', 25, 0),
  ('22222222-2222-4222-8222-222222222222', 40, 0),
  ('33333333-3333-4333-8333-333333333333', 10, 0),
  ('44444444-4444-4444-8444-444444444444', 60, 0),
  ('55555555-5555-4555-8555-555555555555', 8,  0),
  ('66666666-6666-4666-8666-666666666666', 15, 0),
  ('77777777-7777-4777-8777-777777777777', 30, 0),
  ('88888888-8888-4888-8888-888888888888', 0,  0),  -- out of stock, for testing rejections
  ('99999999-9999-4999-8999-999999999999', 100, 0),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 12, 0),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 20, 0),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 75, 0)
ON CONFLICT (product_id) DO NOTHING;
