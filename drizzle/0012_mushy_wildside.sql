ALTER TABLE `documents` ADD `isArchived` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `replacedByDocumentId` int;