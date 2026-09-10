/** Labels and routes for the Soya Purchases module (buy side). */
export const soyaPurchaseLabels = {
  entityLabel: "Purchase",
  partyLabel: "Supplier",
  listHref: "/soya/purchases",
  partyType: "supplier" as const,
};

/**
 * Column config minus the delete action — pages supply that, because server
 * actions can only be imported from a "use server" module by the route that
 * owns them.
 */
export const soyaPurchaseColumnsConfig = {
  entityLabel: soyaPurchaseLabels.entityLabel,
  editHrefBase: soyaPurchaseLabels.listHref,
};
