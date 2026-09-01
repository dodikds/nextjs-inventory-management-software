-- AlterTable: add nullable permissions/deletedAt to roles first (table has existing rows)
ALTER TABLE `roles`
  ADD COLUMN `permissions` JSON NULL,
  ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- Backfill: admin role gets the full canonical permission list, everything else starts empty
UPDATE `roles` SET `permissions` = JSON_ARRAY(
  'manage_adjustments','manage_transfers','manage_roles','manage_brands','manage_currency',
  'manage_warehouses','manage_units','manage_product_categories','manage_products','manage_suppliers',
  'manage_customers','manage_users','manage_expense_categories','manage_expenses','manage_setting',
  'manage_dashboard','manage_pos_screen','manage_purchases','manage_sales','manage_purchase_returns',
  'manage_sale_returns','manage_email_templates','manage_reports','manage_quotations','manage_sms_templates',
  'manage_sms_apis','manage_language'
) WHERE `name` = 'admin';

UPDATE `roles` SET `permissions` = JSON_ARRAY() WHERE `permissions` IS NULL;

-- AlterTable: permissions is now required
ALTER TABLE `roles` MODIFY COLUMN `permissions` JSON NOT NULL;

-- AlterTable: add nullable roleId to users first (table has existing rows)
ALTER TABLE `users` ADD COLUMN `roleId` VARCHAR(191) NULL;

-- Backfill: point every user at the Role row matching their legacy role string
UPDATE `users` u JOIN `roles` r ON r.`name` = u.`role` SET u.`roleId` = r.`id`;

-- AlterTable: roleId is now required
ALTER TABLE `users` MODIFY COLUMN `roleId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `users_roleId_idx` ON `users`(`roleId`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
