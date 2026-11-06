import {
  pgTable,
  pgEnum,
  pgSequence,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  serial,
  primaryKey,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array | Buffer }>({
  dataType() {
    return "bytea";
  },
  fromDriver(value) {
    return value instanceof Uint8Array ? value : new Uint8Array(value as Buffer);
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const roleEnum = pgEnum("role", ["admin", "kitchen", "customer"]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment", // commande créée, paiement en cours (stocks réservés temporairement)
  "new", // payée, en attente de validation
  "accepted", // à préparer
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
  "expired", // paiement jamais finalisé
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
]);

export const modeEnum = pgEnum("fulfillment_mode", ["pickup", "delivery"]);

export const reservationStateEnum = pgEnum("reservation_state", ["held", "committed", "released"]);

export const orderNumberSeq = pgSequence("order_number_seq", { startWith: 1001 });

/* ------------------------------------------------------------------ */
/* Utilisateurs & sécurité                                             */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: roleEnum("role").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    passwordHash: text("password_hash"),
    pinHash: text("pin_hash"),
    active: boolean("active").notNull().default(true),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: ts("locked_until"),
    lastLoginAt: ts("last_login_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // SHA-256 du jeton (le jeton brut n'est jamais stocké)
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable("password_resets", {
  id: text("id").primaryKey(), // SHA-256 du jeton
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: ts("reset_at").notNull(),
});

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  data: bytea("data").notNull(),
  mime: text("mime").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    ingredientsText: text("ingredients_text").notNull().default(""),
    allergens: text("allergens").array().notNull().default([]),
    priceCents: integer("price_cents").notNull(),
    imageId: uuid("image_id").references(() => images.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    featured: boolean("featured").notNull().default(false),
    spicy: integer("spicy").notNull().default(0), // 0 à 3
    /** Jours de vente ISO (1 = lundi ... 7 = dimanche). Vide = tous les jours. */
    availableDays: integer("available_days").array().notNull().default([]),
    /** Stock physique disponible. NULL = stock non suivi (illimité). */
    stockQty: integer("stock_qty"),
    /** Quantité bloquée par des paiements en cours. */
    reservedQty: integer("reserved_qty").notNull().default(0),
    /** Seuil d'alerte stock bas. */
    alertThreshold: integer("alert_threshold"),
    /** Nombre maximum de portions préparées par jour. NULL = pas de limite. */
    dailyLimit: integer("daily_limit"),
    /** Quantité maximale par commande. */
    maxPerOrder: integer("max_per_order"),
    position: integer("position").notNull().default(0),
    deletedAt: ts("deleted_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("products_slug_idx").on(t.slug)],
);

export const optionGroups = pgTable("option_groups", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  required: boolean("required").notNull().default(false),
  maxChoices: integer("max_choices").notNull().default(1),
  position: integer("position").notNull().default(0),
});

export const options = pgTable("options", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id")
    .notNull()
    .references(() => optionGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceDeltaCents: integer("price_delta_cents").notNull().default(0),
  position: integer("position").notNull().default(0),
});

/* ------------------------------------------------------------------ */
/* Ingrédients & recettes                                              */
/* ------------------------------------------------------------------ */

export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  /** Unité de base : g, ml ou pce */
  unit: text("unit").notNull().default("g"),
  stock: integer("stock").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  alertThreshold: integer("alert_threshold"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const recipeItems = pgTable(
  "recipe_items",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    ingredientId: integer("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(), // par portion, en unité de base
  },
  (t) => [primaryKey({ columns: [t.productId, t.ingredientId] })],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id"),
    ingredientId: integer("ingredient_id"),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(), // sale, restock, adjustment, cancel
    orderId: uuid("order_id"),
    actorLabel: text("actor_label"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("stock_mov_created_idx").on(t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Capacités                                                           */
/* ------------------------------------------------------------------ */

/** Portions vendues par plat et par jour de service (limite de production journalière). */
export const productDayUsage = pgTable(
  "product_day_usage",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    qty: integer("qty").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.day] })],
);

/** Charge totale par jour de service. */
export const dayUsage = pgTable("day_usage", {
  day: date("day").primaryKey(),
  orders: integer("orders").notNull().default(0),
  items: integer("items").notNull().default(0),
});

/** Créneaux matérialisés (créés à la première réservation ou modification). */
export const slots = pgTable(
  "slots",
  {
    id: serial("id").primaryKey(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    day: date("day").notNull(),
    maxOrders: integer("max_orders"), // NULL = valeur par défaut des paramètres
    maxItems: integer("max_items"),
    bookedOrders: integer("booked_orders").notNull().default(0),
    bookedItems: integer("booked_items").notNull().default(0),
    blocked: boolean("blocked").notNull().default(false),
    /** Ouvert exceptionnellement hors des horaires habituels */
    forcedOpen: boolean("forced_open").notNull().default(false),
  },
  (t) => [uniqueIndex("slots_starts_idx").on(t.startsAt), index("slots_day_idx").on(t.day)],
);

export const closures = pgTable("closures", {
  id: serial("id").primaryKey(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason").notNull().default(""),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Livraison & promotions                                              */
/* ------------------------------------------------------------------ */

export const deliveryZones = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  postalCodes: text("postal_codes").array().notNull().default([]),
  cities: text("cities").array().notNull().default([]),
  feeCents: integer("fee_cents").notNull().default(0),
  minOrderCents: integer("min_order_cents").notNull().default(0),
  freeAboveCents: integer("free_above_cents"),
  active: boolean("active").notNull().default(true),
});

export const promoCodes = pgTable(
  "promo_codes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    kind: text("kind").notNull(), // percent | fixed
    value: integer("value").notNull(), // % ou centimes
    minOrderCents: integer("min_order_cents").notNull().default(0),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("promo_code_idx").on(t.code)],
);

/* ------------------------------------------------------------------ */
/* Commandes                                                           */
/* ------------------------------------------------------------------ */

export type ReservationSnapshot = {
  slotId: number;
  day: string;
  items: number;
  products: { id: number; qty: number; stockTracked: boolean; daily: boolean }[];
  ingredients: { id: number; qty: number }[];
  promoId: number | null;
};

export type OrderItemOption = { group: string; name: string; priceDeltaCents: number };

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: integer("number").notNull(),
    publicToken: text("public_token").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    mode: modeEnum("mode").notNull(),
    addressLine: text("address_line"),
    postalCode: text("postal_code"),
    city: text("city"),
    deliveryInstructions: text("delivery_instructions"),
    kitchenNotes: text("kitchen_notes"),
    slotId: integer("slot_id").references(() => slots.id),
    slotStart: ts("slot_start").notNull(),
    slotEnd: ts("slot_end").notNull(),
    serviceDay: date("service_day").notNull(),
    status: orderStatusEnum("status").notNull().default("pending_payment"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("unpaid"),
    subtotalCents: integer("subtotal_cents").notNull(),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    promoCode: text("promo_code"),
    reservation: jsonb("reservation").$type<ReservationSnapshot>().notNull(),
    reservationState: reservationStateEnum("reservation_state").notNull().default("held"),
    holdExpiresAt: ts("hold_expires_at").notNull(),
    checkoutSessionId: text("checkout_session_id"),
    paidAt: ts("paid_at"),
    cancelledAt: ts("cancelled_at"),
    cancelReason: text("cancel_reason"),
    anonymizedAt: ts("anonymized_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.number),
    uniqueIndex("orders_token_idx").on(t.publicToken),
    index("orders_status_idx").on(t.status),
    index("orders_day_idx").on(t.serviceDay),
    index("orders_user_idx").on(t.userId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    options: jsonb("options").$type<OrderItemOption[]>().notNull().default([]),
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/** Historique : changements de statut, commentaires internes, problèmes signalés, paiements... */
export const orderEvents = pgTable(
  "order_events",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // status | comment | issue | payment | refund | edit | system
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    message: text("message"),
    actorUserId: uuid("actor_user_id"),
    actorLabel: text("actor_label"),
    resolvedAt: ts("resolved_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

/* ------------------------------------------------------------------ */
/* Paiements                                                           */
/* ------------------------------------------------------------------ */

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // stripe | demo
    reference: text("reference"), // PaymentIntent
    checkoutSessionId: text("checkout_session_id"),
    amountCents: integer("amount_cents").notNull(),
    refundedCents: integer("refunded_cents").notNull().default(0),
    status: text("status").notNull(), // succeeded | refunded | partially_refunded
    paidAt: ts("paid_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payments_order_idx").on(t.orderId)],
);

export const refunds = pgTable("refunds", {
  id: serial("id").primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  reference: text("reference"),
  reason: text("reason"),
  status: text("status").notNull(), // succeeded | pending | failed
  actorLabel: text("actor_label"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** Évènements Stripe déjà traités (idempotence des webhooks). */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Notifications (file d'envoi fiable)                                 */
/* ------------------------------------------------------------------ */

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    /** Garantit qu'un même email n'est jamais créé deux fois. */
    dedupeKey: text("dedupe_key").notNull(),
    status: text("status").notNull().default("pending"), // pending | sent | failed | simulated
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    lastError: text("last_error"),
    providerId: text("provider_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
    sentAt: ts("sent_at"),
  },
  (t) => [uniqueIndex("notifications_dedupe_idx").on(t.dedupeKey), index("notifications_status_idx").on(t.status)],
);

/* ------------------------------------------------------------------ */
/* Paramètres & journaux                                               */
/* ------------------------------------------------------------------ */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorUserId: uuid("actor_user_id"),
    actorLabel: text("actor_label").notNull(),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    details: jsonb("details"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const systemLogs = pgTable(
  "system_logs",
  {
    id: serial("id").primaryKey(),
    level: text("level").notNull(), // info | warn | error
    message: text("message").notNull(),
    context: jsonb("context"),
    acknowledged: boolean("acknowledged").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("system_logs_created_idx").on(t.createdAt)],
);
