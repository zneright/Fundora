/**
 * Fundora — Traceable DTI Suggested Retail Price (SRP) & Inter-Agency Borrowing Catalog
 * Provides deterministic Philippine procurement benchmarks and free LGU borrowing detection
 * with explicit reference sources and publication dates.
 */

import type {
  DtiSrpBenchmarkFinding,
  InterAgencyBorrowingFinding,
  MilestoneAllocationAssessment,
  ProposalBudgetItemInput,
  ProposalPhaseInput,
} from './types.ts';

export interface DtiCatalogEntry {
  id: string;
  keywords: string[];
  canonicalName: string;
  category: string;
  unit: string;
  baselineSrpPhp: number;
  maxAcceptablePricePhp: number; // +15% tolerance over baseline SRP
  dtiReferenceSource: string;
  dtiEffectiveDate: string;
}

export interface BorrowableCatalogEntry {
  id: string;
  keywords: string[];
  canonicalItem: string;
  suggestedSourceAgency: string;
  alternativeFallbackAgency: string;
  rationale: string;
}

export const DTI_SRP_REFERENCE_CATALOG: DtiCatalogEntry[] = [
  {
    id: 'dti_solar_streetlight_100w',
    keywords: ['solar streetlight', 'solar lamp', 'led street light', 'solar street light'],
    canonicalName: '100W IP65 Integrated Solar LED Streetlight with Pole Bracket',
    category: 'Infrastructure & Lighting',
    unit: 'unit',
    baselineSrpPhp: 3850,
    maxAcceptablePricePhp: 4427.5,
    dtiReferenceSource: 'DBM-PS PhilGEPS & DOE LGU Energy Efficiency Reference Guide',
    dtiEffectiveDate: '2026-10-01',
  },
  {
    id: 'dti_cement_40kg',
    keywords: ['portland cement', 'cement bag', '40kg cement', 'cement'],
    canonicalName: 'Portland Cement Type 1 (40kg Standard Bag)',
    category: 'Construction Materials',
    unit: 'bag',
    baselineSrpPhp: 245,
    maxAcceptablePricePhp: 281.75,
    dtiReferenceSource: 'DTI Construction Materials Price Monitoring Bulletin (NCR/Region IV-A)',
    dtiEffectiveDate: '2026-10-15',
  },
  {
    id: 'dti_basketball_official',
    keywords: ['basketball', 'molten basketball', 'leather basketball', 'fiba basketball'],
    canonicalName: 'Official Size 7 Composite Leather Basketball',
    category: 'Youth Sports Equipment',
    unit: 'piece',
    baselineSrpPhp: 1650,
    maxAcceptablePricePhp: 1897.5,
    dtiReferenceSource: 'DTI-PS Sporting Goods & DepEd Palarong Pambansa Procurement Reference',
    dtiEffectiveDate: '2026-09-30',
  },
  {
    id: 'dti_volleyball_official',
    keywords: ['volleyball', 'mikasa volleyball', 'volleyball net'],
    canonicalName: 'Official Size 5 Synthetic Leather Volleyball',
    category: 'Youth Sports Equipment',
    unit: 'piece',
    baselineSrpPhp: 1450,
    maxAcceptablePricePhp: 1667.5,
    dtiReferenceSource: 'DTI-PS Sporting Goods & DepEd Palarong Pambansa Procurement Reference',
    dtiEffectiveDate: '2026-09-30',
  },
  {
    id: 'dti_sports_jersey_set',
    keywords: ['jersey', 'uniform set', 'basketball uniform', 'sublimation jersey'],
    canonicalName: 'Full-Sublimation Youth Athletic Jersey & Shorts Set',
    category: 'Youth Sports Equipment',
    unit: 'set',
    baselineSrpPhp: 650,
    maxAcceptablePricePhp: 747.5,
    dtiReferenceSource: 'DTI Regional Apparel & LGU SK Sports League Benchmark',
    dtiEffectiveDate: '2026-10-01',
  },
  {
    id: 'dti_bond_paper_a4',
    keywords: ['bond paper', 'a4 paper', 'copy paper', 'ream paper'],
    canonicalName: 'Multi-Purpose Copy Paper A4 70gsm (500 Sheets/Ream)',
    category: 'Office & Training Supplies',
    unit: 'ream',
    baselineSrpPhp: 195,
    maxAcceptablePricePhp: 224.25,
    dtiReferenceSource: 'DBM-PS Common-Use Supplies and Equipment (CSE) Price List Q4 2026',
    dtiEffectiveDate: '2026-10-15',
  },
  {
    id: 'dti_first_aid_kit',
    keywords: ['first aid kit', 'trauma kit', 'medical kit', 'first-aid consumables'],
    canonicalName: 'Standard Barangay Emergency First-Aid & Trauma Refill Kit',
    category: 'DRRM & Health',
    unit: 'kit',
    baselineSrpPhp: 1250,
    maxAcceptablePricePhp: 1437.5,
    dtiReferenceSource: 'DOH & DTI Medical Supplies Suggested Retail Price Circular',
    dtiEffectiveDate: '2026-10-10',
  },
  {
    id: 'dti_seminar_snack_meal',
    keywords: ['snack', 'meals', 'catering', 'packed meal', 'merienda', 'food pack'],
    canonicalName: 'Youth Workshop / Seminar Packed AM/PM Snack & Beverage',
    category: 'Training & Catering',
    unit: 'pax',
    baselineSrpPhp: 150,
    maxAcceptablePricePhp: 172.5,
    dtiReferenceSource: 'COA-DBM Joint Circular on LGU Training & Seminar Meal Allowances',
    dtiEffectiveDate: '2026-09-15',
  },
  {
    id: 'dti_wifi_router_mesh',
    keywords: ['router', 'mesh wifi', 'access point', 'gigabit router'],
    canonicalName: 'Dual-Band Wi-Fi 6 Gigabit Mesh Router / Access Point',
    category: 'ICT & Digital Literacy',
    unit: 'unit',
    baselineSrpPhp: 3200,
    maxAcceptablePricePhp: 3680,
    dtiReferenceSource: 'DICT Pipol Konek & DBM-PS ICT Equipment Price Matrix',
    dtiEffectiveDate: '2026-10-01',
  },
];

