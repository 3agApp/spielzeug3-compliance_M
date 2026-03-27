CREATE TABLE `seal_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`status` enum('verified','in_progress','not_verified') NOT NULL,
	`url` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`originalName` varchar(255),
	`uploadedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seal_assets_id` PRIMARY KEY(`id`)
);
