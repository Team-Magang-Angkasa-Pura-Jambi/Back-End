import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

const Role = {
  Technician: "TECHNICIAN",
  Admin: "ADMIN",
  SuperAdmin: "SUPER_ADMIN",
};

const menuGroups = [
  {
    groupLabel: "Utama",
    items: [
      {
        label: "Dasbor",
        href: "/dashboard",
        icon: "LayoutDashboard",
        allowedRoles: [Role.Technician, Role.Admin, Role.SuperAdmin],
      },
      {
        label: "Input Data",
        href: "/enter-data",
        icon: "FilePenLine",
        allowedRoles: [Role.Technician, Role.Admin, Role.SuperAdmin],
      },
    ],
  },
  {
    groupLabel: "Riwayat",
    items: [
      {
        label: "Riwayat Konsumsi",
        href: "/recap-data",
        icon: "BarChart3",
        allowedRoles: [Role.Admin, Role.SuperAdmin, Role.Technician],
      },
      {
        label: "Riwayat Pencatatan",
        href: "/recap-reading",
        icon: "BookText",
        allowedRoles: [Role.Admin, Role.SuperAdmin, Role.Technician],
      },
    ],
  },
  {
    groupLabel: "Manajemen",
    items: [
      {
        label: "Data Master",
        href: "/data-master",
        icon: "Database",
        allowedRoles: [Role.SuperAdmin, Role.Admin],
      },
      {
        label: "Formula & Kalkulasi",
        href: "/calculation-templates",
        icon: "Calculator",
        allowedRoles: [Role.SuperAdmin, Role.Admin],
      },
      {
        label: "Anggaran",
        href: "/budget",
        icon: "Wallet",
        allowedRoles: [Role.SuperAdmin, Role.Admin],
      },
    ],
  },
  {
    groupLabel: "Pengaturan",
    items: [
      {
        label: "Konfigurasi Dashboard",
        href: "/dashboard-config",
        icon: "LayoutTemplate",
        allowedRoles: [Role.SuperAdmin],
      },
      {
        label: "Konfigurasi Sistem",
        href: "/system-config",
        icon: "SlidersHorizontal",
        allowedRoles: [Role.SuperAdmin],
      },
      {
        label: "Manajemen Menu",
        href: "/menu-management",
        icon: "LayoutList",
        allowedRoles: [Role.SuperAdmin],
      },
      {
        label: "Panduan Sistem",
        href: "/guide-management",
        icon: "BookText",
        allowedRoles: [Role.SuperAdmin],
      },
    ],
  },
  {
    groupLabel: "Monitoring",
    items: [
      {
        label: "Monitoring Server",
        href: "/server-monitoring",
        icon: "Activity",
        allowedRoles: [Role.SuperAdmin]
      },
      {
        label: "Log Audit Sistem",
        href: "/audit-logs",
        icon: "ShieldCheck",
        allowedRoles: [Role.SuperAdmin],
      },
      {
        label: "Log AI Copilot",
        href: "/ai-logs",
        icon: "Bot",
        allowedRoles: [Role.SuperAdmin, Role.Admin],
      },
      {
        label: "Pengaduan Bug & Error",
        href: "/bug-reports",
        icon: "Bug",
        allowedRoles: [Role.SuperAdmin],
      },
    ],
  },
  {
    groupLabel: "Akun",
    items: [
      {
        label: "Akun Saya",
        href: "/profile",
        icon: "CircleUserRound",
        allowedRoles: [Role.SuperAdmin, Role.Admin, Role.Technician],
      },
      {
        label: "Manajemen Pengguna",
        href: "/user-management",
        icon: "Users",
        allowedRoles: [Role.SuperAdmin],
      },
      {
        label: "Pusat Bantuan & FAQ",
        href: "/faq",
        icon: "HelpCircle",
        allowedRoles: [Role.SuperAdmin, Role.Admin, Role.Technician],
      },
    ],
  },
];

async function main() {
  console.log('Menghapus data menu lama...');
  await prisma.menu.deleteMany();

  console.log('Menambahkan data menu...');
  for (let g = 0; g < menuGroups.length; g++) {
    const group = menuGroups[g];
    const parentMenu = await prisma.menu.create({
      data: {
        name: group.groupLabel,
        sort_order: g + 1,
        status: 'ACTIVE',
        allowed_roles: ["SUPER_ADMIN", "ADMIN", "TECHNICIAN"], // Supaya group bisa diakses
      }
    });

    for (let i = 0; i < group.items.length; i++) {
      const item = group.items[i];
      await prisma.menu.create({
        data: {
          name: item.label,
          route: item.href,
          icon_name: item.icon,
          allowed_roles: item.allowedRoles,
          status: 'ACTIVE',
          parent_id: parentMenu.menu_id,
          sort_order: i + 1,
        }
      });
    }
  }

  console.log('Berhasil menambahkan menu!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
