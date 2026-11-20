-- spec: 7.3 (v0.3.6, Qadam 17a, owner ki manzoori), FX-02, 10.1 queries.cost.test
-- Admin Orders tab: "Sab" list (ORDER BY created_at DESC) aur "aaj" ka khulasa (WHERE updated_at >= aaj) poori table na parhein.
-- Lagoo hone ke baad yeh file KABHI edit nahin hoti.
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_updated ON orders(updated_at);