export const INTER_AGENCY_BORROWING_CATALOG: BorrowableCatalogEntry[] = [
  {
    id: 'borrow_tent_chairs_tables',
    keywords: ['tent', 'canopy', 'monoblock chair', 'folding table', 'tables and chairs', 'stage rental'],
    canonicalItem: 'Modular Event Tents, Monoblock Chairs, and Folding Tables',
    suggestedSourceAgency: 'Barangay Hall / City General Services Office (GSO)',
    alternativeFallbackAgency: 'Neighboring Barangay Council or Municipal Motorpool',
    rationale:
      'Barangay Halls and City GSOs maintain public inventories of tents, chairs, and tables for community events at ₱0 rental cost.',
  },
  {
    id: 'borrow_sound_system_projector',
    keywords: ['sound system', 'pa system', 'speaker rental', 'projector', 'led wall', 'microphone rental'],
    canonicalItem: 'Portable PA Sound System, Wireless Microphones, and LCD Projector',
    suggestedSourceAgency: 'Barangay Sangguniang Hall / City Information Office',
    alternativeFallbackAgency: 'Local Public High School (DepEd) Audio-Visual Room',
    rationale:
      'Audio-visual equipment and PA systems can be borrowed free of charge via an inter-office request letter to the Barangay Council or DepEd school principal.',
  },
  {
    id: 'borrow_drrm_rescue_gear',
    keywords: ['spine board', 'cpr manikin', 'megaphone', 'rescue dummy', 'fire extinguisher trainer'],
    canonicalItem: 'Spine Boards, CPR Simulation Manikins, and DRRM Training Gear',
    suggestedSourceAgency: 'City/Municipal DRRMO & Bureau of Fire Protection (BFP)',
    alternativeFallbackAgency: 'Philippine Red Cross Local Chapter',
    rationale:
      'CDRRMO and BFP provide certified Basic Life Support (BLS) instructors and loan training manikins/spine boards to SK councils at zero cost.',
  },
  {
    id: 'borrow_seedlings_tree_planting',
    keywords: ['seedling', 'tree sapling', 'narra seedling', 'mangrove seedling', 'organic fertilizer'],
    canonicalItem: 'Native Tree Seedlings and Urban Gardening Starter Inputs',
    suggestedSourceAgency: 'DENR - CENRO / City Environment & Natural Resources Office (CENRO)',
    alternativeFallbackAgency: 'Department of Agriculture (DA) High-Value Crops Nursery',
    rationale:
      'DENR and City Agriculture nurseries distribute free native seedlings and compost for registered SK environmental drives.',
  },
  {
    id: 'borrow_venue_gymnasium',
    keywords: ['venue rental', 'gym rental', 'basketball court rental', 'function hall', 'training hall'],
    canonicalItem: 'Public Covered Court / Multi-Purpose Hall Venue',
    suggestedSourceAgency: 'Barangay Multi-Purpose Covered Court / City Sports Office',
    alternativeFallbackAgency: 'DepEd Public School Covered Gymnasium',
    rationale:
      'Under R.A. 10742, SK councils have priority free access to Barangay and Municipal covered courts and multi-purpose halls.',
  },
];

