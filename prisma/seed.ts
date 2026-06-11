import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_POKEMON_CARD_IMAGE = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
const DEFAULT_PACK_BANNER_IMAGE = "/default-pack-banner-desktop.webp";

async function main() {
  const superAdminEmail = String(process.env.SUPER_ADMIN_EMAIL ?? "esodie123@gmail.com").trim().toLowerCase();
  const superAdminPassword = String(process.env.SUPER_ADMIN_INITIAL_PASSWORD ?? "SuperAdmin!ChangeMe2026");
  const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 12);

  const [platformAdminRole, customerRole, superAdminRole] = await Promise.all([
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
    prisma.role.upsert({
      where: { code: "super_admin" },
      update: {},
      create: { code: "super_admin", label: "Super Admin" },
    }),
  ]);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      passwordHash: superAdminPasswordHash,
      status: "ACTIVE",
      emailVerificationStatus: "VERIFIED",
      emailVerifiedAt: new Date(),
      lastLoginAt: null,
    },
    create: {
      email: superAdminEmail,
      displayName: "Super Admin",
      passwordHash: superAdminPasswordHash,
      status: "ACTIVE",
      emailVerificationStatus: "VERIFIED",
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: superAdmin.id, roleId: superAdminRole.id },
  });

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
        packBannerImageUrl: DEFAULT_PACK_BANNER_IMAGE,
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

  const demoBannerPrizeImages = [
    {
      label: "Charizard ex SAR",
      imageUrl: "https://images.pokemontcg.io/sv3pt5/199_hires.png",
      estimatedValue: 85000,
      weight: 1,
      stock: 2,
      remainingStock: 2,
    },
    {
      label: "Blastoise ex SAR",
      imageUrl: "https://images.pokemontcg.io/sv3pt5/200_hires.png",
      estimatedValue: 62000,
      weight: 2,
      stock: 3,
      remainingStock: 3,
    },
    {
      label: "Venusaur ex SAR",
      imageUrl: "https://images.pokemontcg.io/sv3pt5/198_hires.png",
      estimatedValue: 58000,
      weight: 2,
      stock: 3,
      remainingStock: 3,
    },
    {
      label: "Mew ex SAR",
      imageUrl: "https://images.pokemontcg.io/sv3pt5/205_hires.png",
      estimatedValue: 72000,
      weight: 1,
      stock: 2,
      remainingStock: 2,
    },
    {
      label: "Pikachu Secret Rare",
      imageUrl: "https://images.pokemontcg.io/swsh4/188_hires.png",
      estimatedValue: 45000,
      weight: 4,
      stock: 6,
      remainingStock: 6,
    },
    {
      label: "Gengar VMAX Alt Art",
      imageUrl: "https://images.pokemontcg.io/swsh8/271_hires.png",
      estimatedValue: 110000,
      weight: 1,
      stock: 1,
      remainingStock: 1,
    },
  ];

  const existingDemoBannerPack = await prisma.pack.findFirst({
    where: { vendorId: tenant.id, title: "MVP Banner Demo Pack" },
    select: { id: true },
  });

  if (existingDemoBannerPack) {
    await prisma.pack.update({
      where: { id: existingDemoBannerPack.id },
      data: {
        packBannerImageUrl: DEFAULT_PACK_BANNER_IMAGE,
        pricePoints: 5500,
        totalStock: 120,
        remainingStock: 120,
        isNew: true,
        limitedLabel: "Banner MVP",
        importantNotes: "Seeded pack with real card image URLs for the banner-maker MVP.",
        status: "DRAFT",
        prizes: {
          deleteMany: {},
          createMany: { data: demoBannerPrizeImages },
        },
      },
    });
  } else {
    await prisma.pack.create({
      data: {
        vendorId: tenant.id,
        title: "MVP Banner Demo Pack",
        packBannerImageUrl: DEFAULT_PACK_BANNER_IMAGE,
        pricePoints: 5500,
        totalStock: 120,
        remainingStock: 120,
        isNew: true,
        limitedLabel: "Banner MVP",
        importantNotes: "Seeded pack with real card image URLs for the banner-maker MVP.",
        status: "DRAFT",
        prizes: {
          createMany: { data: demoBannerPrizeImages },
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





