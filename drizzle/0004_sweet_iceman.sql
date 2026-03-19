CREATE TABLE `component_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`componentId` int NOT NULL,
	`productId` int NOT NULL,
	`documentType` enum('test_report','declaration_of_conformity','material_certificate','reach_declaration','rohs_declaration','certificate','regulatory_document','other') NOT NULL,
	`standard` varchar(128),
	`fileName` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(512),
	`mimeType` varchar(128),
	`fileSizeBytes` int,
	`version` int NOT NULL DEFAULT 1,
	`expiryDate` timestamp,
	`uploadedByUserId` int,
	`reviewStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewNote` text,
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `component_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_components` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`materialType` enum('wood','metal','plastic','textile','electronic','paint_coating','rubber','glass','other'),
	`supplierName` varchar(255),
	`partNumber` varchar(128),
	`sortOrder` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_components_id` PRIMARY KEY(`id`)
);
