CREATE TABLE `labelling_check_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT '1',
	`check_key` varchar(64) NOT NULL,
	`url` varchar(2048) NOT NULL,
	`file_key` varchar(512) NOT NULL,
	`uploaded_at` bigint NOT NULL,
	`uploaded_by_user_id` int,
	`uploaded_by_name` varchar(128),
	CONSTRAINT `labelling_check_images_id` PRIMARY KEY(`id`)
);
