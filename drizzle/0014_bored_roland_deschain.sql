CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`url` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`originalName` varchar(255),
	`mimeType` varchar(64),
	`fileSizeBytes` int,
	`sortOrder` int NOT NULL DEFAULT 0,
	`uploadedByUserId` int NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
