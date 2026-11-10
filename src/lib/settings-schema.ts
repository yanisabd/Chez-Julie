import { z } from "zod";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

export const rangeSchema = z.object({
  start: hhmm,
  end: hhmm,
  pickup: z.boolean().default(true),
  delivery: z.boolean().default(true),
});

export const daySchema = z.object({
  open: z.boolean().default(false),
  ranges: z.array(rangeSchema).default([]),
});

export const settingsSchema = z.object({
  business: z
    .object({
      name: z.string().default("Chez Juju"),
      tagline: z.string().default("Cuisine africaine faite maison"),
      about: z
        .string()
        .default(
          "Des recettes d’Afrique de l’Ouest et Centrale, cuisinées à la commande avec des produits frais. Commandez à l’avance, on s’occupe du reste.",
        ),
      phone: z.string().default("06 00 00 00 00"),
      email: z.string().default("contact@chezjuju.fr"),
      pickupAddress: z.string().default("12 rue de l’Exemple, 75000 Paris"),
      pickupInstructions: z.string().default("Sonnez à l’interphone « Chez Juju ». Merci de respecter votre créneau."),
      announcement: z.string().default(""),
      instagram: z.string().default(""),
    })
    .prefault({}),
  legal: z
    .object({
      companyName: z.string().default("À compléter (nom ou raison sociale)"),
      legalForm: z.string().default("Micro-entreprise"),
      siret: z.string().default("À compléter"),
      address: z.string().default("À compléter"),
      publisher: z.string().default("À compléter"),
      host: z.string().default("Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis"),
      vatNote: z.string().default("TVA non applicable, art. 293 B du CGI"),
      hygieneNote: z.string().default("Déclaration d’activité alimentaire auprès de la DDPP — à compléter"),
    })
    .prefault({}),
  ordering: z
    .object({
      paused: z.boolean().default(false),
      pauseMessage: z.string().default("Les commandes sont momentanément suspendues. Revenez très vite !"),
      minLeadHours: z.number().min(0).max(168).default(6),
      maxAdvanceDays: z.number().int().min(1).max(60).default(7),
      slotMinutes: z.number().int().min(10).max(240).default(30),
      defaultMaxOrdersPerSlot: z.number().int().min(1).max(500).default(4),
      defaultMaxItemsPerSlot: z.number().int().min(1).max(5000).default(15),
      maxOrdersPerDay: z.number().int().min(1).nullable().default(null),
      maxItemsPerDay: z.number().int().min(1).nullable().default(null),
      prepMinutes: z.number().int().min(0).max(600).default(45),
      autoAccept: z.boolean().default(true),
      allowCustomerCancel: z.boolean().default(true),
      cancelDeadlineHours: z.number().min(0).max(168).default(12),
      paymentHoldMinutes: z.number().int().min(30).max(120).default(30),
      pickupEnabled: z.boolean().default(true),
      deliveryEnabled: z.boolean().default(true),
      lowStockDisplay: z.number().int().min(0).max(100).default(5),
      promoCodesEnabled: z.boolean().default(true),
      maxItemsPerOrder: z.number().int().min(1).max(500).default(30),
    })
    .prefault({}),
  schedule: z
    .array(daySchema)
    .length(7)
    .default([
      { open: false, ranges: [] },
      { open: true, ranges: [{ start: "18:00", end: "21:30", pickup: true, delivery: true }] },
      { open: true, ranges: [{ start: "18:00", end: "21:30", pickup: true, delivery: true }] },
      { open: true, ranges: [{ start: "18:00", end: "21:30", pickup: true, delivery: true }] },
      { open: true, ranges: [{ start: "18:00", end: "22:00", pickup: true, delivery: true }] },
      {
        open: true,
        ranges: [
          { start: "12:00", end: "14:00", pickup: true, delivery: false },
          { start: "18:00", end: "22:00", pickup: true, delivery: true },
        ],
      },
      { open: true, ranges: [{ start: "12:00", end: "15:00", pickup: true, delivery: true }] },
    ]),
  notifications: z
    .object({
      adminEmail: z.string().default(""),
      notifyAdminNewOrder: z.boolean().default(true),
      notifyAdminIssues: z.boolean().default(true),
      notifyAdminLowStock: z.boolean().default(true),
      /** SMS (en plus des emails) */
      sms: z
        .object({
          enabled: z.boolean().default(true),
          order_confirmed: z.boolean().default(true),
          ready: z.boolean().default(true),
          out_for_delivery: z.boolean().default(true),
          cancelled: z.boolean().default(true),
          adminPhone: z.string().default(""),
          adminNewOrder: z.boolean().default(true),
          adminIssues: z.boolean().default(true),
        })
        .prefault({}),
      customer: z
        .object({
          accepted: z.boolean().default(true),
          preparing: z.boolean().default(true),
          ready: z.boolean().default(true),
          out_for_delivery: z.boolean().default(true),
          completed: z.boolean().default(true),
        })
        .prefault({}),
    })
    .prefault({}),
  privacy: z
    .object({
      retentionMonths: z.number().int().min(6).max(120).default(36),
    })
    .prefault({}),
});

export type Settings = z.infer<typeof settingsSchema>;
export type DaySchedule = z.infer<typeof daySchema>;
export type Range = z.infer<typeof rangeSchema>;

export const defaultSettings = (): Settings => settingsSchema.parse({});
