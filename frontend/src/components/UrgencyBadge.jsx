import { AlertTriangle } from "lucide-react";

// Sub-project B2 (kotklusser-cleanup-plan.md sectie 3.4, zie
// docs/superpowers/specs/2026-07-21-ticket-detail-shared-subcomponents-design.md):
// bestond voorheen enkel in AannemerKlusDetail.jsx. TicketDetail.jsx toonde
// ticket.urgency nergens — een omissie, geen bewuste keuze — en krijgt de
// badge hier voor het eerst.

export const URGENCY_CONFIG = {
  low: { label: "Laag", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  normal: { label: "Normaal", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  high: { label: "Hoog", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  urgent: { label: "Urgent", color: "text-red-400 bg-red-500/10 border-red-500/20" },
};

const UrgencyBadge = ({ urgency }) => {
  const cfg = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.normal;

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      {urgency === "urgent" && <AlertTriangle className="w-3 h-3 mr-1" />}
      {cfg.label}
    </span>
  );
};

export default UrgencyBadge;
