-- AlterTable
ALTER TABLE "placements" ADD COLUMN     "invoiceDueDate" TIMESTAMP(3),
ADD COLUMN     "invoiceRaisedDate" TIMESTAMP(3),
ADD COLUMN     "paidDate" TIMESTAMP(3);
