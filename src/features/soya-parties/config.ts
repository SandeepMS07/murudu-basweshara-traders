/**
 * Labels and routes for the Soya Parties module.
 *
 * Record-for-record this is the maize Sales module; on the Soya side the
 * business calls it "Parties", so the individual record is a neutral "Entry"
 * rather than a "Sale".
 */
export const soyaPartyLabels = {
  entityLabel: "Entry",
  partyLabel: "Party",
  listHref: "/soya/parties",
  partyType: "buyer" as const,
};

/**
 * Column config minus the delete action — pages supply that, because server
 * actions can only be imported from a "use server" module by the route that
 * owns them.
 */
export const soyaPartyColumnsConfig = {
  entityLabel: soyaPartyLabels.entityLabel,
  editHrefBase: soyaPartyLabels.listHref,
};