export function benchmarkItemAgainstDtiSrp(
  item: ProposalBudgetItemInput
): DtiSrpBenchmarkFinding {
  const lowerName = (item.itemName || '').toLowerCase().trim();
  const qty = Math.max(1, Number(item.quantity) || 1);
  const proposedUnit = Math.max(0, Number(item.unitPricePhp) || 0);

  const matchedEntry = DTI_SRP_REFERENCE_CATALOG.find((entry) =>
    entry.keywords.some((kw) => lowerName.includes(kw))
  );

  if (matchedEntry) {
    const srp = matchedEntry.baselineSrpPhp;
    const maxAcceptable = matchedEntry.maxAcceptablePricePhp;
    const variancePct =
      srp > 0 ? Math.round(((proposedUnit - srp) / srp) * 1000) / 10 : 0;

    const isAbove = proposedUnit > maxAcceptable;
    const isBelow = proposedUnit < srp * 0.5;
    const status: DtiSrpBenchmarkFinding['status'] = isAbove
      ? 'above_srp'
      : isBelow
        ? 'below_srp'
        : 'within_srp';

    const severity: DtiSrpBenchmarkFinding['severity'] =
      variancePct > 40 ? 'HIGH' : isAbove || isBelow ? 'MEDIUM' : 'LOW';

    const note = isAbove
      ? `Proposed unit price (₱${proposedUnit.toLocaleString()}) exceeds DTI/DBM reference SRP (₱${srp.toLocaleString()}, max +15% tolerance ₱${maxAcceptable.toLocaleString()}) by +${variancePct}%.`
      : isBelow
        ? `Proposed unit price (₱${proposedUnit.toLocaleString()}) is unusually below DTI reference SRP (₱${srp.toLocaleString()}); verify product specifications and quality.`
        : `Within DTI/DBM reference SRP (₱${srp.toLocaleString()} per ${matchedEntry.unit}).`;

    return {
      itemName: item.itemName,
      quantity: qty,
      unit: item.unit || matchedEntry.unit,
      proposedUnitPricePhp: proposedUnit,
      estimatedDtiSrpPhp: srp,
      maxAcceptablePricePhp: maxAcceptable,
      variancePct,
      status,
      severity,
      dtiReferenceSource: matchedEntry.dtiReferenceSource,
      dtiEffectiveDate: matchedEntry.dtiEffectiveDate,
      note,
    };
  }

  // Unmatched custom item — evaluate reasonableness and mark traceable custom status
  return {
    itemName: item.itemName,
    quantity: qty,
    unit: item.unit || 'unit',
    proposedUnitPricePhp: proposedUnit,
    estimatedDtiSrpPhp: proposedUnit,
    maxAcceptablePricePhp: Math.round(proposedUnit * 1.15 * 100) / 100,
    variancePct: 0,
    status: 'unverified_custom',
    severity: proposedUnit > 25000 ? 'MEDIUM' : 'LOW',
    dtiReferenceSource: 'Custom LGU Canvas / Requires 3 Supplier Quotations (R.A. 9184)',
    dtiEffectiveDate: '2026-10-15',
    note:
      proposedUnit > 25000
        ? `Custom non-CSE item (₱${proposedUnit.toLocaleString()}); attach 3 independent supplier price quotations per R.A. 9184 Small Value Procurement rules.`
        : `Custom item not in standard DTI CSE table; verify against local supplier canvas.`,
  };
}

