import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_POKEMON_CARD_IMAGE = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";

async function main() {
  const [platformAdminRole, customerRole] = await Promise.all([
    prisma.role.upsert({
      where: { code: "platform_admin" },
      update: {},
      create: { code: "platform_admin", label: "Platform Admin" },
    }),
    prisma.role.upsert({
      where: { code: "customer" },
      update: {},
      create: { code: "customer", label: "Customer" },
    }),
  ]);

  const platformAdmin = await prisma.user.upsert({
    where: { email: "admin@oripa.local" },
    update: { status: "ACTIVE" },
    create: {
      email: "admin@oripa.local",
      displayName: "Platform Admin",
      status: "ACTIVE",
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: platformAdmin.id, roleId: platformAdminRole.id } },
    update: {},
    create: { userId: platformAdmin.id, roleId: platformAdminRole.id },
  });

  const demoCustomer = await prisma.user.upsert({
    where: { email: "customer@oripa.local" },
    update: { status: "ACTIVE" },
    create: {
      email: "customer@oripa.local",
      displayName: "Demo Customer",
      status: "ACTIVE",
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoCustomer.id, roleId: customerRole.id } },
    update: {},
    create: { userId: demoCustomer.id, roleId: customerRole.id },
  });

  const tenant = await prisma.vendor.upsert({
    where: { slug: "demo-vendor" },
    update: {},
    create: {
      name: "Demo Vendor",
      slug: "demo-vendor",
      host: "demo.localhost",
      riskLevel: 0,
    },
  });

  await prisma.vendorSettings.upsert({
    where: { vendorId: tenant.id },
    update: {
      pointsPerCurrencyUnit: 100,
      currencyCode: "USD",
      platformFeeBps: 0,
      maxPackItems: 500,
      maxDrawQuantity: 100,
      payoutSchedule: "manual",
    },
    create: {
      vendorId: tenant.id,
      pointsPerCurrencyUnit: 100,
      currencyCode: "USD",
      platformFeeBps: 0,
      maxPackItems: 500,
      maxDrawQuantity: 100,
      payoutSchedule: "manual",
    },
  });

  await prisma.vendorMembership.upsert({
    where: { vendorId_userId: { vendorId: tenant.id, userId: platformAdmin.id } },
    update: { role: "OWNER", isActive: true },
    create: {
      vendorId: tenant.id,
      userId: platformAdmin.id,
      role: "OWNER",
      isActive: true,
    },
  });

  const wallet = await prisma.walletAccount.upsert({
    where: { id: "demo-wallet" },
    update: {
      userId: demoCustomer.id,
      ownerLabel: "demo-customer",
      balancePoints: 200000,
    },
    create: {
      id: "demo-wallet",
      vendorId: tenant.id,
      userId: demoCustomer.id,
      ownerLabel: "demo-customer",
      balancePoints: 200000,
      version: 1,
    },
  });

  const existingSeedCredit = await prisma.walletEntry.findFirst({
    where: {
      walletAccountId: wallet.id,
      reason: "SEED_TOPUP",
      referenceType: "SEED",
    },
  });

  if (!existingSeedCredit) {
    await prisma.walletEntry.create({
      data: {
        vendorId: tenant.id,
        walletAccountId: wallet.id,
        type: "CREDIT",
        amountPoints: 200000,
        reason: "SEED_TOPUP",
        balanceBefore: 0,
        balanceAfter: 200000,
        actorUserId: platformAdmin.id,
        requestId: "seed-request",
        idempotencyScopeKey: "seed:wallet:credit",
        referenceType: "SEED",
        referenceId: wallet.id,
        metadata: {
          source: "seed",
        },
      },
    });
  }

  const existingPackCount = await prisma.pack.count({ where: { vendorId: tenant.id } });
  if (existingPackCount === 0) {
    await prisma.pack.create({
      data: {
        vendorId: tenant.id,
        title: "Starter Pokemon Pack",
        pricePoints: 500,
        totalStock: 1000,
        remainingStock: 1000,
        isNew: true,
        limitedLabel: "Once per Day",
        prizes: {
          createMany: {
            data: [
              {
                label: "SAR",
                imageUrl: DEFAULT_POKEMON_CARD_IMAGE,
                estimatedValue: 90000,
                weight: 1,
                stock: 5,
                remainingStock: 5,
              },
              {
                label: "AR",
                imageUrl: DEFAULT_POKEMON_CARD_IMAGE,
                estimatedValue: 6000,
                weight: 20,
                stock: 150,
                remainingStock: 150,
              },
              {
                label: "R",
                imageUrl: DEFAULT_POKEMON_CARD_IMAGE,
                estimatedValue: 500,
                weight: 200,
                stock: 845,
                remainingStock: 845,
              },
            ],
          },
        },
      },
    });
  }

  const existingBannerCount = await prisma.vendorBanner.count({ where: { vendorId: tenant.id } });
  if (existingBannerCount === 0) {
    await prisma.vendorBanner.createMany({
      data: [
        {
          vendorId: tenant.id,
          title: "Pokemon Mega Campaign",
          imageUrl: "https://images.unsplash.com/photo-1613771404721-1f92d799e49f?auto=format&fit=crop&w=1600&q=80",
          targetUrl: "https://example.com/campaign/pokemon",
          sortOrder: 1,
          isActive: true,
        },
        {
          vendorId: tenant.id,
          title: "Daily Limited Pack",
          imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=80",
          targetUrl: "https://example.com/campaign/daily",
          sortOrder: 2,
          isActive: true,
        },
        {
          vendorId: tenant.id,
          title: "High Chance Weekend",
          imageUrl: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&w=1600&q=80",
          targetUrl: "https://example.com/campaign/weekend",
          sortOrder: 3,
          isActive: true,
        },
      ],
    });
  }

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





