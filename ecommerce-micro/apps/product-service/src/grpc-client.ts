/** Create the Inventory service gRPC client for product-service. */
import { createInventoryClient } from "@ecommerce/contracts";

export const inventoryClient = createInventoryClient(
  process.env.INVENTORY_URL ?? "localhost:50052",
);
