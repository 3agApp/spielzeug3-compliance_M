ALTER TABLE `products` ADD `publicVisible` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `sealStatusOverride` enum('verified','in_progress','not_verified');--> statement-breakpoint
ALTER TABLE `products` ADD `batchInfo` json;--> statement-breakpoint
ALTER TABLE `products` ADD `importerName` varchar(255);--> statement-breakpoint
ALTER TABLE `products` ADD `supplierConfirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `products` ADD `supplierConfirmedBy` varchar(255);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `tenantId` int DEFAULT 1 NOT NULL;