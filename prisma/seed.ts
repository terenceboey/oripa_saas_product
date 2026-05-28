import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-vendor" },
    update: {},
    create: {
      name: "Demo Vendor",
      slug: "demo-vendor",
      host: "demo.localhost",
    },
  });

  const wallet = await prisma.walletAccount.upsert({
    where: { id: "demo-wallet" },
    update: {},
    create: {
      id: "demo-wallet",
      tenantId: tenant.id,
      ownerLabel: "demo-customer",
      balancePoints: 200000,
    },
  });

  await prisma.walletEntry.create({
    data: {
      tenantId: tenant.id,
      walletAccountId: wallet.id,
      type: "CREDIT",
      amountPoints: 200000,
      reason: "SEED_TOPUP",
    },
  });

  await prisma.pack.create({
    data: {
      tenantId: tenant.id,
      title: "Starter Pokemon Pack",
      pricePoints: 500,
      totalStock: 1000,
      remainingStock: 1000,
      prizes: {
        createMany: {
          data: [
            { label: "SAR", estimatedValue: 90000, weight: 1, stock: 5, remainingStock: 5 },
            { label: "AR", estimatedValue: 6000, weight: 20, stock: 150, remainingStock: 150 },
            { label: "R", estimatedValue: 500, weight: 200, stock: 845, remainingStock: 845 }
          ]
        }
      }
    }
  });

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