export function detectInterAgencyBorrowingOpportunities(
  items: ProposalBudgetItemInput[]
): InterAgencyBorrowingFinding[] {
  const findings: InterAgencyBorrowingFinding[] = [];

  for (const item of items) {
    const lowerName = (item.itemName || '').toLowerCase();
    const qty = Math.max(1, Number(item.quantity) || 1);
    const totalCost =
      item.totalPricePhp !== undefined && item.totalPricePhp > 0
        ? item.totalPricePhp
        : qty * Math.max(0, Number(item.unitPricePhp) || 0);

    const match = INTER_AGENCY_BORROWING_CATALOG.find((entry) =>
      entry.keywords.some((kw) => lowerName.includes(kw))
    );

    if (match && totalCost > 0) {
      findings.push({
        itemName: item.itemName,
        proposedPurchaseCostPhp: totalCost,
        suggestedSourceAgency: match.suggestedSourceAgency,
        estimatedSavingsPhp: totalCost,
        rationale: match.rationale,
        alternativeFallbackAgency: match.alternativeFallbackAgency,
      });
    }
  }

  return findings;
}

export function evaluateMilestoneAllocations(
  milestones: ProposalPhaseInput[],
  lineItems: ProposalBudgetItemInput[],
  declaredTotalBudgetPhp: number
): MilestoneAllocationAssessment {
  const count = milestones.length;
  const isValidCount = count >= 2 && count <= 5;

  let totalBps = 0;
  let upfrontBps = 0;

  milestones.forEach((m, idx) => {
    const bps =
      m.percentageBps !== undefined
        ? Math.round(m.percentageBps)
        : m.percentage !== undefined
          ? Math.round(m.percentage * 100)
          : 0;
    totalBps += bps;
    if (idx === 0 && (m.isUpfront || bps > 0)) {
      upfrontBps = bps;
    }
  });

  const isExact100Percent = totalBps === 10000;
  const upfrontAssessment: MilestoneAllocationAssessment['upfrontAssessment'] =
    upfrontBps === 0
      ? 'no_upfront'
      : upfrontBps <= 5000
        ? 'optimal'
        : 'high_upfront_risk';

  const budgetLineItemSumPhp = lineItems.reduce((sum, li) => {
    const itemTotal =
      li.totalPricePhp !== undefined && li.totalPricePhp > 0
        ? li.totalPricePhp
        : Math.max(1, Number(li.quantity) || 1) * Math.max(0, Number(li.unitPricePhp) || 0);
    return sum + itemTotal;
  }, 0);

  const discrepancy = Math.round((declaredTotalBudgetPhp - budgetLineItemSumPhp) * 100) / 100;
  const isBudgetBalanced = Math.abs(discrepancy) <= 1;

  const notes: string[] = [];
  if (!isValidCount) {
    notes.push(`Milestone count (${count}) must be between 2 and 5 phases.`);
  }
  if (!isExact100Percent) {
    notes.push(
      `Milestone allocations sum to ${(totalBps / 100).toFixed(2)}% (${totalBps} bps); must equal exactly 100.00% (10000 bps).`
    );
  } else {
    notes.push(`Milestone allocations sum cleanly to 100.00% (10000 bps).`);
  }

  if (upfrontBps > 5000) {
    notes.push(
      `Phase 1 mobilization is ${(upfrontBps / 100).toFixed(1)}%, which exceeds the recommended 30%–50% upfront cap (e.g., 40/40/20 or 40/30/30).`
    );
  }
  if (!isBudgetBalanced) {
    notes.push(
      `Itemized line items sum to ₱${budgetLineItemSumPhp.toLocaleString()}, which differs from declared total budget ₱${declaredTotalBudgetPhp.toLocaleString()} by ₱${Math.abs(
        discrepancy
      ).toLocaleString()}.`
    );
  }

  return {
    isValidCount,
    milestoneCount: count,
    totalPercentageBps: totalBps,
    isExact100Percent,
    upfrontPercentageBps: upfrontBps,
    upfrontAssessment,
    budgetLineItemSumPhp,
    declaredTotalBudgetPhp,
    isBudgetBalanced,
    budgetDiscrepancyPhp: discrepancy,
    notes,
  };
}

